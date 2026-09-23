#!/usr/bin/env python3
"""Selective publish: local admin + kds dist → /var/www/cullinos/."""
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
APPS = ("admin", "kds")


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    safe_print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe_print(out[-4000:])
    if code != 0 and err.strip():
        safe_print("STDERR: " + err[-2000:])
    return code, out, err


def main() -> int:
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD or pass as argv[1]", file=sys.stderr)
        return 1

    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for app in APPS:
            dist = ROOT / "apps" / app / "dist"
            if not dist.is_dir():
                safe_print(f"MISSING dist: {dist}")
                return 1
            tar.add(dist, arcname=app)
            safe_print(f"pack {app}/dist")
    data = buf.getvalue()
    safe_print(f"Tarball: {len(data) / 1024:.1f} KB")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=60)
    try:
        sftp = ssh.open_sftp()
        with sftp.file("/tmp/cullinos-admin-kds-dist.tar.gz", "wb") as f:
            f.write(data)
        sftp.close()

        for app in APPS:
            code, _, _ = run(
                ssh,
                f"rm -rf /var/www/cullinos/{app} && mkdir -p /var/www/cullinos",
            )
            if code != 0:
                return code

        code, _, _ = run(
            ssh,
            "tar -xzf /tmp/cullinos-admin-kds-dist.tar.gz -C /var/www/cullinos && "
            "rm /tmp/cullinos-admin-kds-dist.tar.gz && "
            "test -f /var/www/cullinos/admin/index.html && "
            "test -f /var/www/cullinos/kds/index.html && echo PUBLISHED",
        )
        if code != 0:
            return code

        code, _, _ = run(ssh, "nginx -t && systemctl reload nginx")
        if code != 0:
            return code

        _, health, _ = run(ssh, "curl -sf https://api.cullinos.com/api/v1/health || true")
        safe_print("\n=== admin + kds published ===")
        safe_print(f"Health: {health.strip()}")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
