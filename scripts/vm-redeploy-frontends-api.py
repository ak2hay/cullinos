#!/usr/bin/env python3
"""Upload current tree and rebuild/publish API + frontends + web."""
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_git import local_git_commit  # noqa: E402

GIT_COMMIT = local_git_commit()
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
    "build",
    ".dart_tool",
    ".gradle",
    ".idea",
}
EXCLUDE_FILES = {"secrets-export.txt", ".env"}


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


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:220]}{'...' if len(cmd) > 220 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        snippet = out[-5000:] if len(out) > 5000 else out
        sys.stdout.buffer.write((snippet + "\n").encode("utf-8", errors="replace"))
    if code != 0 and err.strip():
        snippet = err[-3000:] if len(err) > 3000 else err
        sys.stdout.buffer.write(("STDERR: " + snippet + "\n").encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()
    return code, out, err


def run_detached(
    ssh: paramiko.SSHClient,
    cmd: str,
    log_path: str,
    *,
    timeout_sec: int = 3600,
    poll_sec: int = 20,
) -> tuple[int, str]:
    """Run a long command under nohup and poll a log so idle SSH does not kill it."""
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
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD or pass password as first argument.", file=sys.stderr)
        return 1

    print("Packing project tarball (before SSH, to avoid idle disconnect)...", flush=True)
    tarball = make_tarball()
    print(f"Tarball size: {len(tarball) / 1_000_000:.1f} MB", flush=True)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...", flush=True)
    ssh.connect(HOST, username="root", password=password, timeout=30, banner_timeout=60)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)

    print("Uploading project tarball...", flush=True)
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos.tar.gz", "wb") as f:
        f.write(tarball)
    sftp.close()
    del tarball

    run(ssh, f"test -f {APP_DIR}/.env && cp {APP_DIR}/.env /tmp/cullinos.env.bak || true")
    run(ssh, f"rm -rf {APP_DIR}/* && tar -xzf /tmp/cullinos.tar.gz -C {APP_DIR} && rm /tmp/cullinos.tar.gz")
    run(ssh, f"test -f /tmp/cullinos.env.bak && mv /tmp/cullinos.env.bak {APP_DIR}/.env || true")

    # Keep email OTP skipped until SMTP is configured.
    run(
        ssh,
        f"grep -q '^AUTH_SKIP_EMAIL_OTP=' {APP_DIR}/.env && "
        f"sed -i 's/^AUTH_SKIP_EMAIL_OTP=.*/AUTH_SKIP_EMAIL_OTP=true/' {APP_DIR}/.env || "
        f"echo 'AUTH_SKIP_EMAIL_OTP=true' >> {APP_DIR}/.env; "
        f"grep -q '^NODE_ENV=' {APP_DIR}/.env || echo 'NODE_ENV=production' >> {APP_DIR}/.env; "
        f"grep -q '^CORS_ORIGINS=' {APP_DIR}/.env || "
        f"echo 'CORS_ORIGINS=https://admin.cullinos.com,https://manage.cullinos.com,https://platform.cullinos.com,https://guest.cullinos.com,https://pos.cullinos.com,https://kds.cullinos.com,https://kiosk.cullinos.com,https://cullinos.com' >> {APP_DIR}/.env",
    )

    print("Rebuilding API container from uploaded sources...", flush=True)
    code, log = run_detached(
        ssh,
        f"cd {APP_DIR} && GIT_COMMIT={GIT_COMMIT} docker compose -f docker-compose.prod.yml build api "
        f"&& docker compose -f docker-compose.prod.yml up -d postgres redis "
        f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate api",
        "/tmp/cullinos-api-build.log",
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

    print("Building frontends...", flush=True)
    run(ssh, f"sed -i 's/\\r$//' {APP_DIR}/scripts/build-frontends.sh")
    code, log = run_detached(
        ssh,
        f"cd {APP_DIR} && npm ci --include=dev && bash scripts/build-frontends.sh",
        "/tmp/cullinos-frontend-build.log",
        timeout_sec=3600,
        poll_sec=30,
    )
    if code != 0:
        print("Frontend build failed.", file=sys.stderr)
        print(log[-3000:], file=sys.stderr)
        return code

    _, check, _ = run(ssh, f"test -d {APP_DIR}/dist-frontends/admin && echo ok || echo missing")
    if "ok" not in check:
        print("dist-frontends/admin missing.", file=sys.stderr)
        return 1

    run(ssh, f"mkdir -p /var/www/cullinos && cp -r {APP_DIR}/dist-frontends/* /var/www/cullinos/")
    code, log = run_detached(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --build web",
        "/tmp/cullinos-web-build.log",
        timeout_sec=1800,
    )
    if code != 0:
        print("Web rebuild failed.", file=sys.stderr)
        print(log[-2000:], file=sys.stderr)
        return code
    run(ssh, "nginx -t && systemctl reload nginx")

    _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health")
    print("\n=== Frontend + API redeploy complete ===", flush=True)
    print(out.strip(), flush=True)
    print("OTP remains skipped (AUTH_SKIP_EMAIL_OTP=true).", flush=True)
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
