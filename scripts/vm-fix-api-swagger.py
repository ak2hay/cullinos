#!/usr/bin/env python3
"""Upload NestJS swagger pin and rebuild API without reseeding."""
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
    "package.json",
    "package-lock.json",
    "apps/api/package.json",
    "scripts/build-frontends.sh",
]


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:180]}{'...' if len(cmd) > 180 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        sys.stdout.buffer.write((out[-4000:] + "\n").encode("utf-8", errors="replace"))
    if code != 0 and err.strip():
        sys.stdout.buffer.write(("STDERR: " + err[-2500:] + "\n").encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()
    return code, out, err


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=30)

    sftp = ssh.open_sftp()
    for rel in FILES:
        local = ROOT / rel
        remote = f"{APP_DIR}/{rel}"
        print(f"Uploading {rel}...")
        data = local.read_bytes()
        if rel.endswith(".sh") or rel.endswith(".json"):
            try:
                text = data.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
                data = text.encode("utf-8")
            except UnicodeDecodeError:
                pass
        with sftp.file(remote, "wb") as f:
            f.write(data)
    sftp.close()

    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build --no-cache api",
        timeout=1800,
    )
    if code != 0:
        print("API image build failed.", file=sys.stderr)
        ssh.close()
        return code

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")

    for i in range(24):
        _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if '"status":"ok"' in out or '"status": "ok"' in out:
            print("\nAPI healthy:", out.strip())
            ssh.close()
            return 0
        print(f"waiting for API ({i + 1}/24)")
        time.sleep(10)

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=50 api")
    ssh.close()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
