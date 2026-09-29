#!/usr/bin/env python3
"""Apply Prisma migrations on a Compose VM, baselining a legacy `db push` database first.

Baselining (one time per database, see docs/DEPLOYMENT.md "Database migrations"):
  1. run packages/prisma/prisma/baseline/precheck.sql and stop if any duplicates are reported
  2. apply the catch-up diff (live DB -> schema.prisma) after showing it and asking for confirmation
  3. `migrate resolve --applied 0_init`
Afterwards (or on an already-baselined DB) runs `migrate deploy`. Never uses --accept-data-loss.

Env: DEPLOY_HOST (required), DEPLOY_USER (default root), DEPLOY_PASSWORD.
"""
from __future__ import annotations

import io
import os
import sys
import tarfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"
SCHEMA = "packages/prisma/prisma/schema.prisma"
# Keep in sync with packages/prisma/prisma/baseline/precheck.sql
PRECHECK_QUERIES = 3
BACKFILL_SQL = (
    "UPDATE invoices i SET organization_id = o.organization_id FROM orders o "
    "WHERE o.id = i.order_id AND i.organization_id IS NULL; "
    "UPDATE credit_notes c SET organization_id = i.organization_id FROM invoices i "
    "WHERE i.id = c.invoice_id AND c.organization_id IS NULL;"
)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 900) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        snippet = out[-5000:] if len(out) > 5000 else out
        sys.stdout.buffer.write((snippet + "\n").encode("utf-8", errors="replace"))
        sys.stdout.buffer.flush()
    if err.strip() and (code != 0 or "error" in err.lower()):
        snippet = err[-3000:] if len(err) > 3000 else err
        sys.stdout.buffer.write(("STDERR: " + snippet + "\n").encode("utf-8", errors="replace"))
        sys.stdout.buffer.flush()
    return code, out, err


def api_run(cmd: str) -> str:
    """Run a command in the API image with host schema/migrations bind-mounted."""
    return (
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T "
        f"--volume {APP_DIR}/packages/prisma:/app/packages/prisma "
        f"api {cmd}"
    )


def make_prisma_tarball() -> bytes:
    buf = io.BytesIO()
    prisma_root = ROOT / "packages" / "prisma"
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in ("prisma/schema.prisma", "prisma/migrations", "prisma/baseline", "scripts"):
            path = prisma_root / rel
            if path.is_file():
                tar.add(path, arcname=path.relative_to(ROOT).as_posix())
                continue
            for child in sorted(path.rglob("*")):
                if child.is_file():
                    tar.add(child, arcname=child.relative_to(ROOT).as_posix())
    buf.seek(0)
    return buf.read()


def confirm(prompt: str) -> bool:
    answer = input(f"{prompt} Type the host ({HOST}) to continue: ").strip()
    return answer == HOST


def main() -> int:
    if not HOST:
        print("Set DEPLOY_HOST explicitly (no default target).", file=sys.stderr)
        return 1
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD or pass password as first argument.", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    ssh.connect(HOST, username=USER, password=password, timeout=30)

    try:
        print("Uploading Prisma schema, migrations and scripts...")
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/cullinos-prisma.tar.gz", "wb") as f:
            f.write(make_prisma_tarball())
        sftp.close()
        code, _, _ = run(
            ssh,
            f"mkdir -p {APP_DIR}/packages/prisma && "
            f"tar -xzf /tmp/cullinos-prisma.tar.gz -C {APP_DIR} && rm /tmp/cullinos-prisma.tar.gz",
        )
        if code != 0:
            return code

        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d postgres")
        run(ssh, "sleep 5")

        code, _, _ = run(ssh, api_run("node packages/prisma/scripts/migrate-deploy.mjs"), timeout=600)
        if code == 0:
            print("\n=== Migrations applied ===")
            return 0
        if code != 3:
            print("migrate deploy failed", file=sys.stderr)
            return code

        print("\nDatabase is not baselined. Running pre-checks...")
        code, out, _ = run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml exec -T postgres "
            "psql -U cullinos -d cullinos -v ON_ERROR_STOP=1 "
            f"< {APP_DIR}/packages/prisma/prisma/baseline/precheck.sql",
            timeout=300,
        )
        if code != 0 or out.count("(0 rows)") != PRECHECK_QUERIES:
            print("Pre-check found duplicates (see above); resolve them before baselining.", file=sys.stderr)
            return code or 1

        code, diff_sql, _ = run(
            ssh,
            api_run(
                "sh -c 'npx prisma migrate diff --from-url \"$DATABASE_URL\" "
                f"--to-schema-datamodel {SCHEMA} --script'"
            ),
            timeout=300,
        )
        if code != 0:
            return code
        print("\n=== Catch-up SQL (live DB -> schema.prisma) ===\n" + diff_sql)
        if "DROP " in diff_sql.upper() and not confirm("The catch-up SQL contains DROP statements."):
            print("Aborted.", file=sys.stderr)
            return 1
        if not confirm("Apply the catch-up SQL above and mark 0_init as applied?"):
            print("Aborted.", file=sys.stderr)
            return 1

        sftp = ssh.open_sftp()
        with sftp.file(f"{APP_DIR}/packages/prisma/prisma/baseline/catchup.sql", "w") as f:
            f.write(diff_sql)
        sftp.close()
        code, _, _ = run(
            ssh,
            api_run(
                f"npx prisma db execute --schema={SCHEMA} --file packages/prisma/prisma/baseline/catchup.sql"
            ),
            timeout=600,
        )
        if code != 0:
            print("Catch-up SQL failed; database was not marked as baselined.", file=sys.stderr)
            return code
        code, _, _ = run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml exec -T postgres "
            f"psql -U cullinos -d cullinos -v ON_ERROR_STOP=1 -c \"{BACKFILL_SQL}\"",
            timeout=300,
        )
        if code != 0:
            print("Tenant backfill failed; database was not marked as baselined.", file=sys.stderr)
            return code
        code, _, _ = run(ssh, api_run(f"npx prisma migrate resolve --applied 0_init --schema={SCHEMA}"))
        if code != 0:
            return code
        code, _, _ = run(ssh, api_run("node packages/prisma/scripts/migrate-deploy.mjs"), timeout=600)
        if code != 0:
            return code

        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")
        run(ssh, "sleep 8 && curl -sf http://127.0.0.1:3000/api/v1/health/db || true")
        print("\n=== Database baselined and migrated ===")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
