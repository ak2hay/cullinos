#!/usr/bin/env python3
"""Upload skip-OTP auth changes, set AUTH_SKIP_EMAIL_OTP=true, rebuild API."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"

FILES = [
    "apps/api/src/common/cors.util.ts",
    "apps/api/src/modules/auth/auth.service.ts",
]


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:220]}{'...' if len(cmd) > 220 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        sys.stdout.buffer.write((out[-5000:] + "\n").encode("utf-8", errors="replace"))
        sys.stdout.buffer.flush()
    if code != 0 and err.strip():
        sys.stdout.buffer.write(("STDERR: " + err[-3000:] + "\n").encode("utf-8", errors="replace"))
        sys.stdout.buffer.flush()
    return code, out, err


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD or pass password as argv[1]", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...", flush=True)
    ssh.connect(HOST, username="root", password=password, timeout=30)

    sftp = ssh.open_sftp()
    for rel in FILES:
        local = ROOT / rel
        remote = f"{APP_DIR}/{rel}"
        remote_dir = remote.rsplit("/", 1)[0]
        run(ssh, f"mkdir -p {remote_dir}")
        with sftp.file(remote, "wb") as f:
            f.write(local.read_bytes())
        print(f"uploaded {rel}", flush=True)
    sftp.close()

    print("Ensuring AUTH_SKIP_EMAIL_OTP=true in VM .env...", flush=True)
    run(
        ssh,
        f"python3 - <<'PY'\n"
        f"from pathlib import Path\n"
        f"p = Path('{APP_DIR}/.env')\n"
        f"text = p.read_text() if p.exists() else ''\n"
        f"lines = text.splitlines()\n"
        f"key = 'AUTH_SKIP_EMAIL_OTP'\n"
        f"found = False\n"
        f"out = []\n"
        f"for line in lines:\n"
        f"    if line.startswith(key + '='):\n"
        f"        out.append(f'{{key}}=true')\n"
        f"        found = True\n"
        f"    else:\n"
        f"        out.append(line)\n"
        f"if not found:\n"
        f"    out.append(f'{{key}}=true')\n"
        f"p.write_text('\\n'.join(out) + '\\n')\n"
        f"print('AUTH_SKIP_EMAIL_OTP=true')\n"
        f"PY",
    )

    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build api "
        f"&& docker compose -f docker-compose.prod.yml up -d api",
        timeout=1800,
    )
    if code != 0:
        print("API rebuild failed", file=sys.stderr)
        ssh.close()
        return code

    for _ in range(24):
        _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if '"status":"ok"' in out or '"status": "ok"' in out:
            print("\n=== Skip email OTP enabled; API healthy ===", flush=True)
            ssh.close()
            return 0
        time.sleep(8)

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=50 api")
    ssh.close()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
