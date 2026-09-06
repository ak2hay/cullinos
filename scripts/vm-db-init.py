#!/usr/bin/env python3
"""Initialize Postgres schema + seed on VM (API must be stopped or crash-looping)."""
from __future__ import annotations

import os
import sys
import time

import paramiko

HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"


def run(ssh, cmd: str, timeout: int = 600) -> int:
    print(f"\n$ {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        sys.stdout.buffer.write(out.encode("utf-8", errors="replace"))
        sys.stdout.buffer.write(b"\n")
    if err.strip():
        sys.stdout.buffer.write(b"STDERR: ")
        sys.stdout.buffer.write(err.encode("utf-8", errors="replace"))
        sys.stdout.buffer.write(b"\n")
    return code


def main() -> int:
    if not PASSWORD:
        print("DEPLOY_PASSWORD required", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml stop api")
    code = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
        "npx prisma db push --force-reset --schema=packages/prisma/prisma/schema.prisma",
        timeout=600,
    )
    if code != 0:
        ssh.close()
        return code

    run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T "
        "-e SEED_DEMO=false -e NODE_ENV=production api "
        "npx tsx packages/prisma/prisma/seed.ts",
        timeout=600,
    )
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")

    for _ in range(18):
        time.sleep(5)
        if run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true") == 0:
            run(ssh, "curl -sf https://api.cullinos.com/api/v1/health || true")
            print("\nDB init complete.")
            ssh.close()
            return 0

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=30 api")
    ssh.close()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
