#!/usr/bin/env python3
"""Sync Prisma schema to production VM, db push (no reset), baseline migrations."""
from __future__ import annotations

import io
import os
import sys
import tarfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"

MIGRATIONS = [
    "20260830000000_marketing_cms",
    "20260830120000_food_business_verticals",
    "20260903200000_razorpay_billing",
    "20260904150000_must_change_password",
    "20260905180000_restaurant_size",
    "20260905190000_phone_otp_customer_phone",
    "20260905193000_platform_settings",
]


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


def prisma_cmd(args: str) -> str:
    """Run prisma in API image with host schema/migrations bind-mounted."""
    return (
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T "
        f"--volume {APP_DIR}/packages/prisma/prisma:/app/packages/prisma/prisma "
        f"api npx prisma {args}"
    )


def make_prisma_tarball() -> bytes:
    buf = io.BytesIO()
    prisma_root = ROOT / "packages" / "prisma"
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(
            prisma_root / "prisma" / "schema.prisma",
            arcname="packages/prisma/prisma/schema.prisma",
        )
        migrations = prisma_root / "prisma" / "migrations"
        for path in sorted(migrations.rglob("*")):
            if path.is_file():
                tar.add(path, arcname=path.relative_to(ROOT).as_posix())
    buf.seek(0)
    return buf.read()


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD or pass password as first argument.", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    ssh.connect(HOST, username=USER, password=password, timeout=30)

    print("Uploading Prisma schema + migrations...")
    tarball = make_prisma_tarball()
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos-prisma.tar.gz", "wb") as f:
        f.write(tarball)
    sftp.close()

    code, _, _ = run(
        ssh,
        f"mkdir -p {APP_DIR}/packages/prisma/prisma && "
        f"tar -xzf /tmp/cullinos-prisma.tar.gz -C {APP_DIR} && rm /tmp/cullinos-prisma.tar.gz && "
        f"ls -la {APP_DIR}/packages/prisma/prisma/migrations",
    )
    if code != 0:
        ssh.close()
        return code

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d postgres")
    run(ssh, "sleep 5")

    print("Pushing schema (no force-reset)...")
    code, _, _ = run(
        ssh,
        prisma_cmd(
            "db push --accept-data-loss --schema=packages/prisma/prisma/schema.prisma"
        ),
        timeout=600,
    )
    if code != 0:
        print("db push failed", file=sys.stderr)
        ssh.close()
        return code

    print("Baselining migrations as applied...")
    for name in MIGRATIONS:
        code, out, err = run(
            ssh,
            prisma_cmd(
                f"migrate resolve --applied {name} --schema=packages/prisma/prisma/schema.prisma"
            ),
            timeout=300,
        )
        combined = (out + err).lower()
        if code != 0 and "already" not in combined and "recorded" not in combined:
            print(f"Warning: resolve {name} exited {code}")

    print("Verifying migrate deploy...")
    code, out, _ = run(
        ssh,
        prisma_cmd("migrate deploy --schema=packages/prisma/prisma/schema.prisma"),
        timeout=300,
    )

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")
    run(ssh, "sleep 8 && curl -sf http://127.0.0.1:3000/api/v1/health || true")

    ssh.close()
    if code != 0:
        print("migrate deploy failed", file=sys.stderr)
        return code
    print("\n=== Production DB schema sync complete ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
