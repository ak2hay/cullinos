#!/usr/bin/env python3
"""Upload OTP + POS layout patches and rebuild API + frontends."""
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

FILES = [
    "apps/api/src/modules/customers/customer-auth.controller.ts",
    "apps/api/src/modules/customers/phone-otp-request.util.ts",
    "apps/api/src/modules/sms/msg91.service.ts",
    "apps/api/src/modules/sms/msg91-widget.util.ts",
    "apps/customer/src/components/CustomerLoginModal.tsx",
    "apps/customer/src/lib/msg91-widget.ts",
    "apps/customer/src/lib/api.ts",
    "apps/admin/src/features/pos/CartSidebar.tsx",
    "apps/admin/src/features/pos/PortalPosPage.tsx",
    "apps/pos/src/components/pos/CartSidebar.tsx",
    "apps/pos/src/pages/PosPage.tsx",
]


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
    poll_sec: int = 25,
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
                    print(f"  … still building ({size} bytes log)", flush=True)
                    last_size = size
            except ValueError:
                print("  … still building", flush=True)

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
    with sftp.file("/tmp/cullinos-otp-pos-patch.tar.gz", "wb") as f:
        chunk = 64 * 1024
        for i in range(0, len(payload), chunk):
            f.write(payload[i : i + chunk])
    sftp.close()
    print("Uploaded patch", flush=True)

    code, _, _ = run(
        ssh,
        f"tar -xzf /tmp/cullinos-otp-pos-patch.tar.gz -C {APP_DIR} && "
        f"rm /tmp/cullinos-otp-pos-patch.tar.gz && "
        f"grep -n shouldFailPhoneOtpWhenUnsent "
        f"{APP_DIR}/apps/api/src/modules/customers/customer-auth.controller.ts | head -3 && "
        f"grep -n 'h-full min-h-0' {APP_DIR}/apps/admin/src/features/pos/CartSidebar.tsx | head -2",
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
        "/tmp/cullinos-api-otp-pos.log",
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

    print("Building frontends...", flush=True)
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
        print("Frontend build failed", file=sys.stderr)
        print(log[-3000:], file=sys.stderr)
        ssh.close()
        return code

    _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health")
    print("\n=== OTP + POS patch redeploy complete ===", flush=True)
    print(out.strip(), flush=True)
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
