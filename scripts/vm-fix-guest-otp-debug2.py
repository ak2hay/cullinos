#!/usr/bin/env python3
"""Upload guest OTP debug fix, ensure env flag, rebuild API, smoke test."""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
if not pw:
    raise SystemExit("DEPLOY_PASSWORD required")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="root", password=pw, timeout=30)
transport = ssh.get_transport()
if transport:
    transport.set_keepalive(30)


def run(cmd: str, timeout: int = 120) -> tuple[int, str]:
    print("$", cmd[:180], flush=True)
    _, o, e = ssh.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    code = o.channel.recv_exit_status()
    text = (out + ("\n" + err if err.strip() else ""))[-3500:]
    sys.stdout.buffer.write(text.encode("utf-8", "replace") + b"\n")
    sys.stdout.buffer.flush()
    return code, out


# env flag
run(
    "grep -q '^GUEST_OTP_DEBUG_IN_PROD=' /opt/cullinos/.env && "
    "sed -i 's/^GUEST_OTP_DEBUG_IN_PROD=.*/GUEST_OTP_DEBUG_IN_PROD=true/' /opt/cullinos/.env || "
    "echo 'GUEST_OTP_DEBUG_IN_PROD=true' >> /opt/cullinos/.env; "
    "grep '^GUEST_OTP_DEBUG_IN_PROD=' /opt/cullinos/.env"
)

sftp = ssh.open_sftp()
sftp.put(
    str(ROOT / "apps/api/src/modules/guest/guest.service.ts"),
    "/opt/cullinos/apps/api/src/modules/guest/guest.service.ts",
)
sftp.put(
    str(ROOT / "apps/api/src/modules/customers/phone-otp-request.util.ts"),
    "/opt/cullinos/apps/api/src/modules/customers/phone-otp-request.util.ts",
)
sftp.close()

# detached rebuild
script = """#!/bin/bash
set +e
cd /opt/cullinos
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d --force-recreate api
echo $? > /tmp/guest-otp-fix.exit
"""
sftp = ssh.open_sftp()
with sftp.file("/tmp/guest-otp-fix.sh", "w") as f:
    f.write(script)
sftp.chmod("/tmp/guest-otp-fix.sh", 0o755)
sftp.close()
run("rm -f /tmp/guest-otp-fix.exit /tmp/guest-otp-fix.log; nohup bash /tmp/guest-otp-fix.sh >/tmp/guest-otp-fix.log 2>&1 & echo $!")

deadline = time.time() + 2400
last = -1
while time.time() < deadline:
    time.sleep(20)
    code, status = run(
        "if test -f /tmp/guest-otp-fix.exit; then echo DONE:$(cat /tmp/guest-otp-fix.exit); "
        "else echo RUNNING:$(wc -c < /tmp/guest-otp-fix.log 2>/dev/null || echo 0); fi; "
        "tail -n 4 /tmp/guest-otp-fix.log 2>/dev/null || true"
    )
    if "DONE:" in status:
        done = [l for l in status.splitlines() if l.startswith("DONE:")][0]
        exit_code = int(done.split(":", 1)[1].strip())
        if exit_code != 0:
            run("tail -n 60 /tmp/guest-otp-fix.log")
            raise SystemExit(exit_code)
        break
    running = [l for l in status.splitlines() if l.startswith("RUNNING:")]
    if running:
        try:
            size = int(running[0].split(":", 1)[1].strip())
            if size != last:
                print(f"… building ({size} bytes)", flush=True)
                last = size
        except ValueError:
            pass
else:
    raise SystemExit("build timeout")

for _ in range(36):
    _, health = run("curl -sf http://127.0.0.1:3000/api/v1/health || echo down")
    _, env = run("docker exec cullinos-api printenv GUEST_OTP_DEBUG_IN_PROD || echo missing")
    if '"status":"ok"' in health and "true" in env:
        break
    time.sleep(5)
else:
    raise SystemExit("api not healthy with debug flag")

_, smoke = run(
    "curl -s -X POST http://127.0.0.1:3000/api/v1/public/guest/auth/otp/request "
    "-H 'Content-Type: application/json' -d '{\"phone\":\"9999900011\"}'"
)
# last non-empty line likely JSON
line = [l for l in smoke.splitlines() if l.strip()][-1] if smoke.strip() else "{}"
try:
    data = json.loads(line)
except json.JSONDecodeError:
    data = {"raw": smoke[-500:]}
print(
    "SMOKE",
    {
        "has_debug": "debugOtp" in data,
        "sent": data.get("sent"),
        "challenge": bool(data.get("challengeToken")),
        "error": data.get("error"),
        "keys": sorted(data.keys()) if isinstance(data, dict) else [],
    },
    flush=True,
)
if "debugOtp" not in data and "challengeToken" not in data:
    raise SystemExit(1)
ssh.close()
print("OK", flush=True)
