#!/usr/bin/env python3
"""Update platform_settings R2 CMS bucket/public URL and recreate API."""
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


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    for name in (".env",):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("DEPLOY_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:220]}{'...' if len(cmd) > 220 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-2500:], flush=True)
    if code != 0 and err.strip():
        print("STDERR:", err[-1200:], flush=True)
    return code, out, err


def main() -> int:
    password = load_password()
    if not password:
        print("DEPLOY_PASSWORD required", file=sys.stderr)
        return 1
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=30)
    print("Connected.")

    # Upsert non-secret R2 CMS keys in platform_settings (overrides env)
    sql = f"""
UPDATE platform_settings SET value = '{BUCKET}', \"updatedAt\" = NOW() WHERE key = 'R2_BUCKET';
INSERT INTO platform_settings (id, key, value, \"createdAt\", \"updatedAt\")
SELECT gen_random_uuid()::text, 'R2_BUCKET', '{BUCKET}', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = 'R2_BUCKET');

UPDATE platform_settings SET value = '{PUBLIC_URL}', \"updatedAt\" = NOW() WHERE key = 'R2_PUBLIC_URL';
INSERT INTO platform_settings (id, key, value, \"createdAt\", \"updatedAt\")
SELECT gen_random_uuid()::text, 'R2_PUBLIC_URL', '{PUBLIC_URL}', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM platform_settings WHERE key = 'R2_PUBLIC_URL');

SELECT key, left(value, 120) FROM platform_settings WHERE key IN ('R2_BUCKET','R2_PUBLIC_URL') ORDER BY key;
"""
    # Write SQL to a temp file to avoid quoting hell
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/r2-cms-upsert.sql", "w") as f:
        f.write(sql)
    sftp.close()

    code, _, _ = run(
        ssh,
        "docker exec -i cullinos-postgres psql -U cullinos -d cullinos < /tmp/r2-cms-upsert.sql && rm /tmp/r2-cms-upsert.sql",
        timeout=60,
    )
    if code != 0:
        # Prisma often uses cuid ids and camelCase — try without gen_random_uuid insert path already handled by UPDATE
        print("Retry with docker exec bash...", flush=True)
        code, _, _ = run(
            ssh,
            "docker cp /tmp/r2-cms-upsert.sql cullinos-postgres:/tmp/r2-cms-upsert.sql 2>/dev/null; "
            "docker exec cullinos-postgres psql -U cullinos -d cullinos -f /tmp/r2-cms-upsert.sql",
            timeout=60,
        )
        # recreate sql on host first if docker cp needed
        if code != 0:
            # simpler: just UPDATE
            code, _, _ = run(
                ssh,
                "docker exec cullinos-postgres psql -U cullinos -d cullinos -c "
                f"\"UPDATE platform_settings SET value='{BUCKET}', \\\"updatedAt\\\"=NOW() WHERE key='R2_BUCKET'; "
                f"UPDATE platform_settings SET value='{PUBLIC_URL}', \\\"updatedAt\\\"=NOW() WHERE key='R2_PUBLIC_URL'; "
                "SELECT key, left(value,120) FROM platform_settings WHERE key IN ('R2_BUCKET','R2_PUBLIC_URL');\"",
                timeout=60,
            )
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
        return 1

    run(
        ssh,
        "docker logs cullinos-api 2>&1 | grep -iE 'R2 storage' | tail -5",
        timeout=30,
    )
    run(
        ssh,
        "docker exec cullinos-postgres psql -U cullinos -d cullinos -c "
        "\"SELECT key, left(value,120) FROM platform_settings WHERE key IN ('R2_BUCKET','R2_PUBLIC_URL');\"",
        timeout=30,
    )
    ssh.close()
    print("\nDone.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
