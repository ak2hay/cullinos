#!/usr/bin/env python3
"""Check remote build status and complete deploy with fresh SSH sessions."""
from __future__ import annotations

import os
import sys
import time

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"


def connect() -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=PASSWORD, timeout=30, banner_timeout=60)
    t = ssh.get_transport()
    if t:
        t.set_keepalive(15)
    return ssh


def run(cmd: str, timeout: int = 300) -> tuple[int, str]:
    ssh = connect()
    try:
        _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        text = (out + err).strip()
        return code, text
    finally:
        ssh.close()


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("password required", file=sys.stderr)
        return 1

    os.environ["DEPLOY_PASSWORD"] = password

    # Ensure API image includes latest patch (rebuild if needed)
    safe_print("Checking server patch markers...")
    code, text = run(
        f"grep -c 'fallbackPhone' "
        f"{APP_DIR}/apps/api/src/modules/customers/customer-auth.controller.ts 2>/dev/null || echo 0"
    )
    if "0" in text.splitlines()[-1:] or code != 0:
        safe_print("Patch missing on server — re-run vm-redeploy-otp-pos.py")
        return 1

    safe_print("Rebuilding API (detached on server)...")
    run(
        f"nohup bash -c 'cd {APP_DIR} && docker compose -f docker-compose.prod.yml build api && "
        f"docker rm -f cullinos-api 2>/dev/null; docker compose -f docker-compose.prod.yml up -d api' "
        f">/tmp/cullinos-api-final.log 2>&1 &",
        timeout=30,
    )

    for i in range(40):
        time.sleep(15)
        code, text = run(
            "if test -f /tmp/cullinos-api-final.log && grep -q 'Started\\|Running\\|done' /tmp/cullinos-api-final.log 2>/dev/null; "
            "then tail -n 3 /tmp/cullinos-api-final.log; fi; "
            "curl -sf http://127.0.0.1:3000/api/v1/health || echo not_ready",
            timeout=60,
        )
        safe_print(f"[{i+1}] {text[-400:]}")
        if "ok" in text and "not_ready" not in text.splitlines()[-1]:
            break
    else:
        safe_print("API did not become healthy")
        return 1

    safe_print("Building frontends (detached on server)...")
    run(
        f"nohup bash -c 'cd {APP_DIR} && npm ci --include=dev && bash scripts/build-frontends.sh && "
        f"mkdir -p /var/www/cullinos && cp -r dist-frontends/* /var/www/cullinos/ && "
        f"nginx -t && systemctl reload nginx' >/tmp/cullinos-fe-final.log 2>&1 &",
        timeout=30,
    )

    for i in range(80):
        time.sleep(20)
        code, text = run(
            "if test -f /tmp/cullinos-fe-final.log.exit; then echo DONE; "
            "elif grep -q 'Frontend bundles ready' /tmp/cullinos-fe-final.log 2>/dev/null; then echo DONE; "
            "else echo RUNNING; fi; tail -n 4 /tmp/cullinos-fe-final.log 2>/dev/null || true",
            timeout=60,
        )
        safe_print(f"[fe {i+1}] {text[-500:]}")
        if "DONE" in text.splitlines()[0:1] or "Frontend bundles ready" in text:
            break
    else:
        safe_print("Frontend build timed out")
        return 1

    _, health = run("curl -sf http://127.0.0.1:3000/api/v1/health")
    safe_print("\n=== Deploy complete ===")
    safe_print(health)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
