#!/usr/bin/env python3
"""One-shot remote deploy for Cullinos API. Run locally — not for CI."""
from __future__ import annotations

import io
import os
import re
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"

VM_DATABASE_URL = "postgresql://cullinos:{password}@postgres:5432/cullinos"
VM_REDIS_URL = "redis://redis:6379"

CORS_ORIGINS = (
    "https://admin.cullinos.com,https://manage.cullinos.com,"
    "https://platform.cullinos.com,https://order.cullinos.com,"
    "https://waiter.cullinos.com,https://pos.cullinos.com,"
    "https://kds.cullinos.com,https://cullinos.com"
)

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

EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    "dist",
    ".turbo",
    "playwright-report",
    "test-results",
    "coverage",
}
EXCLUDE_FILES = {"secrets-export.txt", ".env"}

SECRET_KEYS = (
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "SUPER_ADMIN_JWT_SECRET",
    "ENCRYPTION_KEY",
    "POSTGRES_PASSWORD",
    "REVALIDATE_SECRET",
    "INTERNAL_API_KEY",
)


def parse_secrets(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    secrets: dict[str, str] = {}
    for key in SECRET_KEYS:
        m = re.search(rf"{key}\n([^\n]+)", text)
        if m:
            value = m.group(1).strip()
            if value and not value.startswith("<"):
                secrets[key] = value
    return secrets


def read_env_values(lines: list[str]) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in lines:
        if "=" not in line or line.strip().startswith("#"):
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def make_tarball() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for item in ROOT.iterdir():
            if item.name in EXCLUDE_DIRS or item.name in EXCLUDE_FILES:
                continue
            tar.add(item, arcname=item.name, filter=_tar_filter)
    buf.seek(0)
    return buf.read()


def _tar_filter(ti: tarfile.TarInfo) -> tarfile.TarInfo | None:
    parts = Path(ti.name).parts
    if any(p in EXCLUDE_DIRS for p in parts):
        return None
    if Path(ti.name).name in EXCLUDE_FILES:
        return None
    return ti


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:200]}{'...' if len(cmd) > 200 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()

    def safe_print(text: str, prefix: str = "") -> None:
        if not text.strip():
            return
        snippet = text[-4000:] if len(text) > 4000 else text
        sys.stdout.buffer.write((prefix + snippet + "\n").encode("utf-8", errors="replace"))
        sys.stdout.buffer.flush()

    safe_print(out)
    if err.strip() and code != 0:
        safe_print(err, "STDERR: ")
    return code, out, err


def patch_env_file(sftp: paramiko.SFTPClient, path: str, updates: dict[str, str]) -> None:
    try:
        with sftp.file(path, "r") as f:
            lines = f.read().decode("utf-8").splitlines()
    except FileNotFoundError:
        lines = []

    remaining = dict(updates)
    patched: list[str] = []
    for line in lines:
        key = line.split("=", 1)[0] if "=" in line else ""
        if key in remaining:
            patched.append(f"{key}={remaining.pop(key)}")
        else:
            patched.append(line)
    for key, value in remaining.items():
        patched.append(f"{key}={value}")

    with sftp.file(path, "w") as f:
        f.write("\n".join(patched) + "\n")


def vm_env_updates(secrets: dict[str, str], existing: dict[str, str] | None = None) -> dict[str, str]:
    pg_pw = (
        secrets.get("POSTGRES_PASSWORD")
        or (existing or {}).get("POSTGRES_PASSWORD")
        or os.urandom(16).hex()
    )
    updates: dict[str, str] = {
        "POSTGRES_PASSWORD": pg_pw,
        "DATABASE_URL": VM_DATABASE_URL.format(password=pg_pw),
        "REDIS_URL": VM_REDIS_URL,
        "REVALIDATE_SECRET": secrets.get("REVALIDATE_SECRET") or (existing or {}).get("REVALIDATE_SECRET") or os.urandom(24).hex(),
        "MARKETING_REVALIDATE_URL": "https://cullinos.com/api/revalidate",
        "INTERNAL_API_KEY": secrets.get("INTERNAL_API_KEY") or (existing or {}).get("INTERNAL_API_KEY") or os.urandom(24).hex(),
    }
    if secrets.get("JWT_ACCESS_SECRET"):
        updates["JWT_SECRET"] = secrets["JWT_ACCESS_SECRET"]
    if secrets.get("JWT_REFRESH_SECRET"):
        updates["JWT_REFRESH_SECRET"] = secrets["JWT_REFRESH_SECRET"]
    if secrets.get("SUPER_ADMIN_JWT_SECRET"):
        updates["SUPER_ADMIN_JWT_SECRET"] = secrets["SUPER_ADMIN_JWT_SECRET"]
    if secrets.get("ENCRYPTION_KEY"):
        updates["ENCRYPTION_KEY"] = secrets["ENCRYPTION_KEY"]
    return updates


def build_env_content(updates: dict[str, str]) -> str:
    return f"""NODE_ENV=production
API_PORT=3000
POSTGRES_PASSWORD={updates["POSTGRES_PASSWORD"]}
DATABASE_URL={updates["DATABASE_URL"]}
REDIS_URL={updates["REDIS_URL"]}
JWT_SECRET={updates.get("JWT_SECRET", os.urandom(32).hex())}
JWT_REFRESH_SECRET={updates.get("JWT_REFRESH_SECRET", os.urandom(32).hex())}
SUPER_ADMIN_JWT_SECRET={updates.get("SUPER_ADMIN_JWT_SECRET", os.urandom(32).hex())}
ENCRYPTION_KEY={updates.get("ENCRYPTION_KEY", os.urandom(32).hex())}
INTERNAL_API_KEY={updates["INTERNAL_API_KEY"]}
REVALIDATE_SECRET={updates["REVALIDATE_SECRET"]}
MARKETING_REVALIDATE_URL={updates["MARKETING_REVALIDATE_URL"]}
API_URL=https://api.cullinos.com
CORS_ORIGINS={CORS_ORIGINS}
CUSTOMER_APP_URL=https://order.cullinos.com
MARKETING_UPLOAD_DIR=/data/marketing-uploads
"""


def reset_postgres_volume(ssh: paramiko.SSHClient) -> None:
    print("Postgres password changed — wiping database volume for fresh start...")
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml down || true")
    run(
        ssh,
        "for vol in $(docker volume ls -q | grep cullinos_pg_data || true); do "
        "docker volume rm \"$vol\" 2>/dev/null || true; done",
    )


def run_certbot(ssh: paramiko.SSHClient) -> None:
    print("Installing certbot and requesting SSL certificates...")
    run(
        ssh,
        "export DEBIAN_FRONTEND=noninteractive && "
        "apt-get install -y -qq certbot python3-certbot-nginx",
        timeout=300,
    )

    frontend_domains = " ".join(f"-d {d}" for d in FRONTEND_DOMAINS)
    certbot_cmd = (
        f"certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email "
        f"--redirect {frontend_domains} || true"
    )
    code, out, _ = run(ssh, certbot_cmd, timeout=600)
    if code != 0:
        print("Certbot for frontends did not complete — DNS may not be ready yet.")
        print("Re-run after DNS propagates:")
        print(f"  certbot --nginx {frontend_domains}")

    api_cert = "/etc/letsencrypt/live/api.cullinos.com/fullchain.pem"
    _, api_ssl, _ = run(ssh, f"test -f {api_cert} && echo has_ssl || echo no_ssl")
    if "no_ssl" in api_ssl:
        run(
            ssh,
            "certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email "
            "--redirect -d api.cullinos.com || true",
            timeout=300,
        )


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD or pass password as first argument.", file=sys.stderr)
        return 1

    secrets_path = ROOT / "secrets-export.txt"
    secrets = parse_secrets(secrets_path) if secrets_path.exists() else {}

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    ssh.connect(HOST, username=USER, password=password, timeout=30)

    print("Installing Docker, nginx, git...")
    run(
        ssh,
        "export DEBIAN_FRONTEND=noninteractive && "
        "apt-get update -qq && apt-get install -y -qq ca-certificates curl git nginx ufw openssl "
        "&& (command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh) "
        "&& systemctl enable --now docker nginx "
        "&& ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable",
        timeout=900,
    )

    print("Uploading project tarball...")
    tarball = make_tarball()
    sftp = ssh.open_sftp()
    run(ssh, f"mkdir -p {APP_DIR}")
    with sftp.file("/tmp/cullinos.tar.gz", "wb") as f:
        f.write(tarball)
    sftp.close()
    run(ssh, f"mkdir -p {APP_DIR} && test -f {APP_DIR}/.env && cp {APP_DIR}/.env /tmp/cullinos.env.bak || true")
    run(ssh, f"rm -rf {APP_DIR}/* && tar -xzf /tmp/cullinos.tar.gz -C {APP_DIR} && rm /tmp/cullinos.tar.gz")
    run(ssh, f"test -f /tmp/cullinos.env.bak && mv /tmp/cullinos.env.bak {APP_DIR}/.env || true")

    sftp = ssh.open_sftp()
    existing: dict[str, str] = {}
    _, env_check, _ = run(ssh, f"test -f {APP_DIR}/.env && echo exists || echo missing")
    if "exists" in env_check:
        try:
            with sftp.file(f"{APP_DIR}/.env", "r") as f:
                existing = read_env_values(f.read().decode("utf-8").splitlines())
        except FileNotFoundError:
            existing = {}

    updates = vm_env_updates(secrets, existing)
    new_pg_pw = updates["POSTGRES_PASSWORD"]
    old_pg_pw = existing.get("POSTGRES_PASSWORD", "")
    pg_password_changed = bool(old_pg_pw and new_pg_pw and old_pg_pw != new_pg_pw)

    if "exists" not in env_check:
        with sftp.file(f"{APP_DIR}/.env", "w") as f:
            f.write(build_env_content(updates))
        print("Created VM .env (Postgres + Redis on Docker, no external DB).")
    else:
        print("Preserving existing .env on server — syncing secrets and data service URLs.")
        patch_env_file(sftp, f"{APP_DIR}/.env", updates)
        print("Synced VM data services: DATABASE_URL, REDIS_URL, POSTGRES_PASSWORD")
        if any(k in updates for k in ("JWT_SECRET", "JWT_REFRESH_SECRET", "ENCRYPTION_KEY", "REVALIDATE_SECRET")):
            print("Synced auth/CMS secrets from secrets-export.txt")
    sftp.close()

    if pg_password_changed:
        reset_postgres_volume(ssh)

    print("Building and starting Docker stack (this may take several minutes)...")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build --no-cache api "
        f"&& docker compose -f docker-compose.prod.yml up -d postgres redis api",
        timeout=1800,
    )
    if code != 0:
        print("Docker build failed.", file=sys.stderr)
        return code

    print("Initializing database schema...")
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml stop api || true")
    run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
        "npx prisma db push --schema=packages/prisma/prisma/schema.prisma",
        timeout=600,
    )
    run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
        "npx tsx packages/prisma/prisma/seed.ts",
        timeout=600,
    )
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")

    print("Building frontends on VM (Node 22)...")
    run(
        ssh,
        "command -v node >/dev/null || "
        "(curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs)",
        timeout=600,
    )
    run(
        ssh,
        f"cd {APP_DIR} && npm ci --include=dev && bash scripts/build-frontends.sh",
        timeout=2400,
    )
    _, build_check, _ = run(ssh, f"test -d {APP_DIR}/dist-frontends/admin && echo ok || echo missing")
    if "missing" in build_check:
        print("Frontend build failed — dist-frontends not created.", file=sys.stderr)
        return 1
    run(
        ssh,
        f"mkdir -p /var/www/cullinos && cp -r {APP_DIR}/dist-frontends/* /var/www/cullinos/",
    )
    run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --build web",
        timeout=1200,
    )

    frontends_nginx = (ROOT / "infrastructure" / "nginx" / "cullinos-frontends.conf").read_text(
        encoding="utf-8"
    )
    sftp = ssh.open_sftp()
    with sftp.file("/etc/nginx/sites-available/cullinos-frontends.conf", "w") as f:
        f.write(frontends_nginx)
    sftp.close()

    print("Waiting for API...")
    for _ in range(36):
        c, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if '"status":"ok"' in out or '"status": "ok"' in out or ('"status":' in out and 'ok' in out):
            print("API healthy.")
            break
        time.sleep(10)
    else:
        print("API did not become healthy in time — check logs.", file=sys.stderr)
        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=80 api")

    nginx_conf_path = "/etc/nginx/sites-available/cullinos-api.conf"
    ssl_cert = "/etc/letsencrypt/live/api.cullinos.com/fullchain.pem"
    _, ssl_check, _ = run(ssh, f"test -f {ssl_cert} && echo has_ssl || echo no_ssl")

    if "has_ssl" in ssl_check:
        print("Restoring HTTPS nginx config (SSL cert present)...")
        nginx_ssl = (ROOT / "infrastructure" / "nginx" / "api.cullinos.com.conf").read_text(encoding="utf-8")
        sftp = ssh.open_sftp()
        run(ssh, "mkdir -p /var/www/certbot /etc/nginx/sites-available /etc/nginx/sites-enabled")
        with sftp.file(nginx_conf_path, "w") as f:
            f.write(nginx_ssl)
        sftp.close()
    else:
        print("Writing HTTP-only nginx config (certbot will upgrade after DNS)...")
        nginx_http = r"""server {
    listen 80 default_server;
    server_name api.cullinos.com in17906.onliveserver.com _;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
"""
        sftp = ssh.open_sftp()
        run(ssh, "mkdir -p /var/www/certbot /etc/nginx/sites-available /etc/nginx/sites-enabled")
        with sftp.file(nginx_conf_path, "w") as f:
            f.write(nginx_http)
        sftp.close()

    run(
        ssh,
        "rm -f /etc/nginx/sites-enabled/default "
        f"&& ln -sf {nginx_conf_path} /etc/nginx/sites-enabled/cullinos-api.conf "
        "&& ln -sf /etc/nginx/sites-available/cullinos-frontends.conf "
        "/etc/nginx/sites-enabled/cullinos-frontends.conf "
        "&& nginx -t && systemctl reload nginx",
    )

    print("Requesting SSL certificates (requires DNS pointing to this VM)...")
    run_certbot(ssh)
    run(ssh, "nginx -t && systemctl reload nginx")

    _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health")
    print("\n=== Deploy complete ===")
    print(f"API (internal): http://127.0.0.1:3000/api/v1/health")
    print(f"API (public): https://api.cullinos.com/api/v1/health")
    print(f"App directory: {APP_DIR}")
    print("Backend stack: API + Postgres + Redis (all on this VM).")
    print("Frontends: https://admin.cullinos.com, https://waiter.cullinos.com, etc.")
    if pg_password_changed:
        print("Database was reset with new POSTGRES_PASSWORD — demo seed restored.")
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
