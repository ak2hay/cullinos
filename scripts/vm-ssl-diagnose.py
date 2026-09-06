#!/usr/bin/env python3
"""Diagnose TLS for Cullinos portal hostnames."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "") or (sys.argv[1] if len(sys.argv) > 1 else "")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 180) -> str:
    print(f"\n$ {cmd[:200]}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    stdout.channel.recv_exit_status()
    text = (out + (("\nSTDERR:\n" + err) if err.strip() else "")).strip()
    print(text[-6000:] if len(text) > 6000 else text)
    return text


def main() -> int:
    if not PASSWORD:
        print("Need DEPLOY_PASSWORD", file=sys.stderr)
        return 1
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=PASSWORD, timeout=30)
    run(ssh, "ls -la /etc/letsencrypt/live 2>/dev/null || echo NO_LE_LIVE")
    run(ssh, "ls /etc/nginx/sites-enabled")
    run(ssh, "grep -RIn 'listen 443\\|ssl_certificate\\|server_name' /etc/nginx/sites-enabled /etc/nginx/sites-available 2>/dev/null | head -120")
    run(
        ssh,
        "for h in admin.cullinos.com waiter.cullinos.com pos.cullinos.com kds.cullinos.com "
        "order.cullinos.com manage.cullinos.com platform.cullinos.com cullinos.com api.cullinos.com; do "
        "echo \"=== $h ===\"; "
        "echo -n 'A '; getent ahostsv4 $h | awk '{print $1}' | head -1; "
        "echo | openssl s_client -servername $h -connect 127.0.0.1:443 2>/dev/null | "
        "openssl x509 -noout -subject -ext subjectAltName 2>/dev/null || echo NO_CERT; "
        "done",
    )
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
