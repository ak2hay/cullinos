#!/usr/bin/env python3
"""Upload updated prod backup scripts and reinstall cron on the VM."""
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
    with sftp.file("/tmp/cullinos-prod-resilience.tgz", "wb") as f:
        f.write(buf.getvalue())
    sftp.close()

    cmd = f"""
set -euo pipefail
tar -xzf /tmp/cullinos-prod-resilience.tgz -C {APP_DIR}/scripts
chmod +x {APP_DIR}/scripts/prod/*.sh {APP_DIR}/scripts/prod/*.py
# Merge new env defaults if missing
python3 - <<'PY'
from pathlib import Path
env = Path("{APP_DIR}/.env")
text = env.read_text(encoding="utf-8", errors="replace")
updates = {{
  "BACKUP_INCLUDE_IMAGES": "weekly",
  "BACKUP_HOURLY_KEEP_HOURS": "72",
  "BACKUP_ALERT_ON": "fail",
}}
existing = set()
for line in text.splitlines():
    if "=" in line and not line.strip().startswith("#"):
        existing.add(line.split("=",1)[0].strip())
out = text.rstrip() + "\\n"
for k,v in updates.items():
    if k not in existing:
        out += f"{{k}}={{v}}\\n"
        print("added", k)
env.write_text(out if out.endswith("\\n") else out + "\\n")
PY
bash {APP_DIR}/scripts/prod/install-cron.sh
# Quick smoke: write status helpers load
bash -n {APP_DIR}/scripts/prod/backup.sh
bash -n {APP_DIR}/scripts/prod/backup-db-hourly.sh
# Run one hourly now (small)
bash {APP_DIR}/scripts/prod/backup-db-hourly.sh
cat /var/backups/cullinos/LAST_HOURLY.json
crontab -l | grep prod
rm -f /tmp/cullinos-prod-resilience.tgz
echo DONE
"""
    _, stdout, stderr = ssh.exec_command(cmd, timeout=600)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    print(out.encode("ascii", "replace").decode("ascii")[-5000:])
    if err.strip():
        print("STDERR:", err.encode("ascii", "replace").decode("ascii")[-2000:])
    ssh.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
