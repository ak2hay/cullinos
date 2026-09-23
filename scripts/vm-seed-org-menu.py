#!/usr/bin/env python3
"""Seed a demo menu for an existing org on the Cullinos VM DB.

Usage:
  set DEPLOY_PASSWORD=...
  python scripts/vm-seed-org-menu.py test-resto-mtoihd64
"""
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
    "packages/prisma/prisma/seed-org-menu.ts",
]


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
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
    password = PASSWORD or (sys.argv[2] if len(sys.argv) > 2 else "")
    org_slug = sys.argv[1] if len(sys.argv) > 1 else "test-resto-mtoihd64"
    if not password:
        print(
            "Usage: DEPLOY_PASSWORD=... python scripts/vm-seed-org-menu.py <org-slug>",
            file=sys.stderr,
        )
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

    safe_print(f"\n=== Seed menu for {org_slug} ===")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T "
        f"-v {APP_DIR}/packages/prisma/prisma:/app/packages/prisma/prisma "
        f"-e ORG_SLUG={org_slug} -e NODE_ENV=production api "
        "npx tsx packages/prisma/prisma/seed-org-menu.ts",
        timeout=600,
    )
    if code != 0:
        safe_print("seed-org-menu failed")
        ssh.close()
        return code

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")
    run(
        ssh,
        f"curl -sf https://api.cullinos.com/api/v1/storefront/{org_slug}/main-outlet "
        "| head -c 500 || true",
    )

    ssh.close()
    safe_print("\n=== Done ===")
    safe_print(f"Phone:  https://guest.cullinos.com/{org_slug}/main-outlet")
    safe_print(f"Kiosk:  https://guest.cullinos.com/{org_slug}/main-outlet/kiosk")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
