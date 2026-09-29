#!/usr/bin/env python3
"""Install Firebase Admin SA on Compose prod VM and wire FCM HTTP v1 env.

Uploads secrets/firebase-adminsdk.json → /opt/cullinos/secrets/
Sets FIREBASE_PROJECT_ID + FIREBASE_SERVICE_ACCOUNT_PATH in VM .env
Overlays guest push / firebase-admin / registry / ops service sources
Rebuilds + recreates API, prints Firebase init log lines (never prints the JSON).

Env:
  DEPLOY_PASSWORD  required (or DEPLOY_PASSWORD= in local .env)
  DEPLOY_HOST      (required)
"""
from __future__ import annotations

import io
import os
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST") or sys.exit("Set DEPLOY_HOST explicitly (no default target).")
APP_DIR = "/opt/cullinos"
SA_LOCAL = ROOT / "secrets" / "firebase-adminsdk.json"
SA_REMOTE = f"{APP_DIR}/secrets/firebase-adminsdk.json"
SA_CONTAINER_PATH = "/secrets/firebase-adminsdk.json"

PATCH_FILES = [
    "apps/api/src/modules/guest/firebase-admin.service.ts",
    "apps/api/src/modules/guest/guest-push.service.ts",
    "apps/api/src/modules/guest/guest-push.service.test.ts",
    "apps/api/src/modules/guest/guest-ops.service.ts",
    "apps/api/src/modules/platform-config/platform-config.registry.ts",
    "apps/app-ops/src/pages/guest-ops/RuntimePage.tsx",
    "apps/super-admin/src/pages/guest-ops/RuntimePage.tsx",
    "docs/guest-app/FIREBASE_PROD.md",
    "docs/guest-app/PLAY_STORE_CHECKLIST.md",
]


def load_deploy_password() -> str:
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


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-4000:] if len(out) > 4000 else out, flush=True)
    if code != 0 and err.strip():
        print("STDERR:", err[-2000:] if len(err) > 2000 else err, flush=True)
    return code, out, err


def upload_bytes(ssh: paramiko.SSHClient, data: bytes, remote: str) -> None:
    sftp = ssh.open_sftp()
    try:
        remote_dir = str(Path(remote).parent).replace("\\", "/")
        try:
            sftp.stat(remote_dir)
        except OSError:
            run(ssh, f"mkdir -p {remote_dir}")
        with sftp.file(remote, "wb") as f:
            f.write(data)
        sftp.chmod(remote, 0o600)
    finally:
        sftp.close()


def set_env(ssh: paramiko.SSHClient, key: str, value: str) -> None:
    # Escape for sed replacement (path may contain /)
    esc = value.replace("\\", "\\\\").replace("&", r"\&").replace("\n", "")
    run(
        ssh,
        f"cd {APP_DIR} && cp .env /tmp/cullinos.env.bak-$(date +%s) && "
        f"(grep -q '^{key}=' .env && sed -i 's|^{key}=.*|{key}={esc}|' .env || echo '{key}={value}' >> .env) && "
        f"grep -E '^{key}=' .env | sed 's/=.*/=***/'",
    )


def make_patch() -> bytes:
    missing = [p for p in PATCH_FILES if not (ROOT / p).is_file()]
    if missing:
        raise FileNotFoundError(f"Missing patch files: {missing}")
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in PATCH_FILES:
            tar.add(ROOT / rel, arcname=rel)
    buf.seek(0)
    return buf.read()


def run_detached(
    ssh: paramiko.SSHClient,
    cmd: str,
    log_path: str,
    *,
    timeout_sec: int = 2400,
    poll_sec: int = 20,
) -> int:
    script_path = f"{log_path}.sh"
    script = f"#!/bin/bash\nset +e\n{cmd}\necho $? > {log_path}.exit\n"
    sftp = ssh.open_sftp()
    with sftp.file(script_path, "w") as f:
        f.write(script)
    sftp.chmod(script_path, 0o755)
    sftp.close()

    code, _, _ = run(
        ssh,
        f"rm -f {log_path} {log_path}.exit; nohup bash {script_path} >{log_path} 2>&1 & echo $!",
        timeout=30,
    )
    if code != 0:
        return code

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
            f"tail -n 6 {log_path} 2>/dev/null || true",
            timeout=60,
        )
        done = next((line for line in status.splitlines() if line.startswith("DONE:")), None)
        if done is not None:
            try:
                return int(done.split(":", 1)[1].strip())
            except ValueError:
                return 1
        running = next((line for line in status.splitlines() if line.startswith("RUNNING:")), None)
        if running:
            try:
                size = int(running.split(":", 1)[1].strip())
                if size != last_size:
                    print(f"  … building ({size} bytes log)", flush=True)
                    last_size = size
            except ValueError:
                pass
    run(ssh, f"tail -n 100 {log_path} 2>/dev/null || true", timeout=60)
    return 1


def main() -> int:
    if not SA_LOCAL.is_file():
        print(f"Missing {SA_LOCAL} — copy the Firebase Admin JSON there first.", file=sys.stderr)
        return 1

    password = load_deploy_password()
    if not password:
        print(
            "DEPLOY_PASSWORD required. Example:\n"
            "  $env:DEPLOY_PASSWORD='your-root-password'\n"
            "  python scripts/vm-install-firebase-fcm.py",
            file=sys.stderr,
        )
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...", flush=True)
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=90)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)

    try:
        print("=== Upload Firebase Admin JSON ===", flush=True)
        upload_bytes(ssh, SA_LOCAL.read_bytes(), SA_REMOTE)
        run(ssh, f"test -f {SA_REMOTE} && ls -l {SA_REMOTE} | awk '{{print $1,$5,$NF}}'")

        print("=== Wire .env ===", flush=True)
        set_env(ssh, "FIREBASE_PROJECT_ID", "rkyves-cullinos")
        set_env(ssh, "FIREBASE_SERVICE_ACCOUNT_PATH", SA_CONTAINER_PATH)

        print("=== Overlay FCM HTTP v1 sources ===", flush=True)
        patch = make_patch()
        upload_bytes(ssh, patch, "/tmp/cullinos-fcm-patch.tar.gz")
        code, _, _ = run(
            ssh,
            f"tar -xzf /tmp/cullinos-fcm-patch.tar.gz -C {APP_DIR} && rm /tmp/cullinos-fcm-patch.tar.gz && echo PATCH_OK",
        )
        if code != 0:
            return code

        print("=== Rebuild API ===", flush=True)
        code = run_detached(
            ssh,
            f"cd {APP_DIR} && "
            f"GIT_COMMIT=$(git -C {APP_DIR} rev-parse --short HEAD 2>/dev/null || echo fcm-v1) "
            f"docker compose -f docker-compose.prod.yml build api && "
            f"docker compose -f docker-compose.prod.yml up -d --force-recreate api",
            "/tmp/cullinos-fcm-api-build.log",
        )
        if code != 0:
            print("API rebuild failed", file=sys.stderr)
            run(ssh, "tail -n 80 /tmp/cullinos-fcm-api-build.log || true")
            return code

        print("=== Health + Firebase log ===", flush=True)
        time.sleep(8)
        run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true")
        run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=80 api "
            f"| grep -iE 'Firebase Admin|FCM|not configured' || true",
        )
        print("\nDone. Check App Ops → Runtime for FCM configured (HTTP v1).", flush=True)
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
