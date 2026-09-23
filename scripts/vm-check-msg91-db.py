#!/usr/bin/env python3
import os
import paramiko
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
if not pw:
    raise SystemExit("DEPLOY_PASSWORD required")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("95.135.254.46", username="root", password=pw, timeout=30)
cmd = (
    "docker exec cullinos-postgres psql -U cullinos -d cullinos -c "
    "\"SELECT key, CASE WHEN coalesce(length(value),0)>0 THEN 'set' ELSE 'empty' END "
    "AS status FROM platform_settings WHERE key LIKE 'MSG91%' ORDER BY 1;\""
)
_, o, e = ssh.exec_command(cmd, timeout=60)
print(o.read().decode())
err = e.read().decode()
if err.strip():
    print(err[-500:])
ssh.close()
