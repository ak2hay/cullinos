#!/usr/bin/env python3
"""Publish Cullinos App Ops SPA + nginx host mapping for app.cullinos.com.

Builds @cullinos/app-ops locally (if needed), uploads dist to /var/www/cullinos/app-ops,
installs updated cullinos-frontends.conf, expands Let's Encrypt cert, reloads nginx.

Env:
  DEPLOY_PASSWORD  root password (required; also read from .env)
  DEPLOY_HOST      default 95.135.254.46
  SKIP_BUILD=1     skip local vite build (use existing dist)
"""
from __future__ import annotations

import io
import os
import subprocess
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
WWW = "/var/www/cullinos"
NGINX_FRONTENDS = "/etc/nginx/sites-available/cullinos-frontends.conf"
DIST = ROOT / "apps" / "app-ops" / "dist"
NGINX_SRC = ROOT / "infrastructure" / "nginx" / "cullinos-frontends.conf"


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


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    safe_print(f"\n$ {cmd[:200]}{'...' if len(cmd) > 200 else ''}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe_print(out.rstrip()[-2000:])
    if err.strip() and code != 0:
        safe_print(err.rstrip()[-1500:])
    return code, out, err


def upload(ssh: paramiko.SSHClient, data: bytes, remote: str) -> None:
    sftp = ssh.open_sftp()
    with sftp.file(remote, "wb") as f:
        f.write(data)
    sftp.close()


def build_spa() -> None:
    if os.environ.get("SKIP_BUILD") == "1" and DIST.is_dir():
        safe_print("SKIP_BUILD=1 — using existing dist")
        return
    env = os.environ.copy()
    env["VITE_API_URL"] = env.get("VITE_API_URL", "https://api.cullinos.com/api/v1")
    env["VITE_PLATFORM_URL"] = env.get("VITE_PLATFORM_URL", "https://platform.cullinos.com")
    safe_print(f"Building app-ops with VITE_API_URL={env['VITE_API_URL']}")
    subprocess.check_call(
        ["npm", "run", "build", "-w", "@cullinos/app-ops"],
        cwd=ROOT,
        env=env,
        shell=True,
    )
    if not (DIST / "index.html").is_file():
        raise SystemExit("apps/app-ops/dist/index.html missing after build")


def tar_dist() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(DIST, arcname="app-ops")
    return buf.getvalue()


def main() -> int:
    load_dotenv()
    password = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if not password:
        safe_print("DEPLOY_PASSWORD required")
        return 1
    if not NGINX_SRC.is_file():
        safe_print(f"Missing {NGINX_SRC}")
        return 1

    build_spa()
    tarball = tar_dist()
    safe_print(f"app-ops dist tarball: {len(tarball) / 1024:.1f} KB")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=90)

    try:
        upload(ssh, tarball, "/tmp/cullinos-app-ops-dist.tar.gz")
        upload(ssh, NGINX_SRC.read_bytes(), "/tmp/cullinos-frontends.conf.new")

        code, _, _ = run(
            ssh,
            f"mkdir -p {WWW} && rm -rf {WWW}/app-ops && "
            f"tar -xzf /tmp/cullinos-app-ops-dist.tar.gz -C {WWW} && "
            f"rm /tmp/cullinos-app-ops-dist.tar.gz && "
            f"test -f {WWW}/app-ops/index.html && echo SPA_PUBLISHED",
        )
        if code != 0:
            return code

        # Backup + install nginx
        run(
            ssh,
            f"cp -a {NGINX_FRONTENDS} {NGINX_FRONTENDS}.bak.$(date +%Y%m%d%H%M%S) 2>/dev/null || true; "
            f"cp /tmp/cullinos-frontends.conf.new {NGINX_FRONTENDS} && "
            f"ln -sfn {NGINX_FRONTENDS} /etc/nginx/sites-enabled/cullinos-frontends.conf && "
            f"nginx -t",
        )
        code, out, err = run(ssh, "nginx -t")
        if code != 0:
            safe_print("nginx -t failed — restoring backup if present")
            run(
                ssh,
                f"ls -1t {NGINX_FRONTENDS}.bak.* 2>/dev/null | head -1 | "
                f"xargs -r -I{{}} cp {{}} {NGINX_FRONTENDS}; nginx -t; systemctl reload nginx || true",
            )
            return 1

        # Expand cert to include app.cullinos.com (reuse admin cert lineage used by frontends)
        run(
            ssh,
            "certbot --nginx -d app.cullinos.com "
            "--expand --non-interactive --agree-tos "
            "--cert-name admin.cullinos.com "
            "--redirect 2>&1 || "
            "certbot certonly --nginx -d app.cullinos.com "
            "--non-interactive --agree-tos --register-unsafely-without-email 2>&1 || true",
            timeout=180,
        )

        run(ssh, "systemctl reload nginx && echo NGINX_RELOADED")

        # Ensure API CORS allows App Ops origin (Compose .env)
        run(
            ssh,
            "cd /opt/cullinos && "
            "if grep -q '^CORS_ORIGINS=' .env; then "
            "  grep -q 'app.cullinos.com' .env || "
            "  sed -i 's|^CORS_ORIGINS=\\(.*\\)|CORS_ORIGINS=\\1,https://app.cullinos.com|' .env; "
            "else "
            "  echo 'CORS_ORIGINS=https://admin.cullinos.com,https://manage.cullinos.com,https://platform.cullinos.com,https://app.cullinos.com,https://guest.cullinos.com,https://cullinos.com' >> .env; "
            "fi && "
            "grep '^CORS_ORIGINS=' .env | sed 's/=.*/=***redacted***/' && "
            "(docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api 2>&1 | tail -20 || true)",
            timeout=180,
        )

        # Smoke
        time.sleep(2)
        run(
            ssh,
            "curl -sI -k --resolve app.cullinos.com:443:127.0.0.1 https://app.cullinos.com/login "
            "| head -20",
        )
        run(
            ssh,
            "curl -sk --resolve app.cullinos.com:443:127.0.0.1 https://app.cullinos.com/login "
            "| head -c 200; echo",
        )
        safe_print("\nDone. Open https://app.cullinos.com/login")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
