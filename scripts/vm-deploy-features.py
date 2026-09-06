#!/usr/bin/env python3
"""Incremental prod deploy: upload repo tarball, rebuild API + frontends, db push. No apt/certbot."""
from __future__ import annotations

import io
import os
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

EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    "dist",
    "dist-frontends",
    ".turbo",
    ".next",
    "electron-dist",
    "playwright-report",
    "test-results",
    "coverage",
    "agent-transcripts",
    "terminals",
}
EXCLUDE_FILES = {"secrets-export.txt", ".env"}


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 2400) -> tuple[int, str, str]:
    safe_print(f"\n$ {cmd[:220]}{'...' if len(cmd) > 220 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe_print(out[-8000:])
    if code != 0 and err.strip():
        safe_print("STDERR: " + err[-4000:])
    return code, out, err


def _tar_filter(ti: tarfile.TarInfo) -> tarfile.TarInfo | None:
    parts = Path(ti.name).parts
    if any(p in EXCLUDE_DIRS for p in parts):
        return None
    if Path(ti.name).name in EXCLUDE_FILES:
        return None
    return ti


def make_tarball() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for item in ROOT.iterdir():
            if item.name in EXCLUDE_DIRS or item.name in EXCLUDE_FILES:
                continue
            tar.add(item, arcname=item.name, filter=_tar_filter)
    buf.seek(0)
    return buf.read()


def connect(password: str) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to {USER}@{HOST}...")
    ssh.connect(HOST, username=USER, password=password, timeout=60, banner_timeout=60)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)
    safe_print("Connected")
    return ssh


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD or pass password as argv[1]", file=sys.stderr)
        return 1

    safe_print("Building local tarball...")
    tarball = make_tarball()
    safe_print(f"Tarball size: {len(tarball) / 1_000_000:.1f} MB")

    ssh = connect(password)

    safe_print("Uploading tarball via SFTP...")
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos.tar.gz", "wb") as f:
        f.write(tarball)
    sftp.close()
    safe_print("Upload complete")

    code, _, _ = run(
        ssh,
        f"test -f {APP_DIR}/.env && cp {APP_DIR}/.env /tmp/cullinos.env.bak || true; "
        f"mkdir -p {APP_DIR} && rm -rf {APP_DIR}/* && "
        f"tar -xzf /tmp/cullinos.tar.gz -C {APP_DIR} && rm /tmp/cullinos.tar.gz && "
        f"test -f /tmp/cullinos.env.bak && mv /tmp/cullinos.env.bak {APP_DIR}/.env || true",
        timeout=300,
    )
    if code != 0:
        ssh.close()
        return code

    safe_print("\n=== Rebuild API ===")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build api "
        f"&& docker compose -f docker-compose.prod.yml up -d postgres redis api",
        timeout=2400,
    )
    if code != 0:
        ssh.close()
        return code

    safe_print("\n=== Sync schema (db push) ===")
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml stop api || true")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
        "npx prisma db push --schema=packages/prisma/prisma/schema.prisma --accept-data-loss=false",
        timeout=600,
    )
    if code != 0:
        # fallback without accept-data-loss flag if unsupported
        code, _, _ = run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
            "npx prisma db push --schema=packages/prisma/prisma/schema.prisma",
            timeout=600,
        )
    if code != 0:
        ssh.close()
        return code

    run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T "
        "-e SEED_DEMO=false -e NODE_ENV=production api "
        "npx tsx packages/prisma/prisma/seed.ts",
        timeout=600,
    )
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")

    for _ in range(36):
        _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if "ok" in health:
            safe_print("API healthy")
            break
        time.sleep(5)
    else:
        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=80 api")
        ssh.close()
        return 1

    safe_print("\n=== Build frontends ===")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && npm ci --include=dev && bash scripts/build-frontends.sh",
        timeout=2400,
    )
    if code != 0:
        ssh.close()
        return code

    _, build_check, _ = run(ssh, f"test -d {APP_DIR}/dist-frontends/admin && echo ok || echo missing")
    if "missing" in build_check:
        safe_print("Frontend build missing dist-frontends/admin")
        ssh.close()
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

    # Refresh nginx frontends config if present
    conf = ROOT / "infrastructure" / "nginx" / "cullinos-frontends.conf"
    if conf.exists():
        sftp = ssh.open_sftp()
        with sftp.file("/etc/nginx/sites-available/cullinos-frontends.conf", "w") as f:
            f.write(conf.read_text(encoding="utf-8"))
        sftp.close()
        run(
            ssh,
            "ln -sf /etc/nginx/sites-available/cullinos-frontends.conf "
            "/etc/nginx/sites-enabled/cullinos-frontends.conf && nginx -t && systemctl reload nginx",
        )

    _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health")
    safe_print("\n=== Deploy complete ===")
    safe_print(out.strip())
    safe_print("Admin: https://admin.cullinos.com")
    safe_print("Platform: https://platform.cullinos.com")
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
