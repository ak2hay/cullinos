#!/usr/bin/env python3
"""Rebuild API image without cache and verify health."""
import os
import sys
import time
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"


def run(ssh, cmd, timeout=1800):
    print(f"\n$ {cmd[:160]}{'...' if len(cmd) > 160 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        sys.stdout.buffer.write(out[-6000:].encode("utf-8", errors="replace"))
        sys.stdout.buffer.write(b"\n")
    if err.strip() and code != 0:
        sys.stdout.buffer.write(b"STDERR: ")
        sys.stdout.buffer.write(err[-3000:].encode("utf-8", errors="replace"))
        sys.stdout.buffer.write(b"\n")
    return code, out, err


def main():
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    if not password:
        print("Set DEPLOY_PASSWORD", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=30)

    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build --no-cache api",
        timeout=1800,
    )
    if code != 0:
        return code

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d")
    run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
        "npx prisma db push --schema=packages/prisma/prisma/schema.prisma",
        timeout=600,
    )
    run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
        "npx tsx packages/prisma/prisma/seed.ts",
        timeout=600,
    )
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")

    for _ in range(24):
        _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if '"status":"ok"' in out or '"status": "ok"' in out:
            print("\nAPI healthy:", out.strip())
            ssh.close()
            return 0
        time.sleep(10)

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=40 api")
    ssh.close()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
