#!/usr/bin/env python3
"""Inspect remote CORS / API for admin Failed to fetch."""
from __future__ import annotations
import sys

import os
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST") or sys.exit("Set DEPLOY_HOST explicitly (no default target).")


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = val


def main() -> int:
    load_dotenv()
    password = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if not password:
        print("DEPLOY_PASSWORD required")
        return 1
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=120)
    cmds = [
        "grep -E '^(CORS_ORIGINS|NODE_ENV)=' /opt/cullinos/.env || true",
        "CID=$(docker ps -qf name=cullinos-api | head -1); echo CID=$CID; docker exec $CID printenv CORS_ORIGINS NODE_ENV 2>&1",
        "curl -sI http://127.0.0.1:3000/api/v1/organizations/current | head -20",
        "curl -sI -H 'Origin: https://admin.cullinos.com' http://127.0.0.1:3000/api/v1/health | head -20",
        "docker compose -f /opt/cullinos/docker-compose.prod.yml ps api",
        "ls -la /var/www/cullinos/admin/ | head -20",
        "CID=$(docker ps -qf name=cullinos-api | head -1); docker logs --tail 50 $CID 2>&1",
        "nginx -T 2>/dev/null | grep -A2 'server_name api.cullinos.com' | head -40",
    ]
    try:
        for c in cmds:
            print("\n====", c[:100])
            _, stdout, stderr = ssh.exec_command(c, timeout=90)
            out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
            print(out[-4000:])
    finally:
        ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
