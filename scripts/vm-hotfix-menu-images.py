#!/usr/bin/env python3
"""Hotfix menu image URLs: patch API sources, set API_PUBLIC_URL, rebuild api, publish admin SPA."""
from __future__ import annotations

import io
import os
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APP_DIR = "/opt/cullinos"

API_FILES = [
    "apps/api/src/main.ts",
    "apps/api/src/common/public-asset-url.util.ts",
    "apps/api/src/common/public-asset-url.util.test.ts",
    "apps/api/src/common/sentry.init.ts",
    "apps/api/src/common/cors.util.ts",
    "apps/api/src/modules/marketing/marketing-upload.service.ts",
    "apps/api/src/modules/menu/menu.service.ts",
    "apps/api/src/modules/guest/marketplace.service.ts",
    "apps/api/src/modules/guest/guest-ops.service.ts",
    "apps/api/src/modules/guest/guest-ops.controller.ts",
    "apps/admin/src/components/ImageUploadField.tsx",
    "apps/super-admin/src/pages/guest-ops/PushPage.tsx",
    "apps/super-admin/src/lib/api.ts",
    "apps/guest/lib/features/explore/explore_page.dart",
    "apps/guest/lib/features/profile/notifications_page.dart",
    "apps/guest/lib/features/orders/push_service.dart",
    "apps/guest/lib/widgets/guest_network_image.dart",
]


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1].strip()
    for name in (".env", ".env.production", ".env.local"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("DEPLOY_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-4000:], flush=True)
    if code != 0 and err.strip():
        print("STDERR:", err[-2000:], flush=True)
    return code, out, err


def run_detached(
    ssh: paramiko.SSHClient,
    cmd: str,
    log_path: str,
    *,
    timeout_sec: int = 2400,
    poll_sec: int = 20,
) -> tuple[int, str]:
    print(f"\n$ [detached] {cmd[:220]}", flush=True)
    script_path = f"{log_path}.sh"
    script = f"#!/bin/bash\nset +e\n{cmd}\necho $? > {log_path}.exit\n"
    sftp = ssh.open_sftp()
    with sftp.file(script_path, "w") as f:
        f.write(script)
    sftp.chmod(script_path, 0o755)
    sftp.close()
    run(ssh, f"rm -f {log_path} {log_path}.exit; nohup bash {script_path} >{log_path} 2>&1 & echo $!", timeout=30)
    deadline = time.time() + timeout_sec
    last_size = -1
    while time.time() < deadline:
        time.sleep(poll_sec)
        run(ssh, "true", timeout=30)
        _, status, _ = run(
            ssh,
            f"if test -f {log_path}.exit; then echo DONE:$(cat {log_path}.exit); "
            f"elif test -f {log_path}; then echo RUNNING:$(wc -c < {log_path}); "
            f"else echo WAITING; fi; "
            f"tail -n 5 {log_path} 2>/dev/null || true",
            timeout=60,
        )
        done = next((line for line in status.splitlines() if line.startswith("DONE:")), None)
        if done is not None:
            try:
                exit_code = int(done.split(":", 1)[1].strip())
            except ValueError:
                exit_code = 1
            _, log_out, _ = run(ssh, f"tail -n 80 {log_path} 2>/dev/null || true", timeout=60)
            return exit_code, log_out
        running = next((line for line in status.splitlines() if line.startswith("RUNNING:")), None)
        if running:
            try:
                size = int(running.split(":", 1)[1].strip())
                if size != last_size:
                    print(f"  … building ({size} bytes log)", flush=True)
                    last_size = size
            except ValueError:
                print("  … building", flush=True)
    run(ssh, f"tail -n 80 {log_path} 2>/dev/null || true", timeout=60)
    return 1, "timed out"


def make_patch() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in API_FILES:
            path = ROOT / rel
            # Compose image may lack @sentry/node — ship no-op stub.
            if rel.endswith("sentry.init.ts"):
                stub = ROOT / "scripts/deploy-stubs/sentry.init.ts"
                if stub.exists():
                    path = stub
            if not path.exists():
                print(f"skip missing: {rel}")
                continue
            tar.add(path, arcname=rel)
            print(f"pack {rel} <- {path.relative_to(ROOT)}")
    buf.seek(0)
    return buf.read()


def main() -> int:
    password = load_password()
    if not password:
        print("DEPLOY_PASSWORD required", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=30, banner_timeout=60)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)
    print("Connected.")

    # Ensure absolute public URL for local /cms fallback + normalize
    print("\n=== Ensure API_PUBLIC_URL / MARKETING_PUBLIC_URL ===")
    run(
        ssh,
        f"""
set -e
ENV={APP_DIR}/.env
touch "$ENV"
grep -q '^API_PUBLIC_URL=' "$ENV" \
  && sed -i 's|^API_PUBLIC_URL=.*|API_PUBLIC_URL=https://api.cullinos.com|' "$ENV" \
  || echo 'API_PUBLIC_URL=https://api.cullinos.com' >> "$ENV"
grep -q '^MARKETING_PUBLIC_URL=' "$ENV" \
  && sed -i 's|^MARKETING_PUBLIC_URL=.*|MARKETING_PUBLIC_URL=https://api.cullinos.com/cms|' "$ENV" \
  || echo 'MARKETING_PUBLIC_URL=https://api.cullinos.com/cms' >> "$ENV"
grep -E '^(API_PUBLIC_URL|MARKETING_PUBLIC_URL|R2_PUBLIC_URL|R2_BUCKET)=' "$ENV" || true
""",
        timeout=60,
    )

    print("\n=== Upload source patch ===")
    patch = make_patch()
    print(f"Patch size: {len(patch) / 1000:.1f} KB")
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos-image-fix.tar.gz", "wb") as f:
        f.write(patch)
    sftp.close()
    code, _, _ = run(
        ssh,
        f"tar -xzf /tmp/cullinos-image-fix.tar.gz -C {APP_DIR} && rm /tmp/cullinos-image-fix.tar.gz && "
        f"test -f {APP_DIR}/apps/api/src/common/public-asset-url.util.ts && echo PATCH_OK",
    )
    if code != 0:
        return code

    print("\n=== Rebuild + recreate API ===")
    code, log = run_detached(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build api "
        f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api",
        "/tmp/cullinos-image-fix-api.log",
        timeout_sec=2400,
    )
    if code != 0:
        print("API rebuild failed", file=sys.stderr)
        print(log[-3000:], file=sys.stderr)
        return code

    for _ in range(36):
        _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if '"status":"ok"' in health.replace(" ", "") or '"status": "ok"' in health:
            print("API health OK")
            break
        time.sleep(5)
    else:
        print("API health check did not pass", file=sys.stderr)
        return 1

    # Verify /cms static mount responds (404 without file is OK; 502 is not)
    _, cms, _ = run(ssh, "curl -sI http://127.0.0.1:3000/cms/ | head -n 5 || true", timeout=30)
    print("CMS headers:", cms)

    print("\nDone. Admin SPA still needs a local build + publish for ImageUploadField preview.")
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
