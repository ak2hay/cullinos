#!/usr/bin/env python3
"""Fix Postgres credential mismatch on VM after redeploy."""
import os
import sys
import time
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")
APP_DIR = "/opt/cullinos"


def run(ssh, cmd, timeout=600):
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
    return code, out, err


def main():
    password = PASSWORD or (sys.argv[1] if len(sys.argv) > 1 else "")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=password, timeout=30)

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml down")
    run(ssh, "docker volume ls")
    run(
        ssh,
        "docker volume rm cullinos_cullinos_pg_data 2>/dev/null || "
        "docker volume rm cullinos_pg_data 2>/dev/null || true",
    )
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --build", timeout=1800)

    for i in range(24):
        _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true")
        if "ok" in out:
            print("API healthy.")
            break
        time.sleep(10)
    else:
        run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=30 api")

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml exec -T api npm run db:push")
    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml exec -T api npx tsx packages/prisma/prisma/seed.ts", timeout=300)
    _, out, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health")
    run(ssh, "curl -sf http://127.0.0.1/api/v1/health || curl -sf http://127.0.0.1:3000/api/v1/health")
    ssh.close()
    print("\nFix complete.")


if __name__ == "__main__":
    main()
