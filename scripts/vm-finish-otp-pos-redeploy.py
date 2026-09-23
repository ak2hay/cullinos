#!/usr/bin/env python3
"""Finish OTP+POS redeploy after API image build (resolve container conflict + frontends)."""
from __future__ import annotations

import os
import sys
import time

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"


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
        safe_print(out[-6000:])
    if code != 0 and err.strip():
        safe_print("STDERR: " + err[-3000:])
    return code, out, err


def run_detached(
    ssh: paramiko.SSHClient,
    cmd: str,
    log_path: str,
    *,
    timeout_sec: int = 3600,
    poll_sec: int = 30,
) -> tuple[int, str]:
    safe_print(f"\n$ [detached] {cmd[:220]}{'...' if len(cmd) > 220 else ''}")
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
            f"tail -n 6 {log_path} 2>/dev/null || true",
            timeout=60,
        )
        done_line = next((line for line in status.splitlines() if line.startswith("DONE:")), None)
        if done_line is not None:
            try:
                exit_code = int(done_line.split(":", 1)[1].strip())
            except ValueError:
                exit_code = 1
            _, log_out, _ = run(ssh, f"tail -n 100 {log_path} 2>/dev/null || true", timeout=60)
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
        print("password required", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=30, banner_timeout=60)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(15)
    safe_print("Connected")

    safe_print("Cleaning container name conflicts and starting API...")
    run(
        ssh,
        "docker rm -f 9b88dd39c2fa_cullinos-api 514acb69df20d84bc21c304acea8e8909397c4011bf54336ae3e63a33ed8824b "
        "$(docker ps -aq --filter name=cullinos-api) 2>/dev/null || true",
        timeout=120,
    )
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --force-recreate api",
        timeout=300,
    )
    if code != 0:
        # last resort: compose down api + up
        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml stop api || true")
        run(ssh, "docker rm -f cullinos-api $(docker ps -aq --filter name=cullinos-api) 2>/dev/null || true")
        code, _, _ = run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api",
            timeout=300,
        )
        if code != 0:
            ssh.close()
            return code

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

    safe_print("Building frontends...")
    run(ssh, f"sed -i 's/\\r$//' {APP_DIR}/scripts/build-frontends.sh")
    code, log = run_detached(
        ssh,
        f"cd {APP_DIR} && npm ci --include=dev && bash scripts/build-frontends.sh && "
        f"mkdir -p /var/www/cullinos && cp -r dist-frontends/* /var/www/cullinos/ && "
        f"nginx -t && systemctl reload nginx",
        "/tmp/cullinos-fe-otp-pos.log",
        timeout_sec=3600,
        poll_sec=30,
    )
    if code != 0:
        safe_print("Frontend build failed")
        safe_print(log[-3000:])
        ssh.close()
        return code

    _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health")
    safe_print("\n=== OTP + POS redeploy complete ===")
    safe_print(out.strip())
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
