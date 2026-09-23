#!/usr/bin/env python3
"""Publish local admin + super-admin dist to /var/www/cullinos/."""
from __future__ import annotations

import io
import os
import sys
import tarfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APPS = ("admin", "super-admin")


def load_deploy_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    for name in (".env", ".env.production", ".env.local"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("DEPLOY_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-3000:], flush=True)
    if code != 0 and err.strip():
        print("STDERR: " + err[-2000:], flush=True)
    return code, out, err


def main() -> int:
    password = load_deploy_password() or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("DEPLOY_PASSWORD not found.", file=sys.stderr)
        return 1

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for app in APPS:
            dist = ROOT / "apps" / app / "dist"
            if not dist.is_dir():
                print(f"MISSING dist: {dist}", file=sys.stderr)
                return 1
            arc = app
            tar.add(dist, arcname=arc)
            print(f"pack {app}/dist -> {arc}", flush=True)
    data = buf.getvalue()
    print(f"Tarball: {len(data) / 1024:.1f} KB", flush=True)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...", flush=True)
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=60)
    try:
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/cullinos-admin-sa-dist.tar.gz", "wb") as f:
            f.write(data)
        sftp.close()

        code, _, _ = run(
            ssh,
            "mkdir -p /var/www/cullinos && "
            "rm -rf /var/www/cullinos/admin /var/www/cullinos/super-admin && "
            "tar -xzf /tmp/cullinos-admin-sa-dist.tar.gz -C /var/www/cullinos && "
            "rm /tmp/cullinos-admin-sa-dist.tar.gz && "
            "test -f /var/www/cullinos/admin/index.html && "
            "test -f /var/www/cullinos/super-admin/index.html && "
            "nginx -t && systemctl reload nginx && echo PUBLISHED",
        )
        return code
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
