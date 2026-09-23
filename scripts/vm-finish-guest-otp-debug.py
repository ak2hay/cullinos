#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time

import paramiko

pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
if not pw:
    raise SystemExit("DEPLOY_PASSWORD required")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("95.135.254.46", username="root", password=pw, timeout=30)


def run(cmd: str, timeout: int = 120) -> str:
    print("$", cmd[:160], flush=True)
    _, o, e = ssh.exec_command(cmd, timeout=timeout)
    out = o.read().decode("utf-8", "replace")
    err = e.read().decode("utf-8", "replace")
    if out.strip():
        print(out[-3000:], flush=True)
    if err.strip():
        print("ERR", err[-800:], flush=True)
    return out


run("tail -n 50 /tmp/guest-otp-debug-build.log 2>/dev/null || echo no-log")
run('docker ps --filter name=cullinos-api --format "{{.Status}}"')
run("docker exec cullinos-api printenv GUEST_OTP_DEBUG_IN_PROD NODE_ENV 2>/dev/null || true")

# Ensure rebuild finished; if not, run a proper recreate now
status = run(
    "cd /opt/cullinos && docker compose -f docker-compose.prod.yml up -d --build --force-recreate api",
    timeout=2400,
)

for _ in range(36):
    health = run("curl -sf http://127.0.0.1:3000/api/v1/health || echo down")
    env = run("docker exec cullinos-api printenv GUEST_OTP_DEBUG_IN_PROD 2>/dev/null || echo missing")
    if '"status":"ok"' in health and "true" in env:
        break
    time.sleep(5)

smoke = run(
    "curl -s -X POST http://127.0.0.1:3000/api/v1/public/guest/auth/otp/request "
    "-H 'Content-Type: application/json' "
    "-d '{\"phone\":\"9999900011\"}'"
)
try:
    data = json.loads(smoke.strip().splitlines()[-1] if smoke.strip() else "{}")
except json.JSONDecodeError:
    data = {}
print(
    "SMOKE",
    {
        "has_debug": "debugOtp" in data,
        "sent": data.get("sent"),
        "challenge": bool(data.get("challengeToken")),
        "error": data.get("error"),
        "keys": sorted(data.keys()),
    },
    flush=True,
)
ssh.close()
