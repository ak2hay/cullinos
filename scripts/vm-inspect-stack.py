#!/usr/bin/env python3
"""One-shot: inspect prod stack. Password via DEPLOY_PASSWORD env or .env."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")


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


def try_connect(password: str) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password, timeout=30, banner_timeout=60)
    return ssh


def main() -> int:
    candidates: list[tuple[str, str]] = []
    env_pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if env_pw:
        candidates.append(("env", env_pw))
    file_pw = ""
    for name in (".env", ".env.production", ".env.local"):
        path = ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("DEPLOY_PASSWORD="):
                file_pw = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
        if file_pw:
            candidates.append((name, file_pw))
            break
    # Also try user-supplied variants if present in argv (never print them)
    if len(sys.argv) > 1 and sys.argv[1].strip():
        candidates.insert(0, ("argv", sys.argv[1].strip()))

    if not candidates:
        print("DEPLOY_PASSWORD required", file=sys.stderr)
        return 1

    ssh = None
    last_err: Exception | None = None
    for label, password in candidates:
        try:
            print(f"Trying auth source={label} len={len(password)}...")
            ssh = try_connect(password)
            print(f"Connected with source={label}")
            break
        except Exception as exc:
            last_err = exc
            print(f"Auth failed for source={label}: {type(exc).__name__}")
    if ssh is None:
        print(f"All auth attempts failed: {last_err}", file=sys.stderr)
        return 1

    cmds = [
        "command -v kubectl; kubectl get ns 2>/dev/null | head -20 || true",
        'docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null | head -40 || true',
        "grep -E '^(API_PUBLIC_URL|MARKETING_PUBLIC_URL|R2_PUBLIC_URL|R2_BUCKET|R2_ACCOUNT_ID)=' /opt/cullinos/.env 2>/dev/null || echo NO_ENV_KEYS",
        "ls -la /opt/cullinos/docker-compose.prod.yml 2>/dev/null; ls /var/www/cullinos 2>/dev/null | head",
        "curl -sf http://127.0.0.1:3000/api/v1/health || true",
    ]
    for cmd in cmds:
        print(f"\n=== {cmd}")
        _, stdout, stderr = ssh.exec_command(cmd, timeout=60)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        sys.stdout.write(out)
        if err.strip():
            sys.stdout.write("STDERR: " + err[:800] + "\n")
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
