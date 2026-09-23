#!/usr/bin/env python3
"""Upload sources and rebuild only the production API (guest module + schema)."""
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
    "build",
    ".dart_tool",
    ".gradle",
}
EXCLUDE_FILES = {"secrets-export.txt", ".env"}
# API deploy does not need mobile app trees (avoids locked Flutter/Gradle files).
SKIP_TOP_LEVEL = EXCLUDE_DIRS | EXCLUDE_FILES | {"apps/guest"}


def load_deploy_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    for name in (".env", ".env.production", ".env.local"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("DEPLOY_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def _tar_filter(ti: tarfile.TarInfo) -> tarfile.TarInfo | None:
    parts = Path(ti.name).parts
    if any(p in EXCLUDE_DIRS for p in parts):
        return None
    if len(parts) >= 2 and parts[0] == "apps" and parts[1] == "guest":
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
            if item.name == "guest" and False:
                continue
            try:
                tar.add(item, arcname=item.name, filter=_tar_filter)
            except PermissionError as exc:
                print(f"skip unreadable: {exc}", flush=True)
    buf.seek(0)
    return buf.read()


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:220]}{'...' if len(cmd) > 220 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        snippet = out[-4000:] if len(out) > 4000 else out
        sys.stdout.buffer.write((snippet + "\n").encode("utf-8", errors="replace"))
    if code != 0 and err.strip():
        snippet = err[-2000:] if len(err) > 2000 else err
        sys.stdout.buffer.write(("STDERR: " + snippet + "\n").encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()
    return code, out, err


def run_detached(
    ssh: paramiko.SSHClient,
    cmd: str,
    log_path: str,
    *,
    timeout_sec: int = 2400,
    poll_sec: int = 20,
) -> tuple[int, str]:
    print(f"\n$ [detached] {cmd[:220]}{'...' if len(cmd) > 220 else ''}", flush=True)
    script_path = f"{log_path}.sh"
    script = f"#!/bin/bash\nset +e\n{cmd}\necho $? > {log_path}.exit\n"
    sftp = ssh.open_sftp()
    with sftp.file(script_path, "w") as f:
        f.write(script)
    sftp.chmod(script_path, 0o755)
    sftp.close()

    code, out, err = run(
        ssh,
        f"rm -f {log_path} {log_path}.exit; nohup bash {script_path} >{log_path} 2>&1 & echo $!",
        timeout=30,
    )
    if code != 0:
        return code, err or out

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
            f"tail -n 8 {log_path} 2>/dev/null || true",
            timeout=60,
        )
        done_line = next((line for line in status.splitlines() if line.startswith("DONE:")), None)
        if done_line is not None:
            try:
                exit_code = int(done_line.split(":", 1)[1].strip())
            except ValueError:
                exit_code = 1
            _, log_out, _ = run(ssh, f"tail -n 80 {log_path} 2>/dev/null || true", timeout=60)
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

    run(ssh, f"tail -n 100 {log_path} 2>/dev/null || true", timeout=60)
    return 1, "detached command timed out"


def main() -> int:
    password = load_deploy_password()
    if not password:
        print("DEPLOY_PASSWORD not found in env or .env files.", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...", flush=True)
    ssh.connect(HOST, username="root", password=password, timeout=30, banner_timeout=60)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)

    print("Uploading project tarball...", flush=True)
    tarball = make_tarball()
    print(f"Tarball size: {len(tarball) / 1_000_000:.1f} MB", flush=True)
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos.tar.gz", "wb") as f:
        f.write(tarball)
    sftp.close()

    run(ssh, f"test -f {APP_DIR}/.env && cp {APP_DIR}/.env /tmp/cullinos.env.bak || true")
    run(ssh, f"rm -rf {APP_DIR}/* && tar -xzf /tmp/cullinos.tar.gz -C {APP_DIR} && rm /tmp/cullinos.tar.gz")
    run(ssh, f"test -f /tmp/cullinos.env.bak && mv /tmp/cullinos.env.bak {APP_DIR}/.env || true")

    print("Rebuilding API container...", flush=True)
    code, log = run_detached(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build api "
        f"&& docker compose -f docker-compose.prod.yml up -d postgres redis "
        f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate api",
        "/tmp/cullinos-guest-api-build.log",
        timeout_sec=2400,
    )
    if code != 0:
        print("API rebuild failed.", file=sys.stderr)
        print(log[-3000:], file=sys.stderr)
        return code

    print("Syncing Prisma schema...", flush=True)
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml stop api || true")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
        "npx prisma db push --schema=packages/prisma/prisma/schema.prisma --accept-data-loss=false",
        timeout=600,
    )
    if code != 0:
        code, _, _ = run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
            "npx prisma db push --schema=packages/prisma/prisma/schema.prisma",
            timeout=600,
        )
    if code != 0:
        return code
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")

    for _ in range(36):
        _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if "ok" in health:
            print("API healthy.", flush=True)
            break
        time.sleep(5)
    else:
        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=100 api")
        return 1

    _, cfg_code, _ = run(
        ssh,
        "curl -s -o /dev/null -w '%{http_code}' "
        "http://127.0.0.1:3000/api/v1/public/marketplace/app-config",
        timeout=30,
    )
    _, banners_code, _ = run(
        ssh,
        "curl -s -o /dev/null -w '%{http_code}' "
        "http://127.0.0.1:3000/api/v1/public/marketplace/banners",
        timeout=30,
    )
    _, offers_code, _ = run(
        ssh,
        "curl -s -o /dev/null -w '%{http_code}' "
        "http://127.0.0.1:3000/api/v1/public/marketplace/offers",
        timeout=30,
    )
    _, otp_code, _ = run(
        ssh,
        "curl -s -o /dev/null -w '%{http_code}' -X POST "
        "http://127.0.0.1:3000/api/v1/public/guest/auth/otp/request "
        "-H 'Content-Type: application/json' -d '{\"phone\":\"\"}'",
        timeout=30,
    )
    print(
        f"Smoke app-config HTTP {cfg_code.strip()} | banners HTTP {banners_code.strip()} | "
        f"offers HTTP {offers_code.strip()} | otp/request HTTP {otp_code.strip()}",
        flush=True,
    )
    if cfg_code.strip() == "404" or banners_code.strip() == "404":
        print("Guest marketplace still returning 404.", file=sys.stderr)
        return 1

    print("\n=== Guest API deploy complete ===", flush=True)
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
