#!/usr/bin/env python3
"""Quick API rebuild after inventory/shared fix."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"

FILES = [
    "apps/api/src/modules/inventory/inventory.service.ts",
    "packages/shared/tsconfig.json",
    "packages/shared/src/constants.ts",
]


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 2400) -> tuple[int, str, str]:
    safe_print(f"\n$ {cmd[:220]}")
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
    for rel in FILES:
        local = ROOT / rel
        remote = f"{APP_DIR}/{rel}"
        remote_dir = remote.rsplit("/", 1)[0]
        run(ssh, f"mkdir -p {remote_dir}")
        data = local.read_bytes()
        with sftp.file(remote, "wb") as f:
            f.write(data)
        safe_print(f"uploaded {rel} ({len(data)} bytes)")
    sftp.close()

    safe_print("\n=== Rebuild API (--no-cache) ===")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build --no-cache api "
        f"&& docker compose -f docker-compose.prod.yml up -d api",
        timeout=2400,
    )
    if code != 0:
        safe_print("API rebuild failed")
        return code

    safe_print("\n=== Wait for health ===")
    healthy = False
    for i in range(36):
        _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if '"status"' in out and "ok" in out:
            safe_print("API healthy")
            healthy = True
            break
        time.sleep(10)
    if not healthy:
        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=60 api")
        return 1

    ssh.close()
    safe_print("\n=== API fix deploy complete ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
