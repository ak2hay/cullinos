#!/usr/bin/env python3
"""Diagnose Cullinos daily/hourly backup health on the VM."""
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


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> str:
    print(f"\n=== {cmd[:100]} ===")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    stdout.channel.recv_exit_status()
    text = (out + ("\nSTDERR:\n" + err if err.strip() else "")).encode("ascii", "replace").decode("ascii")
    print(text[-6000:] if len(text) > 6000 else text)
    return text


def main() -> int:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=load_password(), timeout=30)

    run(ssh, "crontab -l | grep -E 'backup|cullinos' || echo NO_CRON")
    run(ssh, "ls -lah /var/backups/cullinos/ 2>/dev/null; ls -lah /var/backups/cullinos/daily/ 2>/dev/null | tail -20")
    run(ssh, "cat /var/backups/cullinos/LAST_BACKUP.json 2>/dev/null || echo NO_LAST_BACKUP")
    run(ssh, "cat /var/backups/cullinos/LAST_HOURLY.json 2>/dev/null || echo NO_LAST_HOURLY")
    run(ssh, "tail -n 80 /var/log/cullinos-backup.log 2>/dev/null || echo NO_DAILY_LOG")
    run(ssh, "tail -n 40 /var/log/cullinos-backup-hourly.log 2>/dev/null || echo NO_HOURLY_LOG")
    run(ssh, "df -h / /var/backups 2>/dev/null; du -sh /var/backups/cullinos/* 2>/dev/null")
    run(
        ssh,
        "grep -E '^(R2_|BACKUP_)' /opt/cullinos/.env | sed -E 's/(SECRET|KEY)=.*/\\1=***/' || true",
    )
    run(ssh, "ls -la /opt/cullinos/scripts/prod/")
    run(ssh, "test -x /usr/local/bin/aws && /usr/local/bin/aws --version || echo NO_AWSV2")

    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
