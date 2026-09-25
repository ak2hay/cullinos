#!/usr/bin/env python3
"""Publish only the admin SPA dist to the VM."""
from __future__ import annotations

import io
import os
import tarfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
WWW = "/var/www/cullinos"


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = val


def main() -> int:
    load_dotenv()
    password = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if not password:
        print("DEPLOY_PASSWORD required")
        return 1
    dist = ROOT / "apps" / "admin" / "dist"
    if not (dist / "index.html").is_file():
        print("admin dist missing")
        return 1

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(dist, arcname="admin")
    data = buf.getvalue()
    print(f"tarball {len(data)/1e6:.2f} MB")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=120)
    try:
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/cullinos-admin-only.tar.gz", "wb") as f:
            f.write(data)
        sftp.close()
        cmd = (
            "rm -rf /tmp/cullinos-admin-pub && mkdir -p /tmp/cullinos-admin-pub && "
            "tar -xzf /tmp/cullinos-admin-only.tar.gz -C /tmp/cullinos-admin-pub && "
            f"rm -rf {WWW}/admin && mv /tmp/cullinos-admin-pub/admin {WWW}/admin && "
            "rm -rf /tmp/cullinos-admin-pub /tmp/cullinos-admin-only.tar.gz && "
            "ls -la /var/www/cullinos/admin && echo ADMIN_PUBLISHED"
        )
        print("$", cmd[:200])
        _, stdout, stderr = ssh.exec_command(cmd, timeout=120)
        out = (stdout.read() + stderr.read()).decode("utf-8", "replace")
        print(out)
        return 0 if "ADMIN_PUBLISHED" in out else 1
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
