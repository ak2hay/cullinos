#!/usr/bin/env python3
"""Finish prod API bring-up after a docker recreate race."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = "95.135.254.46"
APP_DIR = "/opt/cullinos"


def load_pw() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
        if line.startswith("DEPLOY_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DEPLOY_PASSWORD missing")


def main() -> int:
    pw = load_pw()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=pw, timeout=30, banner_timeout=60)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)

    def run(cmd: str, timeout: int = 600) -> tuple[int, str]:
        print(f"$ {cmd[:200]}")
        _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        if out.strip():
            snippet = out[-3500:]
            sys.stdout.buffer.write((snippet if snippet.endswith("\n") else snippet + "\n").encode("utf-8", errors="replace"))
        if code != 0 and err.strip():
            sys.stdout.buffer.write(("STDERR: " + err[-1500:] + "\n").encode("utf-8", errors="replace"))
        sys.stdout.buffer.flush()
        return code, out

    run("docker rm -f cullinos-api 2>/dev/null; docker ps -a --filter name=cullinos-api -q | xargs -r docker rm -f; true")
    run(f"cd {APP_DIR} && mkdir -p secrets && ls -la secrets && (test -f secrets/firebase-adminsdk.json && echo KEY_OK || echo KEY_MISSING)")
    run(f"cd {APP_DIR} && grep -E '^FIREBASE_' .env | cut -d= -f1")
    # Re-upload key if missing from tarball edge cases
    local_key = ROOT / "secrets" / "firebase-adminsdk.json"
    if local_key.exists():
        sftp = ssh.open_sftp()
        with sftp.file(f"{APP_DIR}/secrets/firebase-adminsdk.json", "w") as f:
            f.write(local_key.read_text(encoding="utf-8"))
        sftp.chmod(f"{APP_DIR}/secrets/firebase-adminsdk.json", 0o600)
        sftp.close()
        print("Re-uploaded firebase-adminsdk.json")

    run(f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --force-recreate api")
    run(f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml stop api || true")
    code, _ = run(
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
        "npx prisma db push --schema=packages/prisma/prisma/schema.prisma --accept-data-loss=false"
    )
    if code != 0:
        code, _ = run(
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T api "
            "npx prisma db push --schema=packages/prisma/prisma/schema.prisma"
        )
    if code != 0:
        return code

    run(f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d api")

    ok = False
    for _ in range(40):
        time.sleep(5)
        _, health = run("curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if "ok" in health:
            print("API healthy")
            ok = True
            break
    if not ok:
        run(f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=100 api")
        return 1

    run(
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=80 api "
        "| grep -iE 'firebase|Firebase Admin' || true"
    )
    _, status = run(
        "curl -s -o /tmp/fb.json -w '%{http_code}' -X POST "
        "http://127.0.0.1:3000/api/v1/public/guest/auth/firebase "
        "-H 'Content-Type: application/json' -d '{}'; echo; cat /tmp/fb.json"
    )
    print("firebase smoke done")
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
