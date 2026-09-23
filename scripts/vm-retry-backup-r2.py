#!/usr/bin/env python3
"""Re-upload prod scripts and retry backup.sh + snapshot-release.sh (R2 already wired)."""
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
PROD_SCRIPTS = ROOT / "scripts" / "prod"


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("DEPLOY_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DEPLOY_PASSWORD required")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:200]}...")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        text = out[-5000:] if len(out) > 5000 else out
        print(text.encode("ascii", "replace").decode("ascii"))
    if err.strip():
        text = err[-2500:] if len(err) > 2500 else err
        print("STDERR:", text.encode("ascii", "replace").decode("ascii"))
    return code, out, err


def main() -> int:
    password = load_password()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=30)

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in sorted(PROD_SCRIPTS.glob("*")):
            if path.is_file():
                tar.add(path, arcname=f"prod/{path.name}")
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos-prod-fix.tgz", "wb") as f:
        f.write(buf.getvalue())
    sftp.close()

    run(
        ssh,
        f"tar -xzf /tmp/cullinos-prod-fix.tgz -C {APP_DIR}/scripts "
        f"&& chmod +x {APP_DIR}/scripts/prod/*.sh {APP_DIR}/scripts/prod/r2_sync.py "
        f"&& rm -f /tmp/cullinos-prod-fix.tgz "
        f"&& python3 -c 'import boto3' 2>/dev/null || (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3-boto3)",
        timeout=300,
    )

    code, _, _ = run(ssh, f"bash {APP_DIR}/scripts/prod/backup.sh", timeout=3600)
    if code != 0:
        print("Backup still failing", file=sys.stderr)
        ssh.close()
        return code

    code, _, _ = run(ssh, f"bash {APP_DIR}/scripts/prod/snapshot-release.sh", timeout=600)
    run(ssh, f"bash {APP_DIR}/scripts/prod/rollback.sh --list", timeout=30)
    run(ssh, "ls -lah /var/backups/cullinos/daily/*/ 2>/dev/null | head -40", timeout=30)
    ssh.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
