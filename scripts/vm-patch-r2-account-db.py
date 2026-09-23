#!/usr/bin/env python3
"""Patch platform_settings R2 account/endpoint to the TLS-working account; keep access keys as-is."""
from __future__ import annotations

import os
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
GOOD = "b8ca0cf70da5a81d986dd7727d3ceaf7"
EP = f"https://{GOOD}.r2.cloudflarestorage.com"


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("DEPLOY_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DEPLOY_PASSWORD required")


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=load_password(), timeout=30)
    # Escape single quotes for SQL
    sql = f"""
UPDATE platform_settings SET value = '{GOOD}', updated_at = NOW() WHERE key = 'R2_ACCOUNT_ID';
UPDATE platform_settings SET value = '{EP}', updated_at = NOW() WHERE key = 'R2_ENDPOINT';
SELECT key, left(value, 80) FROM platform_settings WHERE key IN ('R2_ACCOUNT_ID','R2_ENDPOINT','R2_BUCKET');
"""
    cmd = f"docker exec -i cullinos-postgres psql -U cullinos -d cullinos <<'SQL'\n{sql}\nSQL"
    _, stdout, stderr = ssh.exec_command(cmd, timeout=60)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR:", err)
    # Prefer awscliv2 in backup path
    patch = r"""
set -e
COMMON=/opt/cullinos/scripts/prod/_common.sh
# Ensure install-cron still present
bash /opt/cullinos/scripts/prod/install-cron.sh >/dev/null
# Smoke: r2 list with awscliv2
set -a; source /opt/cullinos/.env; set +a
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
EP="${R2_BACKUP_ENDPOINT:-$R2_ENDPOINT}"
/usr/local/bin/aws s3 ls "s3://${R2_BACKUP_BUCKET}/cullinos/daily/" --endpoint-url "$EP" | tail -5
echo SMOKE_OK
"""
    _, stdout, stderr = ssh.exec_command(patch, timeout=120)
    print(stdout.read().decode("utf-8", "replace"))
    err = stderr.read().decode("utf-8", "replace")
    if err.strip():
        print("STDERR:", err[-1000:])
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
