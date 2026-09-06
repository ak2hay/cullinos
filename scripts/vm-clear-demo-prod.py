#!/usr/bin/env python3
"""Clear demo tenants on production and re-seed baseline only (no demo data)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"

UPLOAD_FILES = [
    "packages/prisma/prisma/seed.ts",
    "packages/prisma/prisma/clear-demo-data.ts",
    "packages/prisma/package.json",
    "scripts/vm-rebuild-api.py",
    "scripts/vm-db-init.py",
    "scripts/remote-deploy.py",
    "scripts/vm-fix-db.py",
]


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 900) -> tuple[int, str, str]:
    safe_print(f"\n$ {cmd[:240]}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe_print(out[-8000:])
    if code != 0 and err.strip():
        safe_print("STDERR: " + err[-3000:])
    return code, out, err


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("password required", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=30)
    safe_print("Connected")

    sftp = ssh.open_sftp()
    for rel in UPLOAD_FILES:
        local = ROOT / rel
        remote = f"{APP_DIR}/{rel}"
        remote_dir = remote.rsplit("/", 1)[0]
        run(ssh, f"mkdir -p {remote_dir}")
        with sftp.file(remote, "wb") as f:
            f.write(local.read_bytes())
        safe_print(f"uploaded {rel}")
    sftp.close()

    safe_print("\n=== Clear demo data ===")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T "
        f"-v {APP_DIR}/packages/prisma/prisma:/app/packages/prisma/prisma "
        "-e NODE_ENV=production api "
        "npx tsx packages/prisma/prisma/clear-demo-data.ts",
        timeout=600,
    )
    if code != 0:
        safe_print("clear-demo-data failed")
        ssh.close()
        return code

    safe_print("\n=== Production baseline seed (no demos) ===")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T "
        f"-v {APP_DIR}/packages/prisma/prisma:/app/packages/prisma/prisma "
        "-e SEED_DEMO=false -e NODE_ENV=production api "
        "npx tsx packages/prisma/prisma/seed.ts",
        timeout=600,
    )
    if code != 0:
        safe_print("seed failed")
        ssh.close()
        return code

    safe_print("\n=== Remaining orgs ===")
    run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml exec -T postgres "
        "psql -U cullinos -d cullinos -c \"SELECT slug, name, email FROM organizations ORDER BY name;\"",
        timeout=60,
    )

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")
    run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true")

    ssh.close()
    safe_print("\n=== Production demo cleanup complete ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
