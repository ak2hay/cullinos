#!/usr/bin/env python3
"""Upload Firebase Admin credentials to the prod VM and ensure API env is set."""
from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APP_DIR = "/opt/cullinos"
KEY_LOCAL = ROOT / "secrets" / "firebase-adminsdk.json"
KEY_REMOTE = f"{APP_DIR}/secrets/firebase-adminsdk.json"


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


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str]:
    print(f"$ {cmd[:200]}{'...' if len(cmd) > 200 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-2000:], end="" if out.endswith("\n") else "\n", flush=True)
    if code != 0 and err.strip():
        print("STDERR:", err[-1500:], flush=True)
    return code, out


def upsert_env_lines(env_text: str, updates: dict[str, str]) -> str:
    lines = env_text.splitlines()
    keys = set(updates)
    out: list[str] = []
    seen: set[str] = set()
    for line in lines:
        if not line or line.lstrip().startswith("#") or "=" not in line:
            out.append(line)
            continue
        key = line.split("=", 1)[0].strip()
        if key in keys:
            out.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, value in updates.items():
        if key not in seen:
            out.append(f"{key}={value}")
    return "\n".join(out) + "\n"


def main() -> int:
    if not KEY_LOCAL.exists():
        print(f"Missing {KEY_LOCAL}", file=sys.stderr)
        return 1

    raw = KEY_LOCAL.read_bytes()
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as exc:
        print(f"Invalid JSON key file: {exc}", file=sys.stderr)
        return 1
    if parsed.get("project_id") != "rkyves-cullinos":
        print("Warning: project_id is not rkyves-cullinos", flush=True)

    password = load_deploy_password()
    if not password:
        print(
            "DEPLOY_PASSWORD not found. Add to .env as DEPLOY_PASSWORD=... "
            "or set the env var, then re-run.",
            file=sys.stderr,
        )
        return 1

    b64 = base64.b64encode(raw).decode("ascii")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...", flush=True)
    ssh.connect(HOST, username="root", password=password, timeout=30, banner_timeout=60)

    run(ssh, f"mkdir -p {APP_DIR}/secrets && chmod 700 {APP_DIR}/secrets")

    sftp = ssh.open_sftp()
    with sftp.file(KEY_REMOTE, "w") as f:
        f.write(raw.decode("utf-8"))
    sftp.chmod(KEY_REMOTE, 0o600)

    # Read existing .env
    env_path = f"{APP_DIR}/.env"
    try:
        with sftp.file(env_path, "r") as f:
            env_text = f.read().decode("utf-8", errors="replace")
    except OSError:
        env_text = ""

    updates = {
        "FIREBASE_PROJECT_ID": "rkyves-cullinos",
        "FIREBASE_SERVICE_ACCOUNT_PATH": "/secrets/firebase-adminsdk.json",
        "FIREBASE_SERVICE_ACCOUNT_BASE64": b64,
    }
    # Prefer path inside container via compose mount; also keep base64 as fallback
    new_env = upsert_env_lines(env_text, updates)
    with sftp.file(env_path, "w") as f:
        f.write(new_env)
    sftp.close()

    # Ensure host secrets dir used by compose is populated
    run(ssh, f"mkdir -p {APP_DIR}/secrets && cp -f {KEY_REMOTE} {APP_DIR}/secrets/firebase-adminsdk.json && chmod 600 {APP_DIR}/secrets/firebase-adminsdk.json")

    print("Firebase credentials written to VM .env + secrets/.", flush=True)
    print("Next: rebuild API (vm-redeploy-guest-api.py).", flush=True)
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
