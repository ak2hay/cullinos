#!/usr/bin/env python3
from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "") or (sys.argv[1] if len(sys.argv) > 1 else "")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> str:
    print(f"\n$ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    stdout.channel.recv_exit_status()
    text = (out + ("\nSTDERR:\n" + err if err.strip() else "")).strip()
    print(text[-5000:] if len(text) > 5000 else text)
    return text


def main() -> int:
    if not PASSWORD:
        print("Need DEPLOY_PASSWORD", file=sys.stderr)
        return 1
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=PASSWORD, timeout=30)
    run(ssh, "cd /opt/cullinos && docker compose -f docker-compose.prod.yml ps")
    run(ssh, "curl -sv --max-time 10 http://127.0.0.1:3000/api/v1/health || true")
    run(ssh, "cd /opt/cullinos && docker compose -f docker-compose.prod.yml logs --tail=80 api")
    run(ssh, "ss -lntp | grep -E ':80|:443|:3000' || netstat -lntp | grep -E ':80|:443|:3000' || true")
    run(ssh, "nginx -t 2>&1")
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
