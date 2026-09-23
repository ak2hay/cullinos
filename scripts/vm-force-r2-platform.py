#!/usr/bin/env python3
"""Force-update platform_settings R2_BUCKET and R2_PUBLIC_URL."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APP_DIR = "/opt/cullinos"
BUCKET = "cullinos-marketing"
PUBLIC_URL = "https://pub-ad3302af8f0c4899add9111ce1868aff.r2.dev"


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    for name in (".env",):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("DEPLOY_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:260]}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-3000:], flush=True)
    if err.strip():
        print("STDERR:", err[-1500:], flush=True)
    return code, out, err


def main() -> int:
    password = load_password()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=30)

    # Inspect columns first
    run(
        ssh,
        'docker exec cullinos-postgres psql -U cullinos -d cullinos -c "\\d platform_settings"',
        timeout=30,
    )

    # Write SQL via sftp then docker cp
    sql = (
        f"UPDATE platform_settings SET value = '{BUCKET}' WHERE key = 'R2_BUCKET';\n"
        f"UPDATE platform_settings SET value = '{PUBLIC_URL}' WHERE key = 'R2_PUBLIC_URL';\n"
        "SELECT key, value FROM platform_settings WHERE key IN ('R2_BUCKET','R2_PUBLIC_URL') ORDER BY key;\n"
    )
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/r2fix.sql", "w") as f:
        f.write(sql)
    sftp.close()

    code, _, _ = run(
        ssh,
        "docker cp /tmp/r2fix.sql cullinos-postgres:/tmp/r2fix.sql && "
        "docker exec cullinos-postgres psql -U cullinos -d cullinos -v ON_ERROR_STOP=1 -f /tmp/r2fix.sql",
        timeout=60,
    )
    if code != 0:
        return code

    run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api",
        timeout=180,
    )
    for _ in range(24):
        _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if "ok" in health:
            break
        time.sleep(5)
    run(ssh, "docker logs cullinos-api 2>&1 | grep -iE 'R2 storage' | tail -5", timeout=30)
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
