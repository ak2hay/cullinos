#!/usr/bin/env python3
"""Selective Cullinos prod deploy (Compose VM) without wiping /opt/cullinos.

1. Preflight (read-only): OTP/SMTP posture — prints flags and counts, never secret values.
2. Overlay workspace sources (apps/*, packages/*, lockfile, Dockerfiles, compose) onto /opt/cullinos.
   The API image copies every workspace and runs `npm ci`, so all package.json files must match the lock.
   .env, secrets/, archive/ and dist-exports/ on the VM are never touched.
3. Cached `docker compose build api` with GIT_COMMIT, recreate, `prisma db push`, health check.
4. Publish locally built SPAs + static landings to /var/www/cullinos/<name>/.
5. Install infrastructure/nginx/cullinos-frontends.conf (backup + auto-restore if `nginx -t` fails).
6. Rebuild the marketing web container.

Env:
  DEPLOY_PASSWORD           root password (required)
  DEPLOY_HOST               default 95.135.254.46
  DEPLOY_PREFLIGHT_ONLY=1   run step 1 only
  DEPLOY_WEB=0              skip marketing web rebuild
  DEPLOY_NGINX=0            skip nginx config install
  ALLOW_SANDBOX_OTP_SKIP    if set (true/false), written to the VM .env before the API is recreated
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
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_git import local_git_commit  # noqa: E402

GIT_COMMIT = local_git_commit()
APP_DIR = "/opt/cullinos"
WWW = "/var/www/cullinos"
NGINX_FRONTENDS = "/etc/nginx/sites-available/cullinos-frontends.conf"

PATCH_ROOTS = [
    "apps",
    "packages",
    "package.json",
    "package-lock.json",
    ".npmrc",
    "index.js",
    "turbo.json",
    "tsconfig.base.json",
    "Dockerfile",
    "Dockerfile.web",
    "docker-compose.prod.yml",
]

# Flutter apps are not part of any Docker image.
SKIP_APP_DIRS = {"guest", "waiter_mobile"}

# Vite workspace -> /var/www/cullinos/<dir>
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

EXCLUDE_DIR_NAMES = {
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
EXCLUDE_FILE_NAMES = {".env", ".env.local", "secrets-export.txt"}


def safe_print(text: str) -> None:
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        print(text.encode("ascii", "replace").decode("ascii"), flush=True)


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600, echo: bool = True) -> tuple[int, str, str]:
    if echo:
        safe_print(f"\n$ {cmd[:240]}{'...' if len(cmd) > 240 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe_print(out[-5000:])
    if code != 0 and err.strip():
        safe_print("STDERR: " + err[-3000:])
    return code, out, err


def run_detached(
    ssh: paramiko.SSHClient,
    cmd: str,
    log_path: str,
    *,
    timeout_sec: int = 2400,
    poll_sec: int = 15,
) -> tuple[int, str]:
    safe_print(f"\n$ [detached] {cmd[:220]}{'...' if len(cmd) > 220 else ''}")
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
        _, status, _ = run(
            ssh,
            f"if test -f {log_path}.exit; then echo DONE:$(cat {log_path}.exit); "
            f"elif test -f {log_path}; then echo RUNNING:$(wc -c < {log_path}); "
            f"else echo WAITING; fi",
            timeout=60,
            echo=False,
        )
        done = next((line for line in status.splitlines() if line.startswith("DONE:")), None)
        if done is not None:
            try:
                exit_code = int(done.split(":", 1)[1].strip())
            except ValueError:
                exit_code = 1
            _, log_out, _ = run(ssh, f"tail -n 60 {log_path} 2>/dev/null || true", timeout=60)
            return exit_code, log_out
        running = next((line for line in status.splitlines() if line.startswith("RUNNING:")), None)
        if running:
            try:
                size = int(running.split(":", 1)[1].strip())
                if size != last_size:
                    safe_print(f"  ... still running ({size} bytes log)")
                    last_size = size
            except ValueError:
                pass
    run(ssh, f"tail -n 80 {log_path} 2>/dev/null || true", timeout=60)
    return 1, "detached timed out"


def _source_filter(ti: tarfile.TarInfo) -> tarfile.TarInfo | None:
    parts = Path(ti.name).parts
    if any(p in EXCLUDE_DIR_NAMES for p in parts):
        return None
    if len(parts) >= 2 and parts[0] == "apps" and parts[1] in SKIP_APP_DIRS:
        return None
    name = Path(ti.name).name
    if name in EXCLUDE_FILE_NAMES or name.endswith(".map") or name.endswith(".tsbuildinfo"):
        return None
    return ti


def make_source_patch() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in PATCH_ROOTS:
            path = ROOT / rel
            if not path.exists():
                safe_print(f"skip missing: {rel}")
                continue
            tar.add(path, arcname=rel, filter=_source_filter)
    buf.seek(0)
    return buf.read()


def make_publish_tarball(spa_apps: list[str]) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for app in spa_apps:
            tar.add(ROOT / "apps" / app / "dist", arcname=SPA_PUBLISH[app])
            safe_print(f"pack apps/{app}/dist -> {SPA_PUBLISH[app]}")
        for landing in LANDINGS:
            tar.add(ROOT / "infrastructure" / "www" / landing, arcname=landing)
            safe_print(f"pack infrastructure/www/{landing} -> {landing}")
    buf.seek(0)
    return buf.read()


def upload(ssh: paramiko.SSHClient, data: bytes, remote: str) -> None:
    sftp = ssh.open_sftp()
    with sftp.file(remote, "wb") as f:
        f.write(data)
    sftp.close()


def connect(password: str) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=90)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)
    return ssh


def preflight(ssh: paramiko.SSHClient) -> None:
    safe_print("\n=== Preflight: OTP / SMTP posture (flags and counts only) ===")
    run(
        ssh,
        f"cd {APP_DIR} && grep -E '^(NODE_ENV|AUTH_SKIP_EMAIL_OTP|ALLOW_SANDBOX_OTP_SKIP)=' .env || true; "
        f"echo SMTP_HOST_in_env=$(grep -cE '^SMTP_HOST=.+' .env)",
    )
    psql = "docker exec cullinos-postgres psql -U cullinos -d cullinos -tA -F ' | ' -c"
    run(
        ssh,
        f"{psql} \"select 'orgs env_class=' || environment_class || ' skip_email_otp=' || sandbox_skip_email_otp, "
        f"count(*) from organizations group by environment_class, sandbox_skip_email_otp order by 1\"; "
        f"{psql} \"select 'smtp setting ' || key, (coalesce(value,'') <> '' or coalesce(value_enc,'') <> '') "
        f"from platform_settings where key like 'SMTP%' order by key\"",
    )
    run(ssh, "curl -s http://127.0.0.1:3000/api/v1/health; echo")


def set_env_flag(ssh: paramiko.SSHClient, key: str, value: str) -> None:
    run(
        ssh,
        f"cd {APP_DIR} && cp .env /tmp/cullinos.env.bak-$(date +%s) && "
        f"(grep -q '^{key}=' .env && sed -i 's/^{key}=.*/{key}={value}/' .env || echo '{key}={value}' >> .env) && "
        f"grep -E '^{key}=' .env",
    )


def main() -> int:
    password = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if not password:
        print("DEPLOY_PASSWORD required", file=sys.stderr)
        return 1

    preflight_only = os.environ.get("DEPLOY_PREFLIGHT_ONLY") == "1"
    spa_apps = [a for a in SPA_PUBLISH if (ROOT / "apps" / a / "dist" / "index.html").exists()]
    if not preflight_only:
        missing = [a for a in SPA_PUBLISH if a not in spa_apps]
        if missing:
            print(f"Missing SPA builds (build locally first): {', '.join(missing)}", file=sys.stderr)
            return 1

    ssh = connect(password)
    try:
        preflight(ssh)
        if preflight_only:
            return 0

        safe_print(f"\n=== Overlay sources onto {APP_DIR} (commit {GIT_COMMIT}) ===")
        patch = make_source_patch()
        safe_print(f"Source patch: {len(patch) / 1_000_000:.1f} MB")
        upload(ssh, patch, "/tmp/cullinos-src-patch.tar.gz")
        code, _, _ = run(
            ssh,
            f"tar -xzf /tmp/cullinos-src-patch.tar.gz -C {APP_DIR} && rm /tmp/cullinos-src-patch.tar.gz && "
            f"rm -f {APP_DIR}/apps/admin/src/pages/PaymentsPage.tsx && echo PATCH_OK",
        )
        if code != 0:
            return code

        allow_skip = os.environ.get("ALLOW_SANDBOX_OTP_SKIP", "").strip().lower()
        if allow_skip in {"true", "false"}:
            set_env_flag(ssh, "ALLOW_SANDBOX_OTP_SKIP", allow_skip)

        safe_print("\n=== Build api (cached) + recreate ===")
        code, log = run_detached(
            ssh,
            f"cd {APP_DIR} && GIT_COMMIT={GIT_COMMIT} docker compose -f docker-compose.prod.yml build api "
            f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api",
            "/tmp/cullinos-selective-api-build.log",
        )
        if code != 0:
            print("API build/recreate failed", file=sys.stderr)
            return code

        safe_print("\n=== Prisma schema sync (db push, no data loss) ===")
        code, _, _ = run(
            ssh,
            f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml run --rm -T --no-deps api "
            "npx prisma db push --schema=packages/prisma/prisma/schema.prisma --skip-generate",
            timeout=900,
        )
        if code != 0:
            print("Schema sync failed (refused data loss or DB error) - API is up on the new image", file=sys.stderr)
            return code

        health_body = ""
        for _ in range(36):
            _, health_body, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30, echo=False)
            if '"status":"ok"' in health_body.replace(" ", ""):
                safe_print(f"API health OK: {health_body.strip()}")
                break
            time.sleep(5)
        else:
            run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=80 api")
            return 1

        safe_print(f"\n=== Publish SPAs + landings: {', '.join(spa_apps + LANDINGS)} ===")
        pub = make_publish_tarball(spa_apps)
        upload(ssh, pub, "/tmp/cullinos-publish.tar.gz")
        stage = "/tmp/cullinos-publish"
        targets = [SPA_PUBLISH[a] for a in spa_apps] + LANDINGS
        swap = " && ".join(f"rm -rf {WWW}/{t} && mv {stage}/{t} {WWW}/{t}" for t in targets)
        code, _, _ = run(
            ssh,
            f"rm -rf {stage} && mkdir -p {stage} {WWW} && tar -xzf /tmp/cullinos-publish.tar.gz -C {stage} && "
            f"{swap} && rm -rf {stage} /tmp/cullinos-publish.tar.gz && echo PUBLISHED",
        )
        if code != 0:
            return code

        nginx_result = "skipped"
        if os.environ.get("DEPLOY_NGINX", "1") == "1":
            safe_print("\n=== nginx: cullinos-frontends.conf ===")
            conf = (ROOT / "infrastructure" / "nginx" / "cullinos-frontends.conf").read_text(encoding="utf-8")
            upload(ssh, conf.replace("\r\n", "\n").encode("utf-8"), "/tmp/cullinos-frontends.conf")
            code, _, _ = run(
                ssh,
                f"cp {NGINX_FRONTENDS} /root/cullinos-frontends.conf.bak-$(date +%s) && "
                f"cp {NGINX_FRONTENDS} /tmp/cullinos-frontends.prev && "
                f"cp /tmp/cullinos-frontends.conf {NGINX_FRONTENDS} && "
                f"if nginx -t; then systemctl reload nginx && echo NGINX_RELOADED; "
                f"else cp /tmp/cullinos-frontends.prev {NGINX_FRONTENDS} && nginx -t && systemctl reload nginx "
                f"&& echo NGINX_RESTORED_PREVIOUS && exit 3; fi",
            )
            nginx_result = "installed" if code == 0 else f"FAILED({code}) - previous config restored"
        else:
            run(ssh, "nginx -t && systemctl reload nginx")

        web_result = "skipped"
        if os.environ.get("DEPLOY_WEB", "1") == "1":
            safe_print("\n=== Rebuild marketing web ===")
            code, _ = run_detached(
                ssh,
                f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml build web "
                f"&& docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps web",
                "/tmp/cullinos-selective-web-build.log",
            )
            web_result = "rebuilt" if code == 0 else f"FAILED({code})"

        safe_print("\n======== SELECTIVE DEPLOY REPORT ========")
        safe_print(f"Commit: {GIT_COMMIT}")
        safe_print(f"Health: {health_body.strip()}")
        safe_print(f"Published: {', '.join(targets)}")
        safe_print(f"nginx frontends: {nginx_result}")
        safe_print(f"Marketing web: {web_result}")
        safe_print("=========================================")
        return 0 if "FAILED" not in nginx_result + web_result else 1
    finally:
        try:
            ssh.close()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
