#!/usr/bin/env python3
"""Patch + rebuild API for Waiter MSG91 Widget phone OTP."""
from __future__ import annotations

import io
import os
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST") or sys.exit("Set DEPLOY_HOST explicitly (no default target).")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"

FILES = [
    "apps/api/src/modules/auth/auth.service.ts",
    "apps/api/src/modules/auth/auth.controller.ts",
    "apps/api/src/modules/guest/guest.service.ts",
    "apps/api/src/modules/sms/msg91.service.ts",
    "apps/api/src/modules/sms/msg91-widget-messages.ts",
    "apps/api/src/modules/platform-config/platform-config.registry.ts",
    "apps/api/src/modules/customers/phone-otp-request.util.ts",
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
            _, log_out, _ = run(ssh, f"tail -n 80 {log_path} 2>/dev/null || true", timeout=60)
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

    run(ssh, f"tail -n 100 {log_path} 2>/dev/null || true", timeout=60)
    return 1, "detached command timed out"


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD or pass password as argv[1]", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...", flush=True)
    ssh.connect(HOST, username="root", password=password, timeout=30, banner_timeout=60)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(15)
    print("Connected", flush=True)

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in FILES:
            path = ROOT / rel
            if not path.exists():
                print(f"MISSING local file: {rel}", file=sys.stderr)
                return 1
            tar.add(path, arcname=rel)
            print(f"pack {rel}", flush=True)
    payload = buf.getvalue()
    print(f"Patch size: {len(payload) / 1000:.1f} KB", flush=True)

    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos-waiter-widget-otp.tar.gz", "wb") as f:
        chunk = 64 * 1024
        for i in range(0, len(payload), chunk):
            f.write(payload[i : i + chunk])
    sftp.close()
    print("Uploaded patch", flush=True)

    code, _, _ = run(
        ssh,
        f"tar -xzf /tmp/cullinos-waiter-widget-otp.tar.gz -C {APP_DIR} && "
        f"rm /tmp/cullinos-waiter-widget-otp.tar.gz && "
        f"grep -n widget-send {APP_DIR}/apps/api/src/modules/auth/auth.controller.ts | head -5 && "
        f"test -f {APP_DIR}/apps/api/src/modules/sms/msg91-widget-messages.ts && echo MESSAGES_OK",
    )
    if code != 0:
        ssh.close()
        return code

    print("Rebuilding API...", flush=True)
    code, log = run_detached(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build api && "
        f"docker rm -f cullinos-api $(docker ps -aq --filter name=cullinos-api) 2>/dev/null || true; "
        f"docker compose -f docker-compose.prod.yml up -d api",
        "/tmp/cullinos-waiter-widget-otp-api.log",
        timeout_sec=2400,
    )
    if code != 0:
        print("API rebuild failed", file=sys.stderr)
        print(log[-3000:], file=sys.stderr)
        ssh.close()
        return code

    for _ in range(36):
        _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if "ok" in health:
            print("API healthy", flush=True)
            break
        time.sleep(5)
    else:
        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=80 api")
        ssh.close()
        return 1

    _, public_health, _ = run(
        ssh, "curl -sf https://api.cullinos.com/api/v1/health || true", timeout=30
    )
    safe_print(f"Public health: {public_health.strip()}")
    ssh.close()
    print("\n=== Waiter Widget OTP API redeploy complete ===", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
