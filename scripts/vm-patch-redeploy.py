#!/usr/bin/env python3
"""Upload targeted source patches and rebuild API + admin frontend (no DB reseed)."""
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

PATCH_FILES = [
    "apps/api/src/modules/menu/menu.service.ts",
    "apps/api/src/modules/menu/menu.controller.ts",
    "apps/admin/src/lib/api.ts",
    "apps/admin/src/components/layout/OutletSelector.tsx",
    "apps/admin/src/pages/TablesPage.tsx",
]


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 1800) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:200]}{'...' if len(cmd) > 200 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        try:
            print(out[-5000:], flush=True)
        except UnicodeEncodeError:
            print(out[-5000:].encode("ascii", "replace").decode("ascii"), flush=True)
    if code != 0 and err.strip():
        try:
            print("STDERR:", err[-3000:], flush=True)
        except UnicodeEncodeError:
            print("STDERR:", err[-3000:].encode("ascii", "replace").decode("ascii"), flush=True)
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
    print("Connected.", flush=True)

    # Report Razorpay config presence without printing secrets
    _, out, _ = run(
        ssh,
        f"python3 - <<'PY'\n"
        f"from pathlib import Path\n"
        f"p=Path('{APP_DIR}/.env')\n"
        f"if not p.exists():\n"
        f"  print('env=missing')\n"
        f"else:\n"
        f"  vals={{}}\n"
        f"  for line in p.read_text().splitlines():\n"
        f"    if '=' in line and not line.strip().startswith('#'):\n"
        f"      k,v=line.split('=',1)\n"
        f"      vals[k.strip()]=v.strip().strip(chr(34)).strip(chr(39))\n"
        f"  for k in ('RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET'):\n"
        f"    v=vals.get(k,'')\n"
        f"    print(f'{{k}}={{\"set\" if v else \"empty\"}}')\n"
        f"PY",
    )

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in PATCH_FILES:
            path = ROOT / rel
            if not path.exists():
                print(f"MISSING local file: {rel}", file=sys.stderr)
                return 1
            tar.add(path, arcname=rel)
            print(f"pack {rel}")
    buf.seek(0)

    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos-patch.tar.gz", "wb") as f:
        f.write(buf.read())
    sftp.close()

    code, _, _ = run(ssh, f"tar -xzf /tmp/cullinos-patch.tar.gz -C {APP_DIR} && rm /tmp/cullinos-patch.tar.gz")
    if code != 0:
        ssh.close()
        return code

    print("\n=== Rebuild API ===", flush=True)
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build --no-cache api "
        f"&& docker compose -f docker-compose.prod.yml up -d api",
        timeout=1800,
    )
    if code != 0:
        ssh.close()
        return code

    for _ in range(24):
        _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if '"status":"ok"' in health or '"status": "ok"' in health:
            print("API healthy")
            break
        time.sleep(5)
    else:
        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=50 api")
        ssh.close()
        return 1

    print("\n=== Rebuild admin frontend ===")
    # Prefer full build-frontends if present; otherwise build admin only.
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && "
        "if [ -f scripts/build-frontends.sh ]; then "
        "  sed -i 's/\\r$//' scripts/build-frontends.sh && bash scripts/build-frontends.sh; "
        "else "
        "  npm ci --include=dev && "
        "  npm run build --workspace=@cullinos/admin || (cd apps/admin && npm run build); "
        "fi",
        timeout=2400,
    )
    if code != 0:
        print("Frontend build failed", file=sys.stderr)
        ssh.close()
        return code

    run(
        ssh,
        f"mkdir -p /var/www/cullinos && "
        f"if [ -d {APP_DIR}/dist-frontends ]; then "
        f"  cp -r {APP_DIR}/dist-frontends/* /var/www/cullinos/; "
        f"elif [ -d {APP_DIR}/apps/admin/dist ]; then "
        f"  mkdir -p /var/www/cullinos/admin && cp -r {APP_DIR}/apps/admin/dist/* /var/www/cullinos/admin/; "
        f"fi && "
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --build web",
        timeout=1200,
    )

    ssh.close()
    print("\n=== Patch redeploy complete ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
