#!/usr/bin/env python3
"""Check MSG91 config presence on prod (never print secret values)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")


def password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    secrets = ROOT / "secrets-export.txt"
    if secrets.exists():
        lines = secrets.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines):
            if line.strip() == "DEPLOY_PASSWORD" and i + 1 < len(lines):
                return lines[i + 1].strip()
    raise SystemExit("DEPLOY_PASSWORD required")


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password(), timeout=30)

    cmds = [
        r"""python3 - <<'PY'
from pathlib import Path
p=Path('/opt/cullinos/.env')
keys=('MSG91_AUTH_KEY','MSG91_TEMPLATE_ID','MSG91_WIDGET_ID','MSG91_WIDGET_TOKEN','MSG91_SENDER_ID','NODE_ENV')
vals={}
for line in p.read_text(errors='replace').splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k,v=line.split('=',1)
        vals[k.strip()]=v.strip().strip('"').strip("'")
for k in keys:
    v=vals.get(k,'')
    if k in ('MSG91_AUTH_KEY','MSG91_WIDGET_TOKEN'):
        print(f'{k}={"set" if v else "MISSING"}')
    else:
        print(f'{k}={v or "MISSING"}')
PY""",
        "docker exec cullinos-api printenv NODE_ENV MSG91_SENDER_ID 2>/dev/null; docker exec cullinos-api sh -c 'test -n \"$MSG91_AUTH_KEY\" && echo AUTH_KEY=set || echo AUTH_KEY=MISSING; test -n \"$MSG91_TEMPLATE_ID\" && echo TEMPLATE_ID=set || echo TEMPLATE_ID=MISSING; test -n \"$MSG91_WIDGET_ID\" && echo WIDGET_ID=set || echo WIDGET_ID=MISSING'",
        "docker logs cullinos-api --tail 120 2>&1 | grep -iE 'MSG91|Flow not configured|OTP SMS' | tail -20 || true",
    ]
    for cmd in cmds:
        print(f"\n$ {cmd[:80]}...")
        _, out, err = ssh.exec_command(cmd, timeout=60)
        print(out.read().decode("utf-8", "replace"))
        e = err.read().decode("utf-8", "replace")
        if e.strip():
            print("STDERR", e[-500:])
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
