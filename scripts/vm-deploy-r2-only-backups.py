#!/usr/bin/env python3
"""Deploy R2-only backup scripts, set KEEP_LOCAL=0, clear local packs, smoke hourly."""
from __future__ import annotations

import io
import os
import sys
import tarfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APP_DIR = "/opt/cullinos"


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("DEPLOY_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DEPLOY_PASSWORD required")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n--- ({timeout}s) ---")
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

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in sorted((ROOT / "scripts" / "prod").glob("*")):
            if path.is_file():
                tar.add(path, arcname=f"prod/{path.name}")
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos-r2only.tgz", "wb") as f:
        f.write(buf.getvalue())
    sftp.close()

    code, _, _ = run(
        ssh,
        f"""
set -euo pipefail
tar -xzf /tmp/cullinos-r2only.tgz -C {APP_DIR}/scripts
chmod a+rx {APP_DIR}/scripts/prod/*.sh {APP_DIR}/scripts/prod/*.py || true
python3 - <<'PY'
from pathlib import Path
env = Path("{APP_DIR}/.env")
text = env.read_text(encoding="utf-8", errors="replace")
updates = {{"BACKUP_KEEP_LOCAL_DAYS": "0"}}
lines = text.splitlines()
seen = set()
out = []
for line in lines:
    if "=" in line and not line.strip().startswith("#"):
        k = line.split("=", 1)[0].strip()
        if k in updates:
            out.append(f"{{k}}={{updates[k]}}")
            seen.add(k)
            continue
    out.append(line)
for k, v in updates.items():
    if k not in seen:
        out.append(f"{{k}}={{v}}")
env.write_text("\\n".join(out) + "\\n")
print("BACKUP_KEEP_LOCAL_DAYS=0")
PY
bash {APP_DIR}/scripts/prod/install-cron.sh
# One-time clear local daily/hourly (R2 already has copies; releases kept)
rm -rf /var/backups/cullinos/daily/* /var/backups/cullinos/hourly/*
mkdir -p /var/backups/cullinos/daily /var/backups/cullinos/hourly
echo "cleared local daily/hourly"
ls -lah /var/backups/cullinos/
rm -f /tmp/cullinos-r2only.tgz
""",
        timeout=120,
    )
    if code != 0:
        ssh.close()
        return code

    print("\n=== Smoke hourly (R2-only) ===")
    code, _, _ = run(ssh, f"bash {APP_DIR}/scripts/prod/backup-db-hourly.sh", timeout=300)
    if code != 0:
        ssh.close()
        return code

    run(
        ssh,
        r"""
set -a; source /opt/cullinos/.env; set +a
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
echo "=== local hourly (should be empty or almost) ==="
find /var/backups/cullinos/hourly -type f 2>/dev/null | head || echo "(no local hourly files)"
echo "=== LAST_HOURLY.json ==="
cat /var/backups/cullinos/LAST_HOURLY.json
echo "=== R2 hourly list (latest day) ==="
/usr/local/bin/aws s3 ls "s3://${R2_BACKUP_BUCKET}/cullinos/hourly/" --endpoint-url "$R2_ENDPOINT" | tail -5
DAY=$(date -u +%Y-%m-%d)
/usr/local/bin/aws s3 ls "s3://${R2_BACKUP_BUCKET}/cullinos/hourly/${DAY}/" --endpoint-url "$R2_ENDPOINT" | tail -5
""",
        timeout=120,
    )
    ssh.close()
    print("\n=== R2-only backups deployed ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
