#!/usr/bin/env python3
"""Upload fixed admin PaymentsPage and finish frontend build/publish on VM."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APP_DIR = "/opt/cullinos"
UPLOAD_FILES = [
    (
        ROOT / "apps" / "admin" / "src" / "pages" / "PaymentsPage.tsx",
        f"{APP_DIR}/apps/admin/src/pages/PaymentsPage.tsx",
    ),
    (
        ROOT / "apps" / "admin" / "vite.config.ts",
        f"{APP_DIR}/apps/admin/vite.config.ts",
    ),
    (
        ROOT / "apps" / "customer" / "vite.config.ts",
        f"{APP_DIR}/apps/customer/vite.config.ts",
    ),
]


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    if len(sys.argv) > 1:
        return sys.argv[1].strip()
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("DEPLOY_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


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
            f"tail -n 10 {log_path} 2>/dev/null || true",
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

    run(ssh, f"tail -n 120 {log_path} 2>/dev/null || true", timeout=60)
    return 1, "detached command timed out"


def main() -> int:
    password = load_password()
    if not password:
        print("DEPLOY_PASSWORD required", file=sys.stderr)
        return 1
    for local, _remote in UPLOAD_FILES:
        if not local.exists():
            print(f"Missing {local}", file=sys.stderr)
            return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...", flush=True)
    ssh.connect(HOST, username="root", password=password, timeout=30, banner_timeout=60)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)

    sftp = ssh.open_sftp()
    for local, remote in UPLOAD_FILES:
        print(f"Uploading {local.relative_to(ROOT)}...", flush=True)
        sftp.put(str(local), remote)
    sftp.close()

    print("Building frontends...", flush=True)
    run(ssh, f"sed -i 's/\\r$//' {APP_DIR}/scripts/build-frontends.sh")
    code, log = run_detached(
        ssh,
        f"cd {APP_DIR} && bash scripts/build-frontends.sh",
        "/tmp/cullinos-frontend-build2.log",
        timeout_sec=3600,
        poll_sec=30,
    )
    if code != 0:
        print("Frontend build failed.", file=sys.stderr)
        print(log[-4000:], file=sys.stderr)
        return code

    _, check, _ = run(ssh, f"test -d {APP_DIR}/dist-frontends/admin && echo ok || echo missing")
    if "ok" not in check:
        print("dist-frontends/admin missing.", file=sys.stderr)
        return 1

    run(ssh, f"mkdir -p /var/www/cullinos && cp -r {APP_DIR}/dist-frontends/* /var/www/cullinos/")
    code, log = run_detached(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --build web",
        "/tmp/cullinos-web-build2.log",
        timeout_sec=1800,
    )
    if code != 0:
        print("Web rebuild failed.", file=sys.stderr)
        print(log[-2000:], file=sys.stderr)
        return code

    run(ssh, "nginx -t && systemctl reload nginx")
    _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health")
    print("\n=== Frontend publish complete ===", flush=True)
    print(out.strip(), flush=True)
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
