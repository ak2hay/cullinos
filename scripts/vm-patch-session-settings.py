#!/usr/bin/env python3
"""Selective patch deploy: API SMTP/MSG91 test + super-admin settings UI only."""
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
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"

# Session-scoped API patches (SMTP test email + MSG91 phone test behavior)
API_FILES = [
    "apps/api/src/modules/mail/mail.service.ts",
    "apps/api/src/modules/sms/msg91.service.ts",
    "apps/api/src/modules/super-admin/super-admin.controller.ts",
]


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> tuple[int, str, str]:
    safe_print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe_print(out[-8000:])
    if code != 0 and err.strip():
        safe_print("STDERR: " + err[-4000:])
    return code, out, err


def run_detached(
    ssh: paramiko.SSHClient,
    cmd: str,
    log_path: str,
    *,
    timeout_sec: int = 2400,
    poll_sec: int = 20,
) -> tuple[int, str]:
    safe_print(f"\n$ [detached] {cmd[:240]}{'...' if len(cmd) > 240 else ''}")
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
            _, log_out, _ = run(ssh, f"tail -n 60 {log_path} 2>/dev/null || true", timeout=60)
            return exit_code, log_out
        running = next((line for line in status.splitlines() if line.startswith("RUNNING:")), None)
        if running:
            try:
                size = int(running.split(":", 1)[1].strip())
                if size != last_size:
                    safe_print(f"  … still building ({size} bytes log)")
                    last_size = size
            except ValueError:
                safe_print("  … still building")

    run(ssh, f"tail -n 80 {log_path} 2>/dev/null || true", timeout=60)
    return 1, "detached command timed out"


def connect(password: str) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=60)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)
    safe_print("Connected")
    return ssh


def upload_api_patch(ssh: paramiko.SSHClient) -> int:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in API_FILES:
            path = ROOT / rel
            if not path.exists():
                safe_print(f"MISSING: {rel}")
                return 1
            tar.add(path, arcname=rel)
            safe_print(f"pack {rel}")
    data = buf.getvalue()
    safe_print(f"API patch tarball: {len(data) / 1024:.1f} KB")

    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos-api-patch.tar.gz", "wb") as f:
        f.write(data)
    sftp.close()

    code, _, _ = run(ssh, f"tar -xzf /tmp/cullinos-api-patch.tar.gz -C {APP_DIR} && rm /tmp/cullinos-api-patch.tar.gz")
    return code


def upload_super_admin_dist(ssh: paramiko.SSHClient) -> int:
    dist = ROOT / "apps" / "super-admin" / "dist"
    if not dist.is_dir():
        safe_print("Local apps/super-admin/dist missing — build locally first")
        return 1

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(dist, arcname="super-admin")
    data = buf.getvalue()
    safe_print(f"super-admin dist tarball: {len(data) / 1024:.1f} KB")

    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos-super-admin-dist.tar.gz", "wb") as f:
        f.write(data)
    sftp.close()

    code, _, _ = run(
        ssh,
        "rm -rf /var/www/cullinos/super-admin && mkdir -p /var/www/cullinos && "
        "tar -xzf /tmp/cullinos-super-admin-dist.tar.gz -C /var/www/cullinos && "
        "rm /tmp/cullinos-super-admin-dist.tar.gz && "
        "test -f /var/www/cullinos/super-admin/index.html && echo PUBLISHED",
    )
    return code


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD or pass password as argv[1]", file=sys.stderr)
        return 1

    report = {
        "api_files": API_FILES,
        "spa": "super-admin → /var/www/cullinos/super-admin",
        "skipped": ["admin", "customer", "pos", "waiter", "kds", "management", "web", "npm ci", "full tarball wipe"],
    }
    safe_print("=== Selective deploy plan ===")
    safe_print(f"API patch: {len(API_FILES)} files")
    safe_print(f"SPA: {report['spa']}")
    safe_print(f"Skipped: {', '.join(report['skipped'])}")

    ssh = connect(password)
    try:
        code = upload_api_patch(ssh)
        if code != 0:
            return code

        safe_print("\n=== Cached API rebuild ===")
        code, log = run_detached(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build api "
            f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api",
            "/tmp/cullinos-api-patch-build.log",
            timeout_sec=2400,
        )
        if code != 0:
            safe_print("API rebuild failed")
            safe_print(log[-3000:])
            return code

        health = ""
        for _ in range(36):
            _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
            if '"status":"ok"' in health or '"status": "ok"' in health:
                safe_print("API healthy")
                break
            time.sleep(5)
        else:
            run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=80 api")
            return 1

        safe_print("\n=== Publish super-admin SPA ===")
        code = upload_super_admin_dist(ssh)
        if code != 0:
            return code

        code, _, _ = run(ssh, "nginx -t && systemctl reload nginx")
        if code != 0:
            return code

        _, public_health, _ = run(ssh, "curl -sf https://api.cullinos.com/api/v1/health || true", timeout=30)

        safe_print("\n=== Selective redeploy complete ===")
        safe_print("Rebuilt: api (cached docker build, recreate api only)")
        safe_print("Published: /var/www/cullinos/super-admin (local vite build)")
        safe_print(f"Health (local): {health.strip()}")
        safe_print(f"Health (public): {public_health.strip()}")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
