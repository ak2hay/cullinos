#!/usr/bin/env python3
"""Set R2_BUCKET + R2_PUBLIC_URL on prod and recreate API."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APP_DIR = "/opt/cullinos"

BUCKET = "cullinos-marketing"
PUBLIC_URL = "https://pub-ad3302af8f0c4899add9111ce1868aff.r2.dev"
ENDPOINT = "https://b8ca0cf70da5a81d986dd7727d3ceaf7.r2.cloudflarestorage.com"


def load_password() -> str:
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


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 300) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-3000:], flush=True)
    if code != 0 and err.strip():
        print("STDERR:", err[-1500:], flush=True)
    return code, out, err


def main() -> int:
    password = load_password()
    if not password:
        print("DEPLOY_PASSWORD required", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=30, banner_timeout=60)
    print("Connected.")

    # Upsert keys without printing secrets
    script = f"""
set -e
ENV={APP_DIR}/.env
touch "$ENV"
upsert() {{
  local key="$1" val="$2"
  if grep -q "^${{key}}=" "$ENV"; then
    sed -i "s|^${{key}}=.*|${{key}}=${{val}}|" "$ENV"
  else
    echo "${{key}}=${{val}}" >> "$ENV"
  fi
}}
upsert R2_BUCKET "{BUCKET}"
upsert R2_PUBLIC_URL "{PUBLIC_URL}"
upsert R2_ENDPOINT "{ENDPOINT}"
echo "--- R2 CMS keys (no secrets) ---"
grep -E '^(R2_BUCKET|R2_PUBLIC_URL|R2_ENDPOINT|R2_ACCOUNT_ID)=' "$ENV" || true
"""
    code, _, _ = run(ssh, script, timeout=60)
    if code != 0:
        return code

    print("\n=== Recreate API ===")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api",
        timeout=180,
    )
    if code != 0:
        return code

    for _ in range(36):
        _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if "ok" in health:
            print("API health OK")
            break
        time.sleep(5)
    else:
        print("API health check failed", file=sys.stderr)
        return 1

    # Confirm env inside container (no secrets)
    run(
        ssh,
        "docker exec cullinos-api printenv | grep -E '^(R2_BUCKET|R2_PUBLIC_URL|R2_ENDPOINT|R2_ACCOUNT_ID)=' || true",
        timeout=30,
    )
    run(
        ssh,
        "docker logs cullinos-api 2>&1 | grep -iE 'R2 storage' | tail -5 || true",
        timeout=30,
    )

    ssh.close()
    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
