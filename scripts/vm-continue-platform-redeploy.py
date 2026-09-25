#!/usr/bin/env python3
"""Continue full platform redeploy after TLS cert is restored (no kiosk in cert)."""
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
EXCLUDE = {
    "node_modules",
    "dist",
    ".next",
    ".turbo",
    "coverage",
    "build",
    "out",
    "electron-dist",
    ".dart_tool",
    ".gradle",
    "__pycache__",
    "test",
    "__tests__",
}


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


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 900) -> tuple[int, str]:
    safe_print(f"\n$ {cmd[:260]}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    text = (out + ("\n" + err if err.strip() else "")).encode("ascii", "replace").decode("ascii")
    if text.strip():
        safe_print(text[-4500:])
    return code, out


def upload(ssh: paramiko.SSHClient, data: bytes, remote: str) -> None:
    sftp = ssh.open_sftp()
    with sftp.file(remote, "wb") as f:
        f.write(data)
    sftp.close()


def make_source_patch() -> bytes:
    buf = io.BytesIO()
    roots = [
        "apps",
        "packages",
        "package.json",
        "package-lock.json",
        ".npmrc",
        "turbo.json",
        "tsconfig.base.json",
        "Dockerfile",
        "Dockerfile.web",
        "docker-compose.prod.yml",
        "infrastructure/nginx/cullinos-frontends.conf",
    ]
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in roots:
            path = ROOT / rel
            if not path.exists():
                continue
            if path.is_file():
                tar.add(path, arcname=rel)
                continue
            for dirpath, dirnames, filenames in os.walk(path):
                dirnames[:] = [d for d in dirnames if d not in EXCLUDE]
                for name in filenames:
                    if name in {".env", ".env.local", "secrets-export.txt"}:
                        continue
                    full = Path(dirpath) / name
                    arc = full.relative_to(ROOT).as_posix()
                    if "/dist/" in f"/{arc}/":
                        continue
                    tar.add(full, arcname=arc)
    return buf.getvalue()


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
        patch = make_source_patch()
        safe_print(f"Source patch {len(patch)/1e6:.1f} MB")
        upload(ssh, patch, "/tmp/cullinos-src-patch.tar.gz")
        code, _ = run(
            ssh,
            f"tar -xzf /tmp/cullinos-src-patch.tar.gz -C {APP_DIR} && rm /tmp/cullinos-src-patch.tar.gz && "
            f"rm -f {APP_DIR}/apps/admin/src/pages/PaymentsPage.tsx && echo PATCH_OK",
        )
        if code != 0:
            return code

        log = "/tmp/cullinos-full-api-build.log"
        script = (
            "#!/bin/bash\nset +e\n"
            f"cd {APP_DIR} && GIT_COMMIT={commit} docker compose -f docker-compose.prod.yml build api "
            f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api\n"
            f"echo $? > {log}.exit\n"
        )
        sftp = ssh.open_sftp()
        with sftp.file(f"{log}.sh", "w") as f:
            f.write(script)
        sftp.close()
        run(
            ssh,
            f"chmod +x {log}.sh && rm -f {log} {log}.exit && nohup bash {log}.sh >{log} 2>&1 & echo $!",
        )
        for _ in range(140):
            _, out = run(
                ssh,
                f"if [ -f {log}.exit ]; then echo DONE:$(cat {log}.exit); "
                f"else bytes=$(wc -c < {log} 2>/dev/null || echo 0); echo RUNNING:$bytes; fi",
                timeout=60,
            )
            line = out.strip().splitlines()[-1] if out.strip() else ""
            if line.startswith("DONE:"):
                if line.split(":", 1)[1].strip() != "0":
                    run(ssh, f"tail -100 {log}")
                    return 1
                break
            time.sleep(25)
        else:
            safe_print("API build timeout")
            return 1

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
        run(ssh, "curl -sf https://api.cullinos.com/api/v1/health; echo")
        safe_print("\nFULL_PLATFORM_REDEPLOY_OK")
        return 0
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
