#!/usr/bin/env python3
"""Finish selective deploy after API image already rebuilt (no api rebuild)."""
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

SPA_PUBLISH = {
    "admin": "admin",
    "customer": "customer",
    "pos": "pos",
    "waiter": "waiter",
    "kds": "kds",
    "super-admin": "super-admin",
    "app-ops": "app-ops",
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
}


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def load_password() -> str:
    return os.environ.get("DEPLOY_PASSWORD", "").strip() or (
        sys.argv[1].strip() if len(sys.argv) > 1 else ""
    )


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    safe_print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe_print(out[-4000:])
    if code != 0 and err.strip():
        safe_print("STDERR: " + err[-2000:])
    return code, out, err


def run_detached(
    ssh: paramiko.SSHClient,
    cmd: str,
    log_path: str,
    *,
    timeout_sec: int = 2400,
    poll_sec: int = 20,
) -> tuple[int, str]:
    safe_print(f"\n$ [detached] {cmd[:220]}{'...' if len(cmd) > 220 else ''}")
    script_path = f"{log_path}.sh"
    script = f"#!/bin/bash\nset +e\n{cmd}\necho $? > {log_path}.exit\n"
    sftp = ssh.open_sftp()
    with sftp.file(script_path, "w") as f:
        f.write(script)
    sftp.chmod(script_path, 0o755)
    sftp.close()
    run(ssh, f"rm -f {log_path} {log_path}.exit; nohup bash {script_path} >{log_path} 2>&1 & echo $!", timeout=30)
    deadline = time.time() + timeout_sec
    last = -1
    while time.time() < deadline:
        time.sleep(poll_sec)
        run(ssh, "true", timeout=30)
        _, status, _ = run(
            ssh,
            f"if test -f {log_path}.exit; then echo DONE:$(cat {log_path}.exit); "
            f"elif test -f {log_path}; then echo RUNNING:$(wc -c < {log_path}); else echo WAITING; fi; "
            f"tail -n 5 {log_path} 2>/dev/null || true",
            timeout=60,
        )
        done = next((line for line in status.splitlines() if line.startswith("DONE:")), None)
        if done is not None:
            try:
                code = int(done.split(":", 1)[1].strip())
            except ValueError:
                code = 1
            _, log_out, _ = run(ssh, f"tail -n 40 {log_path} 2>/dev/null || true", timeout=60)
            return code, log_out
        running = next((line for line in status.splitlines() if line.startswith("RUNNING:")), None)
        if running:
            try:
                size = int(running.split(":", 1)[1].strip())
                if size != last:
                    safe_print(f"  … still building ({size} bytes log)")
                    last = size
            except ValueError:
                pass
    return 1, "timed out"


def _tar_filter(ti: tarfile.TarInfo) -> tarfile.TarInfo | None:
    if any(p in EXCLUDE_DIR_NAMES for p in Path(ti.name).parts):
        return None
    return ti


def main() -> int:
    password = load_password()
    if not password:
        print("DEPLOY_PASSWORD required", file=sys.stderr)
        return 1

    spa_apps = [a for a in SPA_PUBLISH if (ROOT / "apps" / a / "dist" / "index.html").exists()]

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=90)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)

    try:
        # Ensure api is up (already rebuilt)
        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --no-deps api", timeout=120)

        safe_print("\n=== Prisma db push ===")
        code, _, _ = run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
            "npx prisma db push --schema=packages/prisma/prisma/schema.prisma",
            timeout=600,
        )
        if code != 0:
            return code

        health = ""
        for _ in range(36):
            _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
            if "ok" in health:
                break
            time.sleep(5)
        else:
            return 1

        _, banners, _ = run(
            ssh,
            "curl -s -o /dev/null -w '%{http_code}' "
            "http://127.0.0.1:3000/api/v1/public/marketplace/banners",
            timeout=30,
        )

        safe_print(f"\n=== Publish SPAs: {', '.join(spa_apps)} ===")
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            for app in spa_apps:
                dist = ROOT / "apps" / app / "dist"
                tar.add(dist, arcname=SPA_PUBLISH[app])
                safe_print(f"pack {app}/dist → {SPA_PUBLISH[app]}")
        data = buf.getvalue()
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/cullinos-spa-patch.tar.gz", "wb") as f:
            f.write(data)
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

        safe_print("\n=== Patch apps/web + rebuild web only ===")
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            tar.add(ROOT / "apps/web", arcname="apps/web", filter=_tar_filter)
        web_bytes = buf.getvalue()
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
            safe_print(log[-1500:])
            return code

        _, health2, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)

        safe_print("\n======== SELECTIVE DEPLOY REPORT ========")
        safe_print("Rebuilt earlier: api (cached docker compose build + force-recreate) — already done")
        safe_print("Schema: prisma db push")
        safe_print(f"Published SPAs: {', '.join(spa_apps)}")
        safe_print(f"Marketing web: {web_result}")
        safe_print(f"Health: {health2.strip() or health.strip()}")
        safe_print(f"Smoke banners HTTP: {banners.strip()}")
        safe_print("Skipped: wipe, npm ci, build-frontends.sh, --no-cache, management, Flutter")
        safe_print("=========================================")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
