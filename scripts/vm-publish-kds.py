#!/usr/bin/env python3
"""Publish local apps/kds/dist to /var/www/cullinos/kds."""
from __future__ import annotations

import io
import os
import sys
import tarfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("password required", file=sys.stderr)
        return 1

    dist = ROOT / "apps" / "kds" / "dist"
    if not dist.is_dir():
        print(f"missing {dist}", file=sys.stderr)
        return 1

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(dist, arcname="kds")
    data = buf.getvalue()
    print(f"tarball {len(data) / 1024:.1f} KB", flush=True)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=60)
    try:
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/cullinos-kds-dist.tar.gz", "wb") as f:
            f.write(data)
        sftp.close()

        for cmd in [
            "rm -rf /var/www/cullinos/kds && mkdir -p /var/www/cullinos && "
            "tar -xzf /tmp/cullinos-kds-dist.tar.gz -C /var/www/cullinos && "
            "rm /tmp/cullinos-kds-dist.tar.gz && "
            "test -f /var/www/cullinos/kds/index.html && echo PUBLISHED",
            "nginx -t && systemctl reload nginx",
            "curl -sf https://api.cullinos.com/api/v1/health",
        ]:
            print(f"$ {cmd[:180]}", flush=True)
            _, stdout, stderr = ssh.exec_command(cmd, timeout=120)
            out = stdout.read().decode("utf-8", "replace")
            err = stderr.read().decode("utf-8", "replace")
            code = stdout.channel.recv_exit_status()
            if out.strip():
                print(out.strip(), flush=True)
            if code != 0:
                print(err, file=sys.stderr)
                return code
        print("done", flush=True)
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
