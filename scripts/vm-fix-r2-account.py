#!/usr/bin/env python3
"""Find a TLS-working R2 account endpoint, patch VM .env, upload existing daily backup, snapshot."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
USER_ACCOUNT = "b8ca0cf70da5a81d986dd7727d3ceaf7"
DB_ACCOUNT = "b8ca8c770da5a81d986dd7777d3ceaf7"


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("DEPLOY_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DEPLOY_PASSWORD required")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n--- remote ({timeout}s) ---")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = (out + ("\n" + err if err.strip() else "")).encode("ascii", "replace").decode("ascii")
    print(text[-8000:] if len(text) > 8000 else text)
    return code, out, err


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=load_password(), timeout=30)

    # Probe both account IDs
    probe = f"""
python3 - <<'PY'
import ssl, socket
from pathlib import Path
cands = ["{USER_ACCOUNT}", "{DB_ACCOUNT}"]
ctx = ssl.create_default_context()
good = None
for a in cands:
    host = f"{{a}}.r2.cloudflarestorage.com"
    try:
        with socket.create_connection((host, 443), timeout=10) as sock:
            with ctx.wrap_socket(sock, server_hostname=host) as ss:
                print("py_ok", a, ss.version(), ss.cipher()[0])
                good = a
                break
    except Exception as e:
        print("py_bad", a, type(e).__name__, str(e)[:120])
if not good:
    raise SystemExit("no_tls")
Path("/tmp/r2.good.account").write_text(good)
print("SELECTED", good)
PY
"""
    code, _, _ = run(ssh, probe, timeout=60)
    if code != 0:
        print("Neither account ID accepts TLS from this VM.", file=sys.stderr)
        ssh.close()
        return 1

    patch_and_upload = r"""
set -euo pipefail
GOOD=$(cat /tmp/r2.good.account)
EP="https://${GOOD}.r2.cloudflarestorage.com"
python3 - <<PY
from pathlib import Path
env = Path("/opt/cullinos/.env")
good = Path("/tmp/r2.good.account").read_text().strip()
ep = f"https://{good}.r2.cloudflarestorage.com"
updates = {
    "R2_ACCOUNT_ID": good,
    "R2_ENDPOINT": ep,
    "R2_BACKUP_ENDPOINT": ep,
    "R2_BACKUP_BUCKET": "cullinos-backups",
}
lines = env.read_text().splitlines()
seen = set()
out = []
for line in lines:
    if "=" in line and not line.strip().startswith("#"):
        k = line.split("=", 1)[0].strip()
        if k in updates:
            out.append(f"{k}={updates[k]}")
            seen.add(k)
            continue
    out.append(line)
for k, v in updates.items():
    if k not in seen:
        out.append(f"{k}={v}")
env.write_text("\n".join(out) + "\n")
print("patched", good, ep)
PY
set -a
source /opt/cullinos/.env
set +a
DAY=$(ls -1 /var/backups/cullinos/daily | sort | tail -1)
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto
echo "Uploading day=$DAY endpoint=$EP bucket=$R2_BACKUP_BUCKET"
/usr/local/bin/aws s3 sync "/var/backups/cullinos/daily/$DAY/" \
  "s3://${R2_BACKUP_BUCKET}/cullinos/daily/${DAY}/" \
  --endpoint-url "$EP"
echo UPLOAD_OK
# Also verify list
/usr/local/bin/aws s3 ls "s3://${R2_BACKUP_BUCKET}/cullinos/daily/${DAY}/" --endpoint-url "$EP"
"""
    code, _, _ = run(ssh, patch_and_upload, timeout=1800)
    if code != 0:
        ssh.close()
        return code

    run(ssh, "bash /opt/cullinos/scripts/prod/snapshot-release.sh", timeout=600)
    run(ssh, "bash /opt/cullinos/scripts/prod/rollback.sh --list", timeout=30)
    ssh.close()
    print("\n=== Done: R2 account fixed + backup uploaded + snapshot taken ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
