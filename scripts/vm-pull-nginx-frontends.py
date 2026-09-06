#!/usr/bin/env python3
"""Download live nginx frontend config after certbot HTTPS enablement."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "") or (sys.argv[1] if len(sys.argv) > 1 else "")
REMOTE = "/etc/nginx/sites-available/cullinos-frontends.conf"
LOCAL = ROOT / "infrastructure" / "nginx" / "cullinos-frontends.conf"


def main() -> int:
    if not PASSWORD:
        print("Need DEPLOY_PASSWORD", file=sys.stderr)
        return 1
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=PASSWORD, timeout=30)
    sftp = ssh.open_sftp()
    with sftp.file(REMOTE, "r") as f:
        data = f.read().decode("utf-8")
    sftp.close()
    ssh.close()
    LOCAL.write_text(data.replace("\r\n", "\n"), encoding="utf-8")
    print(f"Wrote {LOCAL} ({len(data)} bytes)")
    print(data[:2500])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
