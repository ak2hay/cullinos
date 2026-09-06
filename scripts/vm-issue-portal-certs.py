#!/usr/bin/env python3
"""Issue Let's Encrypt certs for Cullinos portal hostnames and enable HTTPS."""
from __future__ import annotations

import os
import sys

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "") or (sys.argv[1] if len(sys.argv) > 1 else "")

FRONTEND_DOMAINS = [
    "admin.cullinos.com",
    "manage.cullinos.com",
    "platform.cullinos.com",
    "order.cullinos.com",
    "waiter.cullinos.com",
    "pos.cullinos.com",
    "kds.cullinos.com",
    "cullinos.com",
    "www.cullinos.com",
]


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:220]}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = out
    if err.strip():
        text += ("\nSTDERR:\n" + err)
    snippet = text[-8000:] if len(text) > 8000 else text
    sys.stdout.buffer.write((snippet + "\n").encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()
    return code, out, err


def main() -> int:
    if not PASSWORD:
        print("Need DEPLOY_PASSWORD", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=PASSWORD, timeout=30)

    run(
        ssh,
        "export DEBIAN_FRONTEND=noninteractive && "
        "apt-get install -y -qq certbot python3-certbot-nginx",
        timeout=300,
    )
    run(ssh, "mkdir -p /var/www/certbot")
    run(ssh, "nginx -t && systemctl reload nginx")

    run(
        ssh,
        "openssl x509 -in /etc/letsencrypt/live/admin.cullinos.com/fullchain.pem "
        "-noout -subject -dates -ext subjectAltName 2>/dev/null || echo NO_ADMIN_CERT",
    )

    flags = " ".join(f"-d {d}" for d in FRONTEND_DOMAINS)
    # Expand existing admin cert if present; otherwise create a new line.
    cmd = (
        "certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email "
        "--redirect --expand "
        f"--cert-name admin.cullinos.com {flags}"
    )
    code, out, err = run(ssh, cmd, timeout=600)
    combined = out + err
    if code != 0 or "Congratulations" not in combined and "Successfully" not in combined:
        print("Expand failed; requesting a fresh certificate line...")
        run(
            ssh,
            "certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email "
            f"--redirect --cert-name cullinos-portals {flags}",
            timeout=600,
        )

    run(ssh, "nginx -t && systemctl reload nginx")
    run(ssh, "ls -la /etc/letsencrypt/live")
    run(
        ssh,
        "echo | openssl s_client -servername admin.cullinos.com -connect 127.0.0.1:443 2>/dev/null | "
        "openssl x509 -noout -subject -ext subjectAltName",
    )
    run(
        ssh,
        "echo | openssl s_client -servername waiter.cullinos.com -connect 127.0.0.1:443 2>/dev/null | "
        "openssl x509 -noout -subject -ext subjectAltName",
    )
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
