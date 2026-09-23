#!/usr/bin/env python3
"""Sync MSG91_* from local .env to production VM .env and recreate API."""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
KEYS = (
    "MSG91_AUTH_KEY",
    "MSG91_TEMPLATE_ID",
    "MSG91_SENDER_ID",
    "MSG91_WIDGET_ID",
    "MSG91_WIDGET_TOKEN",
    "MSG91_OTP_TTL_SECONDS",
)


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    raise SystemExit("DEPLOY_PASSWORD required")


def local_msg91() -> dict[str, str]:
    env_path = ROOT / ".env"
    if not env_path.exists():
        raise SystemExit("Local .env missing")
    vals: dict[str, str] = {}
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line or line.strip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        if k in KEYS:
            vals[k] = v.strip().strip('"').strip("'")
    return vals


def main() -> int:
    local = local_msg91()
    for k in KEYS:
        v = local.get(k, "")
        print(f"local {k}: {'set' if v else 'EMPTY'}")
    if not local.get("MSG91_AUTH_KEY"):
        print("MSG91_AUTH_KEY empty locally — cannot sync", file=sys.stderr)
        return 1
    if not local.get("MSG91_TEMPLATE_ID"):
        print(
            "MSG91_TEMPLATE_ID empty locally — Flow SMS will still fail. "
            "Set template ID in local .env or Super Admin.",
            file=sys.stderr,
        )
        # still sync what we have

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=load_password(), timeout=30)

    # Upload a small env fragment and merge on server without echoing secrets
    frag = "\n".join(f"{k}={local.get(k, '')}" for k in KEYS if local.get(k)) + "\n"
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/msg91.env.fragment", "w") as f:
        f.write(frag)
    sftp.close()

    merge = r"""
set -e
ENV=/opt/cullinos/.env
cp "$ENV" /tmp/cullinos.env.bak.msg91
python3 - <<'PY'
from pathlib import Path
env_path = Path('/opt/cullinos/.env')
frag = Path('/tmp/msg91.env.fragment').read_text().splitlines()
updates = {}
for line in frag:
    if '=' in line:
        k,v = line.split('=',1)
        if v.strip():
            updates[k.strip()] = v
lines = env_path.read_text().splitlines()
seen = set()
out = []
for line in lines:
    if '=' in line and not line.strip().startswith('#'):
        k = line.split('=',1)[0].strip()
        if k in updates:
            out.append(f'{k}={updates[k]}')
            seen.add(k)
            continue
    out.append(line)
for k,v in updates.items():
    if k not in seen:
        out.append(f'{k}={v}')
env_path.write_text('\n'.join(out) + '\n')
print('merged keys:', ', '.join(sorted(updates)))
PY
rm -f /tmp/msg91.env.fragment
cd /opt/cullinos && docker compose -f docker-compose.prod.yml up -d --force-recreate api
sleep 8
curl -sf http://127.0.0.1:3000/api/v1/health
echo
# Redacted presence check inside container
docker exec cullinos-api sh -c 'test -n "$MSG91_AUTH_KEY" && echo AUTH_KEY=set || echo AUTH_KEY=MISSING; test -n "$MSG91_TEMPLATE_ID" && echo TEMPLATE_ID=set || echo TEMPLATE_ID=MISSING; test -n "$MSG91_SENDER_ID" && echo SENDER_ID=set || echo SENDER_ID=MISSING'
"""
    print("Merging MSG91 into prod .env and recreating API...")
    _, out, err = ssh.exec_command(merge, timeout=180)
    print(out.read().decode("utf-8", "replace")[-3000:])
    e = err.read().decode("utf-8", "replace")
    if e.strip():
        print("STDERR:", e[-1500:])
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
