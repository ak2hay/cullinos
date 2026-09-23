#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")


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


def main() -> int:
    password = load_password()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=30)
    sql = (
        "SELECT key, left(value, 120) FROM \"PlatformSetting\" "
        "WHERE key LIKE 'R2_%' ORDER BY key;"
    )
    # try a few table names
    for table in ("PlatformSetting", "PlatformConfig", "platform_settings"):
        cmd = (
            f'docker exec cullinos-postgres psql -U cullinos -d cullinos -c '
            f"\"SELECT key, left(value,120) FROM \\\"{table}\\\" WHERE key LIKE 'R2_%' ORDER BY key;\""
        )
        _, o, e = ssh.exec_command(cmd, timeout=60)
        out = o.read().decode()
        err = e.read().decode()
        print(f"=== {table} ===")
        print(out or err[:800])
    _, o, _ = ssh.exec_command(
        "docker logs cullinos-api 2>&1 | grep -iE 'R2 storage|StorageService' | tail -10",
        timeout=30,
    )
    print("=== logs ===")
    print(o.read().decode())
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
