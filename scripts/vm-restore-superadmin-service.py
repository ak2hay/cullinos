#!/usr/bin/env python3
"""Restore VM super-admin.service.ts from the running image so API rebuilds work."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APP_DIR = "/opt/cullinos"
TARGET = f"{APP_DIR}/apps/api/src/modules/super-admin/super-admin.service.ts"


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1].strip()
    secrets = ROOT / "secrets-export.txt"
    if secrets.exists():
        lines = secrets.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines):
            if line.strip() == "DEPLOY_PASSWORD" and i + 1 < len(lines):
                return lines[i + 1].strip()
    raise SystemExit("Set DEPLOY_PASSWORD or pass password as argv[1]")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str]:
    print(f"\n$ {cmd[:220]}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-3000:], flush=True)
    if code != 0 and err.strip():
        print("STDERR:", err[-2000:], flush=True)
    return code, out


def main() -> int:
    password = load_password()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=30)

    # Prefer source baked into the currently running image.
    code, _ = run(
        ssh,
        "docker run --rm --entrypoint cat cullinos-api:latest "
        "/app/apps/api/src/modules/super-admin/super-admin.service.ts > /tmp/sa.service.from-image.ts",
    )
    if code != 0:
        ssh.close()
        return code

    run(ssh, f"cp {TARGET} /tmp/sa.service.broken.bak || true")
    run(ssh, f"cp /tmp/sa.service.from-image.ts {TARGET}")
    run(ssh, f"grep -n impersonationHandoff {TARGET} || echo 'no impersonationHandoff (good)'")
    run(ssh, f"wc -l {TARGET}")
    print("\n=== Restored super-admin.service.ts from image ===", flush=True)
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
