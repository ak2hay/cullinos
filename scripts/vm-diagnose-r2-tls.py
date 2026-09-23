#!/usr/bin/env python3
"""Diagnose R2 TLS from VM and try AWS CLI v2 upload of existing daily backup."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("DEPLOY_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DEPLOY_PASSWORD required")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:180]}...")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = (out + ("\n" + err if err.strip() else "")).encode("ascii", "replace").decode("ascii")
    print(text[-6000:] if len(text) > 6000 else text)
    return code, out, err


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=load_password(), timeout=30)

    run(
        ssh,
        r"""
set -a; source /opt/cullinos/.env; set +a
EP="${R2_BACKUP_ENDPOINT:-$R2_ENDPOINT}"
if [ -z "$EP" ]; then EP="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"; fi
HOSTONLY=$(echo "$EP" | sed -E 's#https?://##' | cut -d/ -f1)
echo "endpoint=$EP"
echo "host=$HOSTONLY"
echo "account_id_set=$([ -n "$R2_ACCOUNT_ID" ] && echo yes || echo no)"
echo "bucket=$R2_BACKUP_BUCKET"
echo "=== openssl ==="
echo | timeout 15 openssl s_client -connect "${HOSTONLY}:443" -servername "$HOSTONLY" 2>&1 | head -40
echo "=== curl -I ==="
timeout 20 curl -sI --max-time 15 "$EP" | head -20 || true
echo "=== python ssl ==="
python3 - <<'PY'
import ssl, socket, os
from pathlib import Path
# read endpoint host from env file
vals={}
for line in Path('/opt/cullinos/.env').read_text().splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k,v=line.split('=',1); vals[k.strip()]=v.strip()
host=(vals.get('R2_BACKUP_ENDPOINT') or vals.get('R2_ENDPOINT') or f"https://{vals.get('R2_ACCOUNT_ID','')}.r2.cloudflarestorage.com")
host=host.replace('https://','').replace('http://','').split('/')[0]
print('python', ssl.OPENSSL_VERSION)
ctx=ssl.create_default_context()
try:
    with socket.create_connection((host,443), timeout=15) as sock:
        with ctx.wrap_socket(sock, server_hostname=host) as ssock:
            print('tls_ok', ssock.version(), ssock.cipher())
except Exception as e:
    print('tls_fail', type(e).__name__, e)
PY
""",
        timeout=90,
    )

    # Install AWS CLI v2 (bundled SSL) if missing
    run(
        ssh,
        r"""
if [ -x /usr/local/bin/aws ]; then /usr/local/bin/aws --version; exit 0; fi
cd /tmp
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unzip
unzip -qo awscliv2.zip
./aws/install --update
/usr/local/bin/aws --version
rm -rf /tmp/aws /tmp/awscliv2.zip
""",
        timeout=300,
    )

    # Try upload with AWS CLI v2
    code, _, _ = run(
        ssh,
        r"""
set -euo pipefail
set -a; source /opt/cullinos/.env; set +a
EP="${R2_BACKUP_ENDPOINT:-$R2_ENDPOINT}"
if [ -z "$EP" ]; then EP="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"; fi
DAY=$(ls -1 /var/backups/cullinos/daily | sort | tail -1)
echo "uploading day=$DAY via awscliv2 to $EP"
export AWS_ACCESS_KEY_ID R2_ACCESS_KEY_ID
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
/usr/local/bin/aws s3 sync "/var/backups/cullinos/daily/$DAY/" \
  "s3://${R2_BACKUP_BUCKET}/cullinos/daily/${DAY}/" \
  --endpoint-url "$EP"
echo UPLOAD_OK
""",
        timeout=1800,
    )

    ssh.close()
    return 0 if code == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
