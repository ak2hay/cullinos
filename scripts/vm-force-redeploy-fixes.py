#!/usr/bin/env python3
"""Force-upload patched files, rebuild API with --no-cache, rebuild frontends."""
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
    "apps/api/src/modules/menu/menu.service.ts",
    "apps/api/src/modules/menu/menu.controller.ts",
    "apps/admin/src/lib/api.ts",
    "apps/admin/src/components/layout/OutletSelector.tsx",
    "apps/admin/src/pages/TablesPage.tsx",
]


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 2400) -> tuple[int, str, str]:
    safe_print(f"\n$ {cmd[:220]}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe_print(out[-6000:])
    if code != 0 and err.strip():
        safe_print("STDERR: " + err[-3000:])
    return code, out, err


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("password required", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=30)
    safe_print("Connected")

    sftp = ssh.open_sftp()
    for rel in FILES:
        local = ROOT / rel
        remote = f"{APP_DIR}/{rel}"
        data = local.read_bytes()
        # ensure parent exists
        remote_dir = remote.rsplit("/", 1)[0]
        run(ssh, f"mkdir -p {remote_dir}")
        with sftp.file(remote, "wb") as f:
            f.write(data)
        safe_print(f"uploaded {rel} ({len(data)} bytes)")
    sftp.close()

    code, out, _ = run(
        ssh,
        f"grep -c withPaisePrice {APP_DIR}/apps/api/src/modules/menu/menu.service.ts; "
        f"grep -c stillValid {APP_DIR}/apps/admin/src/components/layout/OutletSelector.tsx",
    )
    if "0" in out.splitlines()[:1]:
        safe_print("WARNING: marker not found after upload")

    safe_print("\n=== Rebuild API (--no-cache) ===")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build --no-cache api "
        f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate api",
        timeout=2400,
    )
    if code != 0:
        return code

    for _ in range(30):
        _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if "ok" in health:
            safe_print("API healthy")
            break
        time.sleep(5)
    else:
        return 1

    # Verify running container has the fix
    run(
        ssh,
        "docker compose -f /opt/cullinos/docker-compose.prod.yml exec -T api "
        "grep -c withPaisePrice apps/api/src/modules/menu/menu.service.ts || "
        "docker compose -f /opt/cullinos/docker-compose.prod.yml exec -T api "
        "sh -c 'find /app -name menu.service.js | head -5'",
    )

    safe_print("\n=== Rebuild frontends ===")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && sed -i 's/\\r$//' scripts/build-frontends.sh && bash scripts/build-frontends.sh",
        timeout=2400,
    )
    if code != 0:
        return code

    run(
        ssh,
        f"mkdir -p /var/www/cullinos && cp -r {APP_DIR}/dist-frontends/* /var/www/cullinos/ && "
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --build web",
        timeout=1200,
    )

    # Razorpay status
    run(
        ssh,
        "python3 -c \""
        "from pathlib import Path;"
        "vals={};"
        f"p=Path('{APP_DIR}/.env');"
        "[vals.__setitem__(k.strip(), v.strip().strip(chr(34)).strip(chr(39))) "
        "for line in p.read_text().splitlines() if '=' in line and not line.strip().startswith('#') "
        "for k,v in [line.split('=',1)]];"
        "print('RAZORPAY_KEY_ID=' + ('set' if vals.get('RAZORPAY_KEY_ID') else 'empty'));"
        "print('RAZORPAY_KEY_SECRET=' + ('set' if vals.get('RAZORPAY_KEY_SECRET') else 'empty'))"
        "\"",
    )

    ssh.close()
    safe_print("\n=== Done ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
