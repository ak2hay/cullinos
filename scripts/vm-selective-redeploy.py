#!/usr/bin/env python3
"""Selective Cullinos prod deploy: patch sources → cached api build → publish only touched SPAs.

Does NOT wipe /opt/cullinos, does NOT run npm ci / build-frontends.sh for all apps,
does NOT use docker --no-cache.
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

# API / shared packages that affect the api image build context
API_PATCH_ROOTS = [
    "apps/api",
    "packages/prisma",
    "packages/shared",
    "packages/auth",
    "packages/tax-engine",
    "packages/database",
    "package.json",
    "package-lock.json",
    "index.js",
    "Dockerfile",
]

# SPA workspace → /var/www/cullinos/<dir>
SPA_PUBLISH = {
    "admin": "admin",
    "customer": "customer",
    "pos": "pos",
    "waiter": "waiter",
    "kds": "kds",
    "super-admin": "super-admin",
}

EXCLUDE_DIR_NAMES = {
    "node_modules",
    "dist",
    ".turbo",
    "coverage",
    "build",
    ".dart_tool",
    ".gradle",
    "android",
    "ios",
    "test",
    "__tests__",
}


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    if len(sys.argv) > 1:
        return sys.argv[1].strip()
    return ""


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    safe_print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe_print(out[-5000:])
    if code != 0 and err.strip():
        safe_print("STDERR: " + err[-3000:])
    return code, out, err


def run_detached(
    ssh: paramiko.SSHClient,
    cmd: str,
    log_path: str,
    *,
    timeout_sec: int = 2400,
    poll_sec: int = 15,
) -> tuple[int, str]:
    print(f"\n$ [detached] {cmd[:220]}{'...' if len(cmd) > 220 else ''}", flush=True)
    script_path = f"{log_path}.sh"
    script = f"#!/bin/bash\nset +e\n{cmd}\necho $? > {log_path}.exit\n"
    sftp = ssh.open_sftp()
    with sftp.file(script_path, "w") as f:
        f.write(script)
    sftp.chmod(script_path, 0o755)
    sftp.close()
    run(ssh, f"rm -f {log_path} {log_path}.exit; nohup bash {script_path} >{log_path} 2>&1 & echo $!", timeout=30)

    deadline = time.time() + timeout_sec
    last_size = -1
    while time.time() < deadline:
        time.sleep(poll_sec)
        run(ssh, "true", timeout=30)
        _, status, _ = run(
            ssh,
            f"if test -f {log_path}.exit; then echo DONE:$(cat {log_path}.exit); "
            f"elif test -f {log_path}; then echo RUNNING:$(wc -c < {log_path}); "
            f"else echo WAITING; fi; "
            f"tail -n 6 {log_path} 2>/dev/null || true",
            timeout=60,
        )
        done = next((line for line in status.splitlines() if line.startswith("DONE:")), None)
        if done is not None:
            try:
                exit_code = int(done.split(":", 1)[1].strip())
            except ValueError:
                exit_code = 1
            _, log_out, _ = run(ssh, f"tail -n 100 {log_path} 2>/dev/null || true", timeout=60)
            return exit_code, log_out
        running = next((line for line in status.splitlines() if line.startswith("RUNNING:")), None)
        if running:
            try:
                size = int(running.split(":", 1)[1].strip())
                if size != last_size:
                    print(f"  … still building ({size} bytes log)", flush=True)
                    last_size = size
            except ValueError:
                print("  … still building", flush=True)
    run(ssh, f"tail -n 80 {log_path} 2>/dev/null || true", timeout=60)
    return 1, "detached timed out"


def _tar_filter(ti: tarfile.TarInfo) -> tarfile.TarInfo | None:
    parts = Path(ti.name).parts
    if any(p in EXCLUDE_DIR_NAMES for p in parts):
        return None
    if ti.name.endswith(".map"):
        return None
    return ti


def make_api_patch() -> bytes:
    buf = io.BytesIO()
    packed: list[str] = []
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in API_PATCH_ROOTS:
            path = ROOT / rel
            if not path.exists():
                print(f"skip missing: {rel}", flush=True)
                continue
            tar.add(path, arcname=rel, filter=_tar_filter)
            packed.append(rel)
            print(f"pack {rel}", flush=True)
        # Include guest marketing migration specifically under prisma
        mig = ROOT / "packages/prisma/prisma/migrations"
        if mig.is_dir():
            tar.add(mig, arcname="packages/prisma/prisma/migrations", filter=_tar_filter)
    print(f"API patch roots: {', '.join(packed)}", flush=True)
    buf.seek(0)
    return buf.read()


def make_spa_tarball(apps: list[str]) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for app in apps:
            dist = ROOT / "apps" / app / "dist"
            if not dist.is_dir():
                raise FileNotFoundError(f"Missing dist for {app}: {dist}")
            www = SPA_PUBLISH[app]
            tar.add(dist, arcname=www)
            print(f"pack apps/{app}/dist -> {www}", flush=True)
    buf.seek(0)
    return buf.read()


def connect(password: str) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...", flush=True)
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=90)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)
    print("Connected.", flush=True)
    return ssh


def reconnect(password: str, old: paramiko.SSHClient | None = None) -> paramiko.SSHClient:
    if old:
        try:
            old.close()
        except Exception:
            pass
    print("Reconnecting SSH...", flush=True)
    return connect(password)


def main() -> int:
    password = load_password()
    if not password:
        print("DEPLOY_PASSWORD required", file=sys.stderr)
        return 1

    spa_apps = [a for a in SPA_PUBLISH if (ROOT / "apps" / a / "dist" / "index.html").exists()]
    if not spa_apps:
        print("No SPA dist folders found — build locally first.", file=sys.stderr)
        return 1

    include_web = os.environ.get("DEPLOY_WEB", "1") == "1"
    ssh = connect(password)

    try:
        # --- API patch overlay (no wipe) ---
        print("\n=== Patch API sources onto /opt/cullinos (no wipe) ===", flush=True)
        patch = make_api_patch()
        print(f"API patch tarball: {len(patch) / 1_000_000:.1f} MB", flush=True)
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/cullinos-api-patch.tar.gz", "wb") as f:
            f.write(patch)
        sftp.close()
        code, _, _ = run(
            ssh,
            f"tar -xzf /tmp/cullinos-api-patch.tar.gz -C {APP_DIR} && rm /tmp/cullinos-api-patch.tar.gz && "
            f"test -f {APP_DIR}/apps/api/src/modules/guest/guest.module.ts && echo PATCH_OK",
        )
        if code != 0:
            return code

        print("\n=== Cached docker build api + recreate ===", flush=True)
        code, log = run_detached(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build api "
            f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api",
            "/tmp/cullinos-selective-api-build.log",
            timeout_sec=2400,
        )
        if code != 0:
            print("API build/recreate failed", file=sys.stderr)
            print(log[-2000:], file=sys.stderr)
            return code

        print("\n=== Prisma schema sync (db push) ===", flush=True)
        # Keep API up; push via one-off container sharing network/env
        code, _, _ = run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T --no-deps api "
            "npx prisma db push --schema=packages/prisma/prisma/schema.prisma --skip-generate",
            timeout=600,
        )
        if code != 0:
            # Retry after brief wait / reconnect
            try:
                ssh = reconnect(password, ssh)
            except Exception as exc:
                print(f"reconnect failed: {exc}", file=sys.stderr)
            code, _, _ = run(
                ssh,
                f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
                "npx prisma db push --schema=packages/prisma/prisma/schema.prisma",
                timeout=600,
            )
            if code != 0:
                return code

        health_body = ""
        for _ in range(36):
            _, health_body, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
            if '"status":"ok"' in health_body.replace(" ", ""):
                print("API health OK", flush=True)
                break
            time.sleep(5)
        else:
            run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=80 api")
            return 1

        # Smoke guest marketing routes
        _, banners, _ = run(
            ssh,
            "curl -s -o /dev/null -w '%{http_code}' "
            "http://127.0.0.1:3000/api/v1/public/marketplace/banners",
            timeout=30,
        )

        # --- Publish SPAs built locally ---
        print(f"\n=== Publish SPAs: {', '.join(spa_apps)} ===", flush=True)
        spa_tar = make_spa_tarball(spa_apps)
        print(f"SPA tarball: {len(spa_tar) / 1000:.1f} KB", flush=True)
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/cullinos-spa-patch.tar.gz", "wb") as f:
            f.write(spa_tar)
        sftp.close()

        www_dirs = " ".join(f"/var/www/cullinos/{SPA_PUBLISH[a]}" for a in spa_apps)
        code, _, _ = run(
            ssh,
            f"mkdir -p /var/www/cullinos && rm -rf {www_dirs} && "
            f"tar -xzf /tmp/cullinos-spa-patch.tar.gz -C /var/www/cullinos && "
            f"rm /tmp/cullinos-spa-patch.tar.gz && nginx -t && systemctl reload nginx && echo SPA_PUBLISHED",
        )
        if code != 0:
            return code

        web_result = "skipped"
        if include_web:
            print("\n=== Patch apps/web + rebuild web container only ===", flush=True)
            buf = io.BytesIO()
            with tarfile.open(fileobj=buf, mode="w:gz") as tar:
                web = ROOT / "apps/web"
                tar.add(web, arcname="apps/web", filter=_tar_filter)
            buf.seek(0)
            web_bytes = buf.read()
            sftp = ssh.open_sftp()
            with sftp.file("/tmp/cullinos-web-patch.tar.gz", "wb") as f:
                f.write(web_bytes)
            sftp.close()
            run(ssh, f"tar -xzf /tmp/cullinos-web-patch.tar.gz -C {APP_DIR} && rm /tmp/cullinos-web-patch.tar.gz")
            code, log = run_detached(
                ssh,
                f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build web "
                f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps web",
                "/tmp/cullinos-selective-web-build.log",
                timeout_sec=2400,
            )
            web_result = "rebuilt" if code == 0 else f"FAILED({code})"
            if code != 0:
                print(log[-2000:], file=sys.stderr)
                return code

        print("\n======== SELECTIVE DEPLOY REPORT ========", flush=True)
        print("Rebuilt: api (cached docker compose build + force-recreate)", flush=True)
        print(f"Schema: prisma db push", flush=True)
        print(f"Published SPAs: {', '.join(spa_apps)} → /var/www/cullinos/<app>/", flush=True)
        print(f"Marketing web: {web_result}", flush=True)
        print(f"Health: {health_body.strip()}", flush=True)
        print(f"Smoke banners HTTP: {banners.strip()}", flush=True)
        print("Skipped: full tarball wipe, npm ci, build-frontends.sh, --no-cache, Flutter guest, management", flush=True)
        print("=========================================", flush=True)
        return 0
    finally:
        try:
            ssh.close()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
