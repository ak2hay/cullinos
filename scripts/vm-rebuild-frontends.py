#!/usr/bin/env python3
"""Rebuild and publish frontends on the production VM after CRLF fix."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 2400) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:200]}{'...' if len(cmd) > 200 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        snippet = out[-4000:] if len(out) > 4000 else out
        sys.stdout.buffer.write((snippet + "\n").encode("utf-8", errors="replace"))
    if code != 0 and err.strip():
        snippet = err[-3000:] if len(err) > 3000 else err
        sys.stdout.buffer.write(("STDERR: " + snippet + "\n").encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()
    return code, out, err


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD or pass password as first argument.", file=sys.stderr)
        return 1

    script_path = ROOT / "scripts" / "build-frontends.sh"
    text = script_path.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
    script_path.write_bytes(text.encode("utf-8"))
    print("Normalized build-frontends.sh to LF")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=30)

    sftp = ssh.open_sftp()
    with sftp.file(f"{APP_DIR}/scripts/build-frontends.sh", "w") as f:
        f.write(text)
    sftp.chmod(f"{APP_DIR}/scripts/build-frontends.sh", 0o755)
    sftp.close()
    print("Uploaded build-frontends.sh")

    code, _, _ = run(
        ssh,
        f"sed -i 's/\\r$//' {APP_DIR}/scripts/build-frontends.sh && "
        f"cd {APP_DIR} && bash scripts/build-frontends.sh",
    )
    if code != 0:
        print("Frontend build failed.", file=sys.stderr)
        ssh.close()
        return code

    code, out, _ = run(ssh, f"test -d {APP_DIR}/dist-frontends/admin && echo ok || echo missing")
    if "ok" not in out:
        print("dist-frontends/admin missing after build.", file=sys.stderr)
        ssh.close()
        return 1

    run(ssh, f"mkdir -p /var/www/cullinos && cp -r {APP_DIR}/dist-frontends/* /var/www/cullinos/")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --build web",
        timeout=1200,
    )
    if code != 0:
        print("Web container rebuild failed.", file=sys.stderr)

    # Keep live HTTPS (certbot) if already present — do not replace with HTTP-only template.
    _, nginx_check, _ = run(
        ssh,
        "grep -q 'listen 443 ssl' /etc/nginx/sites-available/cullinos-frontends.conf "
        "&& echo has_ssl || echo no_ssl",
    )
    if "has_ssl" not in nginx_check:
        frontends = (ROOT / "infrastructure" / "nginx" / "cullinos-frontends.conf").read_text(
            encoding="utf-8"
        ).replace("\r\n", "\n")
        sftp = ssh.open_sftp()
        with sftp.file("/etc/nginx/sites-available/cullinos-frontends.conf", "w") as f:
            f.write(frontends)
        sftp.close()
        run(
            ssh,
            "ln -sf /etc/nginx/sites-available/cullinos-frontends.conf "
            "/etc/nginx/sites-enabled/cullinos-frontends.conf && nginx -t && systemctl reload nginx",
        )
    else:
        print("Leaving existing HTTPS nginx frontend config in place.")

    _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=60)
    print("\n=== Frontend redeploy complete ===")
    print(f"API health: {health.strip()[:400]}")
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
