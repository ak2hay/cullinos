#!/usr/bin/env python3
"""Finish redeploy after API image is already on commit (prisma + SPAs + nginx)."""
from __future__ import annotations

import io
import os
import sys
import tarfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")


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


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 900) -> tuple[int, str]:
    safe_print(f"\n$ {cmd[:240]}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = (out + ("\n" + err if err.strip() else "")).encode("ascii", "replace").decode("ascii")
    if text.strip():
        safe_print(text[-4000:])
    return code, out


def main() -> int:
    load_dotenv()
    password = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if not password:
        safe_print("DEPLOY_PASSWORD required")
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=90)

    try:
        code, health = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health")
        if code != 0:
            return 1
        safe_print(f"API: {health.strip()}")

        safe_print("\n=== Prisma db push ===")
        code, _ = run(
            ssh,
            "cd /opt/cullinos && docker compose -f docker-compose.prod.yml run --rm -T --no-deps api "
            "npx prisma db push --schema=packages/prisma/prisma/schema.prisma --skip-generate",
            timeout=900,
        )
        if code != 0:
            return code

        run(
            ssh,
            "docker exec cullinos-postgres psql -U cullinos -d cullinos -tAc "
            "\"select column_name from information_schema.columns "
            "where table_name='guest_push_campaigns' "
            "and column_name in ('image_url','style_preset','creative') order by 1;\"",
        )

        spas = {
            "app-ops": ROOT / "apps" / "app-ops" / "dist",
            "super-admin": ROOT / "apps" / "super-admin" / "dist",
        }
        for name, dist in spas.items():
            if not (dist / "index.html").is_file():
                safe_print(f"Missing {dist}/index.html")
                return 1

        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            for name, dist in spas.items():
                tar.add(dist, arcname=name)
        data = buf.getvalue()
        safe_print(f"SPA tarball: {len(data) / 1024:.1f} KB")

        sftp = ssh.open_sftp()
        with sftp.file("/tmp/cullinos-finish-spas.tar.gz", "wb") as f:
            f.write(data)
        with sftp.file("/tmp/cullinos-frontends.conf.new", "wb") as f:
            f.write(
                (ROOT / "infrastructure" / "nginx" / "cullinos-frontends.conf").read_bytes()
            )
        sftp.close()

        code, _ = run(
            ssh,
            "rm -rf /tmp/cullinos-finish-spas && mkdir -p /tmp/cullinos-finish-spas /var/www/cullinos && "
            "tar -xzf /tmp/cullinos-finish-spas.tar.gz -C /tmp/cullinos-finish-spas && "
            "rm -rf /var/www/cullinos/app-ops /var/www/cullinos/super-admin && "
            "mv /tmp/cullinos-finish-spas/app-ops /var/www/cullinos/app-ops && "
            "mv /tmp/cullinos-finish-spas/super-admin /var/www/cullinos/super-admin && "
            "rm -rf /tmp/cullinos-finish-spas /tmp/cullinos-finish-spas.tar.gz && "
            "test -f /var/www/cullinos/app-ops/index.html && "
            "test -f /var/www/cullinos/super-admin/index.html && echo SPAS_OK",
        )
        if code != 0:
            return code

        code, _ = run(
            ssh,
            "cp /tmp/cullinos-frontends.conf.new /etc/nginx/sites-available/cullinos-frontends.conf && "
            "nginx -t && systemctl reload nginx && echo NGINX_OK",
        )
        if code != 0:
            return code

        run(
            ssh,
            "cd /opt/cullinos && "
            "if grep -q '^CORS_ORIGINS=' .env; then "
            "  grep -q 'app.cullinos.com' .env || "
            "  sed -i 's|^CORS_ORIGINS=\\(.*\\)|CORS_ORIGINS=\\1,https://app.cullinos.com|' .env; "
            "fi && grep '^CORS_ORIGINS=' .env | sed 's/=.*/=SET/'",
        )

        run(
            ssh,
            "curl -sI -k --resolve app.cullinos.com:443:127.0.0.1 https://app.cullinos.com/login | head -12",
        )
        run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health; echo")
        safe_print("\nFINISH_OK")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
