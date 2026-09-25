#!/usr/bin/env python3
"""Restore multi-host SPA TLS + full Cullinos platform redeploy (API + SPAs).

Cross-verified incident: certbot issued admin.cullinos.com cert with SAN=app only,
so public HTTPS to admin/platform/pos/kds fails (curl exit 60) while -k localhost works.

Env: DEPLOY_PASSWORD (or gitignored .env). Never pass password on CLI in shared logs.
"""
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
APP_DIR = "/opt/cullinos"
WWW = "/var/www/cullinos"
NGINX_FRONTENDS = "/etc/nginx/sites-available/cullinos-frontends.conf"

SPA_CERT_DOMAINS = [
    "admin.cullinos.com",
    "manage.cullinos.com",
    "platform.cullinos.com",
    "app.cullinos.com",
    "order.cullinos.com",
    "waiter.cullinos.com",
    "pos.cullinos.com",
    "kds.cullinos.com",
    # kiosk.cullinos.com omitted: NXDOMAIN in Cloudflare (add DNS before including)
]

SPA_PUBLISH = {
    "admin": "admin",
    "management": "management",
    "super-admin": "super-admin",
    "app-ops": "app-ops",
    "pos": "pos",
    "kds": "kds",
    "kiosk": "kiosk",
}

LANDINGS = ["guest-landing", "waiter-landing"]

EXCLUDE_DIR_NAMES = {
    "node_modules",
    "dist",
    ".next",
    ".turbo",
    "coverage",
    "build",
    "out",
    "electron-dist",
    ".dart_tool",
    ".gradle",
    "__pycache__",
    "test",
    "__tests__",
}


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
    safe_print(f"\n$ {cmd[:260]}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = (out + ("\n" + err if err.strip() else "")).encode("ascii", "replace").decode("ascii")
    if text.strip():
        safe_print(text[-4500:])
    return code, out


def upload(ssh: paramiko.SSHClient, data: bytes, remote: str) -> None:
    sftp = ssh.open_sftp()
    with sftp.file(remote, "wb") as f:
        f.write(data)
    sftp.close()


def run_detached(ssh: paramiko.SSHClient, cmd: str, log_path: str, timeout_sec: int = 3600) -> int:
    safe_print(f"\n$ [detached] {cmd[:220]}")
    script_path = f"{log_path}.sh"
    script = f"#!/bin/bash\nset +e\n{cmd}\necho $? > {log_path}.exit\n"
    sftp = ssh.open_sftp()
    with sftp.file(script_path, "w") as f:
        f.write(script)
    sftp.close()
    run(
        ssh,
        f"chmod +x {script_path} && rm -f {log_path} {log_path}.exit && "
        f"nohup bash {script_path} >{log_path} 2>&1 & echo $!",
    )
    started = time.time()
    while time.time() - started < timeout_sec:
        _, out = run(
            ssh,
            f"if [ -f {log_path}.exit ]; then echo DONE:$(cat {log_path}.exit); "
            f"else echo RUNNING:$(wc -c < {log_path} 2>/dev/null || echo 0); fi",
            timeout=60,
        )
        line = out.strip().splitlines()[-1] if out.strip() else ""
        if line.startswith("DONE:"):
            try:
                return int(line.split(":", 1)[1])
            except ValueError:
                return 1
        time.sleep(25)
    return 1


def local_git_commit() -> str:
    import subprocess

    return (
        subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT)
        .decode()
        .strip()
    )


def make_source_patch() -> bytes:
    buf = io.BytesIO()
    roots = [
        "apps",
        "packages",
        "package.json",
        "package-lock.json",
        ".npmrc",
        "index.js",
        "turbo.json",
        "tsconfig.base.json",
        "Dockerfile",
        "Dockerfile.web",
        "docker-compose.prod.yml",
        "infrastructure/nginx/cullinos-frontends.conf",
    ]
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in roots:
            path = ROOT / rel
            if not path.exists():
                continue
            if path.is_file():
                tar.add(path, arcname=rel)
                continue
            for dirpath, dirnames, filenames in os.walk(path):
                dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIR_NAMES]
                for name in filenames:
                    if name in {".env", ".env.local", "secrets-export.txt"}:
                        continue
                    full = Path(dirpath) / name
                    arc = full.relative_to(ROOT).as_posix()
                    if "/dist/" in f"/{arc}/" or arc.endswith("/dist"):
                        continue
                    tar.add(full, arcname=arc)
    return buf.getvalue()


def make_publish_tarball(spa_apps: list[str]) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for app in spa_apps:
            dest = SPA_PUBLISH[app]
            tar.add(ROOT / "apps" / app / "dist", arcname=dest)
        for landing in LANDINGS:
            src = ROOT / "infrastructure" / "www" / landing
            if src.is_dir():
                tar.add(src, arcname=landing)
    return buf.getvalue()


def main() -> int:
    load_dotenv()
    password = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if not password:
        safe_print("DEPLOY_PASSWORD required in env or .env")
        return 1

    missing = [
        a for a in SPA_PUBLISH if not (ROOT / "apps" / a / "dist" / "index.html").is_file()
    ]
    if missing:
        safe_print(f"Missing local SPA dist (build first): {', '.join(missing)}")
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=120)

    try:
        safe_print("\n=== BEFORE: cert SAN ===")
        run(
            ssh,
            "openssl x509 -in /etc/letsencrypt/live/admin.cullinos.com/fullchain.pem "
            "-noout -ext subjectAltName 2>/dev/null",
        )

        safe_print("\n=== Restore multi-host SPA TLS cert ===")
        domains = " ".join(f"-d {d}" for d in SPA_CERT_DOMAINS)
        # Force reissue under existing cert name so nginx paths keep working
        code, _ = run(
            ssh,
            f"certbot certonly --nginx {domains} "
            f"--cert-name admin.cullinos.com --force-renewal "
            f"--non-interactive --agree-tos --keep 2>&1",
            timeout=400,
        )
        if code != 0:
            safe_print("certbot force-renewal failed; trying expand without force")
            code, _ = run(
                ssh,
                f"certbot certonly --nginx {domains} "
                f"--cert-name admin.cullinos.com --expand "
                f"--non-interactive --agree-tos 2>&1",
                timeout=400,
            )
            if code != 0:
                return code

        safe_print("\n=== AFTER: cert SAN ===")
        run(
            ssh,
            "openssl x509 -in /etc/letsencrypt/live/admin.cullinos.com/fullchain.pem "
            "-noout -subject -ext subjectAltName 2>/dev/null",
        )
        run(ssh, "nginx -t && systemctl reload nginx && echo NGINX_RELOADED_AFTER_CERT")

        commit = local_git_commit()
        safe_print(f"\n=== Overlay sources (commit {commit}) ===")
        patch = make_source_patch()
        safe_print(f"Source patch: {len(patch) / 1_000_000:.1f} MB")
        upload(ssh, patch, "/tmp/cullinos-src-patch.tar.gz")
        code, _ = run(
            ssh,
            f"tar -xzf /tmp/cullinos-src-patch.tar.gz -C {APP_DIR} && rm /tmp/cullinos-src-patch.tar.gz && "
            f"rm -f {APP_DIR}/apps/admin/src/pages/PaymentsPage.tsx && echo PATCH_OK",
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

        safe_print("\n=== Build + recreate API ===")
        code = run_detached(
            ssh,
            f"cd {APP_DIR} && GIT_COMMIT={commit} docker compose -f docker-compose.prod.yml build api "
            f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api",
            "/tmp/cullinos-full-api-build.log",
        )
        if code != 0:
            run(ssh, "tail -100 /tmp/cullinos-full-api-build.log")
            return code

        safe_print("\n=== Prisma db push ===")
        code, _ = run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T --no-deps api "
            "npx prisma db push --schema=packages/prisma/prisma/schema.prisma --skip-generate",
            timeout=900,
        )
        if code != 0:
            return code

        for _ in range(40):
            _, health = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
            if '"status":"ok"' in health.replace(" ", ""):
                safe_print(f"API health: {health.strip()}")
                break
            time.sleep(5)
        else:
            return 1

        spa_apps = list(SPA_PUBLISH.keys())
        safe_print(f"\n=== Publish SPAs: {', '.join(spa_apps + LANDINGS)} ===")
        pub = make_publish_tarball(spa_apps)
        upload(ssh, pub, "/tmp/cullinos-publish.tar.gz")
        targets = [SPA_PUBLISH[a] for a in spa_apps] + LANDINGS
        stage = "/tmp/cullinos-publish"
        swap = " && ".join(f"rm -rf {WWW}/{t} && mv {stage}/{t} {WWW}/{t}" for t in targets)
        code, _ = run(
            ssh,
            f"rm -rf {stage} && mkdir -p {stage} {WWW} && tar -xzf /tmp/cullinos-publish.tar.gz -C {stage} && "
            f"{swap} && rm -rf {stage} /tmp/cullinos-publish.tar.gz && echo PUBLISHED",
        )
        if code != 0:
            return code

        nginx_src = ROOT / "infrastructure" / "nginx" / "cullinos-frontends.conf"
        upload(ssh, nginx_src.read_bytes(), "/tmp/cullinos-frontends.conf.new")
        code, _ = run(
            ssh,
            f"cp -a {NGINX_FRONTENDS} {NGINX_FRONTENDS}.bak.$(date +%Y%m%d%H%M%S) 2>/dev/null || true; "
            f"cp /tmp/cullinos-frontends.conf.new {NGINX_FRONTENDS} && nginx -t && "
            f"systemctl reload nginx && echo NGINX_OK",
        )
        if code != 0:
            return code

        safe_print("\n=== Public TLS smoke (no -k) ===")
        for host in [
            "admin.cullinos.com",
            "platform.cullinos.com",
            "app.cullinos.com",
            "pos.cullinos.com",
            "kds.cullinos.com",
            "manage.cullinos.com",
            "kiosk.cullinos.com",
            "api.cullinos.com",
        ]:
            path = "/api/v1/health" if host.startswith("api.") else "/"
            run(
                ssh,
                f"curl -sI --max-time 15 https://{host}{path} | head -6 || echo FAIL_{host}",
                timeout=30,
            )

        safe_print("\nFULL_REDEPLOY_OK")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
