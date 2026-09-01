#!/usr/bin/env python3
"""Quick SSH diagnostics/fix for Cullinos VM."""
import os
import sys
import paramiko

HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
USER = os.environ.get("DEPLOY_USER", "root")
PASSWORD = os.environ.get("DEPLOY_PASSWORD", "")


def run(ssh, cmd, timeout=120):
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

    run(ssh, "cd /opt/cullinos && docker compose -f docker-compose.prod.yml ps -a")
    run(ssh, "cd /opt/cullinos && docker compose -f docker-compose.prod.yml logs --tail=40 api")
    run(ssh, "curl -v http://127.0.0.1:3000/api/v1/health 2>&1 | tail -20")
    run(ssh, "cd /opt/cullinos && docker compose -f docker-compose.prod.yml up -d")
    run(ssh, "sleep 15 && curl -sf http://127.0.0.1:3000/api/v1/health")
    ssh.close()


if __name__ == "__main__":
    main()
