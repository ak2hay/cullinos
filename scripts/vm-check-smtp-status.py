#!/usr/bin/env python3
"""Check SMTP (email OTP) and MSG91 DB config presence and connectivity on prod (never print secret values)."""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST") or sys.exit("Set DEPLOY_HOST explicitly (no default target).")


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


ENV_FILE_CHECK = r"""python3 - <<'PY'
from pathlib import Path
p=Path('/opt/cullinos/.env')
keys=('SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','SMTP_FROM_EMAIL','MAIL_FROM_EMAIL','NODE_ENV')
vals={}
for line in p.read_text(errors='replace').splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k,v=line.split('=',1)
        vals[k.strip()]=v.strip().strip('"').strip("'")
for k in keys:
    v=vals.get(k,'')
    if k in ('SMTP_PASS','SMTP_USER'):
        print(f'.env {k}={"set" if v else "MISSING"}')
    else:
        print(f'.env {k}={v or "MISSING"}')
PY"""

CONTAINER_ENV_CHECK = (
    "docker exec cullinos-api sh -c '"
    "echo NODE_ENV=$NODE_ENV; echo SMTP_HOST=${SMTP_HOST:-MISSING}; echo SMTP_PORT=${SMTP_PORT:-MISSING}; "
    "test -n \"$SMTP_USER\" && echo SMTP_USER=set || echo SMTP_USER=MISSING; "
    "test -n \"$SMTP_PASS\" && echo SMTP_PASS=set || echo SMTP_PASS=MISSING; "
    "echo SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL:-MISSING}'"
)

DB_CHECK = (
    "docker exec cullinos-postgres psql -U cullinos -d cullinos -tA -F ' | ' -c "
    "\"SELECT key, is_secret, CASE WHEN is_secret THEN (CASE WHEN value_enc IS NOT NULL THEN 'set' ELSE 'empty' END) "
    "ELSE COALESCE(value, 'empty') END, updated_at FROM platform_settings "
    "WHERE key LIKE 'SMTP_%' OR key LIKE 'MSG91_%' OR key IN ('MAIL_FROM_EMAIL','RESEND_API_KEY') ORDER BY key\""
)

LOG_CHECK = (
    "docker logs cullinos-api --tail 3000 2>&1 | "
    "grep -iE 'SMTP not configured|SMTP send failed|Could not send verification email|Resend|MSG91|OTP SMS' "
    "| tail -25 || true"
)

def load_set_smtp_module():
    """Reuse the effective-settings verify (DB decrypted, env fallback) from vm-set-smtp-cullinos.py."""
    spec = importlib.util.spec_from_file_location(
        "vm_set_smtp_cullinos", Path(__file__).with_name("vm-set-smtp-cullinos.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    set_smtp = load_set_smtp_module()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password(), timeout=30)

    for label, cmd in (
        ("/opt/cullinos/.env", ENV_FILE_CHECK),
        ("cullinos-api container env", CONTAINER_ENV_CHECK),
        ("platform_settings DB overrides", DB_CHECK),
        ("recent API mail / SMS errors", LOG_CHECK),
    ):
        print(f"\n== {label} ==")
        _, out, err = ssh.exec_command(cmd, timeout=60)
        print(out.read().decode("utf-8", "replace").rstrip() or "(no output)")
        e = err.read().decode("utf-8", "replace")
        if e.strip():
            print("STDERR", e[-500:])

    print("\n== Effective SMTP connectivity (DB decrypted, env fallback) ==")
    set_smtp.run_js(ssh, "smtp-verify", set_smtp.VERIFY_JS, {})
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
