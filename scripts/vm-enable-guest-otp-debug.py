#!/usr/bin/env python3
"""Enable temporary GUEST_OTP_DEBUG_IN_PROD and hot-patch guest.service on VM."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
LOCAL_FILE = ROOT / "apps/api/src/modules/guest/guest.service.ts"
REMOTE_FILE = "/opt/cullinos/apps/api/src/modules/guest/guest.service.ts"


def main() -> int:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if not pw:
        return 1
    if not LOCAL_FILE.exists():
        print("missing local guest.service.ts", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=pw, timeout=30)

    # Ensure debug flag in .env
    cmd = r"""
set -e
ENV=/opt/cullinos/.env
if grep -q '^GUEST_OTP_DEBUG_IN_PROD=' "$ENV"; then
  sed -i 's/^GUEST_OTP_DEBUG_IN_PROD=.*/GUEST_OTP_DEBUG_IN_PROD=true/' "$ENV"
else
  echo 'GUEST_OTP_DEBUG_IN_PROD=true' >> "$ENV"
fi
grep '^GUEST_OTP_DEBUG_IN_PROD=' "$ENV"
"""
    _, o, e = ssh.exec_command(cmd, timeout=60)
    print(o.read().decode())
    print(e.read().decode()[-500:])

    sftp = ssh.open_sftp()
    sftp.put(str(LOCAL_FILE), REMOTE_FILE)
    # also sync phone-otp message util
    sftp.put(
        str(ROOT / "apps/api/src/modules/customers/phone-otp-request.util.ts"),
        "/opt/cullinos/apps/api/src/modules/customers/phone-otp-request.util.ts",
    )
    sftp.close()

    rebuild = (
        "cd /opt/cullinos && docker compose -f docker-compose.prod.yml up -d --build --force-recreate api"
    )
    print("Rebuilding API (this may take a few minutes)...")
    _, o, e = ssh.exec_command(
        f"nohup bash -lc '{rebuild}' >/tmp/guest-otp-debug-build.log 2>&1 & echo started",
        timeout=30,
    )
    print(o.read().decode())
    # Wait by polling health + log
    import time

    for i in range(90):
        time.sleep(10)
        _, ho, _ = ssh.exec_command(
            "curl -sf http://127.0.0.1:3000/api/v1/health && "
            "docker exec cullinos-api printenv GUEST_OTP_DEBUG_IN_PROD || true",
            timeout=30,
        )
        health = ho.read().decode()
        if '"status":"ok"' in health and "true" in health:
            print(health)
            print("API up with GUEST_OTP_DEBUG_IN_PROD")
            break
        _, lo, _ = ssh.exec_command(
            "tail -n 5 /tmp/guest-otp-debug-build.log 2>/dev/null || true",
            timeout=30,
        )
        print(f"… waiting ({(i+1)*10}s)", lo.read().decode()[-300:])
    else:
        print("Timed out waiting for API", file=sys.stderr)
        ssh.close()
        return 1

    # Smoke OTP request — expect 200 with debugOtp when MSG91 missing
    smoke = r"""
curl -s -X POST http://127.0.0.1:3000/api/v1/public/guest/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"phone":"9999900011"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('keys',sorted(d.keys())); print('has_debug', 'debugOtp' in d); print('sent', d.get('sent')); print('challenge', bool(d.get('challengeToken')))"
"""
    _, o, e = ssh.exec_command(smoke, timeout=60)
    print(o.read().decode())
    print(e.read().decode()[-300:])
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
