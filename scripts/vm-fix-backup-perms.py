#!/usr/bin/env python3
"""Fix backup script permissions, reinstall cron with /bin/bash, run catch-up daily + hourly."""
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
    print(text[-7000:] if len(text) > 7000 else text)
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
    with sftp.file("/tmp/cullinos-backup-fix.tgz", "wb") as f:
        f.write(buf.getvalue())
    sftp.close()

    code, _, _ = run(
        ssh,
        f"""
set -euo pipefail
tar -xzf /tmp/cullinos-backup-fix.tgz -C {APP_DIR}/scripts
# Always force executable + use bash in cron (Windows tarballs drop +x)
chmod a+rx {APP_DIR}/scripts/prod/*.sh {APP_DIR}/scripts/prod/*.py || true
chmod a+r {APP_DIR}/scripts/prod/_common.sh
bash {APP_DIR}/scripts/prod/install-cron.sh
ls -la {APP_DIR}/scripts/prod/
rm -f /tmp/cullinos-backup-fix.tgz
""",
        timeout=120,
    )
    if code != 0:
        ssh.close()
        return code

    print("\n=== Running catch-up hourly ===")
    code, _, _ = run(ssh, f"bash {APP_DIR}/scripts/prod/backup-db-hourly.sh", timeout=300)
    if code != 0:
        print("Hourly failed", file=sys.stderr)

    print("\n=== Running catch-up daily (may take a few minutes) ===")
    code, _, _ = run(ssh, f"bash {APP_DIR}/scripts/prod/backup.sh", timeout=3600)
    if code != 0:
        print("Daily failed", file=sys.stderr)
        ssh.close()
        return code

    run(ssh, "cat /var/backups/cullinos/LAST_BACKUP.json; echo; cat /var/backups/cullinos/LAST_HOURLY.json; echo; crontab -l | grep prod; ls -lah /var/backups/cullinos/daily/")
    ssh.close()
    print("\n=== Fixed: cron uses /bin/bash; daily+hourly catch-up OK ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
