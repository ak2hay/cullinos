#!/usr/bin/env python3
"""Inspect / finish API build after overlay; then publish SPAs + nginx."""
from __future__ import annotations

import io
import os
import subprocess
import sys
import tarfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APP_DIR = "/opt/cullinos"
WWW = "/var/www/cullinos"
LOG = "/tmp/cullinos-full-api-build.log"

SPA_PUBLISH = {
    "admin": "admin",
    "management": "management",
    "super-admin": "super-admin",
    "app-ops": "app-ops",
    "pos": "pos",
    "kds": "kds",
    "kiosk": "kiosk",
}
LANDINGS = ["guest-landing", "waiter-landing"]


def load_dotenv() -> None:
    env_path = ROOT / ".env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = val


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str]:
    safe_print(f"\n$ {cmd[:240]}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=False)
    channel = stdout.channel
    channel.settimeout(timeout)
    out_chunks: list[bytes] = []
    err_chunks: list[bytes] = []
    deadline = time.time() + timeout
    while True:
        if channel.recv_ready():
            out_chunks.append(channel.recv(65536))
        if channel.recv_stderr_ready():
            err_chunks.append(channel.recv_stderr(65536))
        if channel.exit_status_ready():
            while channel.recv_ready():
                out_chunks.append(channel.recv(65536))
            while channel.recv_stderr_ready():
                err_chunks.append(channel.recv_stderr(65536))
            break
        if time.time() > deadline:
            channel.close()
            raise TimeoutError(f"cmd timed out: {cmd[:120]}")
        time.sleep(0.2)
    code = channel.recv_exit_status()
    out = b"".join(out_chunks).decode("utf-8", errors="replace")
    err = b"".join(err_chunks).decode("utf-8", errors="replace")
    text = (out + ("\n" + err if err.strip() else "")).encode("ascii", "replace").decode("ascii")
    if text.strip():
        safe_print(text[-4500:])
    return code, out


def run_bg_start(ssh: paramiko.SSHClient, cmd: str) -> None:
    """Fire-and-forget: do not wait for stdout (nohup jobs hang otherwise)."""
    safe_print(f"\n$ (bg) {cmd[:240]}")
    transport = ssh.get_transport()
    assert transport is not None
    channel = transport.open_session()
    channel.exec_command(cmd)
    # Give shell a moment to spawn nohup, then close without reading forever.
    time.sleep(2)
    try:
        channel.close()
    except Exception:
        pass


def upload(ssh: paramiko.SSHClient, data: bytes, remote: str) -> None:
    sftp = ssh.open_sftp()
    with sftp.file(remote, "wb") as f:
        f.write(data)
    sftp.close()


def make_publish() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for app, dest in SPA_PUBLISH.items():
            tar.add(ROOT / "apps" / app / "dist", arcname=dest)
        for landing in LANDINGS:
            src = ROOT / "infrastructure" / "www" / landing
            if src.is_dir():
                tar.add(src, arcname=landing)
    return buf.getvalue()


def ensure_api_build(ssh: paramiko.SSHClient, commit: str) -> int:
    # Inspect current state
    run(
        ssh,
        f"ls -la {LOG}* 2>/dev/null || echo NO_LOG; "
        "ps aux | grep -E 'docker compose|docker-compose|build api' | grep -v grep || echo NO_PS",
        timeout=60,
    )
    _, exit_out = run(
        ssh,
        f"if [ -f {LOG}.exit ]; then echo DONE:$(cat {LOG}.exit); else echo NO_EXIT; fi",
        timeout=30,
    )
    line = exit_out.strip().splitlines()[-1] if exit_out.strip() else "NO_EXIT"
    if line.startswith("DONE:"):
        code = line.split(":", 1)[1].strip()
        if code == "0":
            safe_print("API build already succeeded")
            return 0
        run(ssh, f"tail -120 {LOG}", timeout=60)
        return 1

    # Check if build process is running
    _, ps = run(
        ssh,
        "pgrep -af 'docker compose .*build api|docker-compose .*build api|cullinos-full-api-build' || true",
        timeout=30,
    )
    building = bool(ps.strip()) and "pgrep" not in ps

    if not building:
        safe_print("Starting API build...")
        script = (
            "#!/bin/bash\nset +e\n"
            f"cd {APP_DIR} && GIT_COMMIT={commit} docker compose -f docker-compose.prod.yml build api "
            f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api\n"
            f"echo $? > {LOG}.exit\n"
        )
        sftp = ssh.open_sftp()
        with sftp.file(f"{LOG}.sh", "w") as f:
            f.write(script)
        sftp.close()
        run(ssh, f"chmod +x {LOG}.sh && rm -f {LOG} {LOG}.exit", timeout=30)
        run_bg_start(
            ssh,
            f"nohup bash {LOG}.sh >{LOG} 2>&1 </dev/null &",
        )
        time.sleep(3)
        run(ssh, f"pgrep -af '{LOG}.sh|docker compose' || echo START_CHECK_EMPTY; wc -c {LOG} 2>/dev/null || true", timeout=30)

    for i in range(160):
        _, out = run(
            ssh,
            f"if [ -f {LOG}.exit ]; then echo DONE:$(cat {LOG}.exit); "
            f"else bytes=$(stat -c%s {LOG} 2>/dev/null || echo 0); "
            f"echo RUNNING:$bytes; fi",
            timeout=60,
        )
        status = out.strip().splitlines()[-1] if out.strip() else ""
        if status.startswith("DONE:"):
            code = status.split(":", 1)[1].strip()
            if code != "0":
                run(ssh, f"tail -120 {LOG}", timeout=60)
                return 1
            safe_print(f"API build done after poll #{i}")
            return 0
        if i % 4 == 0:
            run(ssh, f"tail -15 {LOG} 2>/dev/null || true", timeout=30)
        time.sleep(20)
    safe_print("API build timeout")
    run(ssh, f"tail -80 {LOG} 2>/dev/null || true", timeout=60)
    return 1


def main() -> int:
    load_dotenv()
    password = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if not password:
        safe_print("DEPLOY_PASSWORD required")
        return 1
    missing = [
        a for a in SPA_PUBLISH if not (ROOT / "apps" / a / "dist" / "index.html").is_file()
    ]
    if missing:
        safe_print(f"Missing SPA dist: {missing}")
        return 1

    commit = (
        subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT)
        .decode()
        .strip()
    )
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST} commit={commit}...")
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=120)

    try:
        code = ensure_api_build(ssh, commit)
        if code != 0:
            return code

        code, _ = run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T --no-deps api "
            "npx prisma db push --schema=packages/prisma/prisma/schema.prisma --skip-generate",
            timeout=900,
        )
        if code != 0:
            return code

        for _ in range(40):
            _, health = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
            if '"status":"ok"' in health.replace(" ", ""):
                safe_print(f"API health: {health.strip()}")
                break
            time.sleep(5)
        else:
            safe_print("API health failed")
            return 1

        pub = make_publish()
        safe_print(f"Publish tarball {len(pub)/1e6:.1f} MB")
        upload(ssh, pub, "/tmp/cullinos-publish.tar.gz")
        targets = list(SPA_PUBLISH.values()) + LANDINGS
        stage = "/tmp/cullinos-publish"
        swap = " && ".join(f"rm -rf {WWW}/{t} && mv {stage}/{t} {WWW}/{t}" for t in targets)
        code, _ = run(
            ssh,
            f"rm -rf {stage} && mkdir -p {stage} {WWW} && tar -xzf /tmp/cullinos-publish.tar.gz -C {stage} && "
            f"{swap} && rm -rf {stage} /tmp/cullinos-publish.tar.gz && echo PUBLISHED",
            timeout=180,
        )
        if code != 0:
            return code

        upload(
            ssh,
            (ROOT / "infrastructure" / "nginx" / "cullinos-frontends.conf").read_bytes(),
            "/tmp/cullinos-frontends.conf.new",
        )
        code, _ = run(
            ssh,
            "cp /tmp/cullinos-frontends.conf.new /etc/nginx/sites-available/cullinos-frontends.conf && "
            "nginx -t && systemctl reload nginx && echo NGINX_OK",
            timeout=60,
        )
        if code != 0:
            return code

        for host in [
            "admin.cullinos.com",
            "platform.cullinos.com",
            "app.cullinos.com",
            "pos.cullinos.com",
            "kds.cullinos.com",
            "manage.cullinos.com",
        ]:
            run(ssh, f"curl -sI --max-time 12 https://{host}/ | head -5", timeout=30)
        run(ssh, "curl -sf https://api.cullinos.com/api/v1/health; echo", timeout=30)
        safe_print("\nFULL_PLATFORM_REDEPLOY_OK")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
