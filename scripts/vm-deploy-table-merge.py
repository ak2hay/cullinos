#!/usr/bin/env python3
"""Targeted prod deploy (Compose VM) for table merge / transfer.

Ships only the tables API module, Prisma schema + table_merge_link migration and the admin SPA.
Nothing else in the local working tree is uploaded.

Steps:
  1. Check (read-only): diff VM copies of the patch files against local, and print the SQL
     `prisma db push` would run (prisma migrate diff against the live DB).
  2. pg_dump backup to /root/backups/.
  3. Overlay patch files, cached `docker compose build api`, recreate, `prisma db push` (no data loss).
  4. Publish apps/admin/dist to /var/www/cullinos/admin (previous copy kept as admin.prev-<ts>).

Env:
  DEPLOY_PASSWORD        root password (required)
  DEPLOY_HOST            (required)
  DEPLOY_CHECK_ONLY=1    run step 1 only
  DEPLOY_SNAPSHOT_DIR    where VM copies of patch files are saved during the check

Rollback: see docs/BACKUP_ROLLBACK.md. The pre-deploy dump path is printed in the report;
restore with pg_restore, re-overlay the saved VM copies and rebuild api; admin: mv admin.prev-<ts> back.
"""
from __future__ import annotations

import difflib
import io
import os
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST") or sys.exit("Set DEPLOY_HOST explicitly (no default target).")
APP_DIR = "/opt/cullinos"
WWW = "/var/www/cullinos"
COMPOSE = "docker compose -f docker-compose.prod.yml"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_git import local_git_commit  # noqa: E402

PATCH_FILES = [
    "apps/api/src/modules/tables/table-sessions.service.ts",
    "apps/api/src/modules/tables/tables.service.ts",
    "apps/api/src/modules/tables/tables.controller.ts",
    "apps/api/src/modules/tables/table-merge.util.ts",
    "apps/api/src/modules/tables/dto/tables.dto.ts",
    "packages/prisma/prisma/schema.prisma",
    "packages/prisma/prisma/migrations/20260927140000_table_merge_link/migration.sql",
]


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
    if echo and out.strip():
        safe_print(out[-6000:])
    if code != 0 and err.strip():
        safe_print("STDERR: " + err[-3000:])
    return code, out, err


def run_detached(ssh: paramiko.SSHClient, cmd: str, log_path: str, timeout_sec: int = 2400) -> int:
    safe_print(f"\n$ [detached] {cmd[:220]}")
    sftp = ssh.open_sftp()
    with sftp.file(f"{log_path}.sh", "w") as f:
        f.write(f"#!/bin/bash\nset +e\n{cmd}\necho $? > {log_path}.exit\n")
    sftp.chmod(f"{log_path}.sh", 0o755)
    sftp.close()
    run(ssh, f"rm -f {log_path} {log_path}.exit; nohup bash {log_path}.sh >{log_path} 2>&1 & echo $!", timeout=30)
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        time.sleep(15)
        _, status, _ = run(
            ssh,
            f"if test -f {log_path}.exit; then echo DONE:$(cat {log_path}.exit); else echo RUNNING; fi",
            timeout=60,
            echo=False,
        )
        if "DONE:" in status:
            run(ssh, f"tail -n 40 {log_path}", timeout=60)
            try:
                return int(status.split("DONE:", 1)[1].strip().splitlines()[0])
            except ValueError:
                return 1
        safe_print("  ... still running")
    run(ssh, f"tail -n 80 {log_path}", timeout=60)
    return 1


def read_remote(ssh: paramiko.SSHClient, rel: str) -> str | None:
    sftp = ssh.open_sftp()
    try:
        with sftp.file(f"{APP_DIR}/{rel}", "r") as f:
            return f.read().decode("utf-8", errors="replace")
    except OSError:
        return None
    finally:
        sftp.close()


def upload(ssh: paramiko.SSHClient, data: bytes, remote: str) -> None:
    sftp = ssh.open_sftp()
    with sftp.file(remote, "wb") as f:
        f.write(data)
    sftp.close()


def check(ssh: paramiko.SSHClient) -> None:
    snap = Path(os.environ.get("DEPLOY_SNAPSHOT_DIR") or tempfile.mkdtemp(prefix="cullinos-vm-snapshot-"))
    safe_print(f"\n=== VM vs local patch files (VM copies saved to {snap}) ===")
    for rel in PATCH_FILES:
        local = (ROOT / rel).read_text(encoding="utf-8").replace("\r\n", "\n")
        remote = read_remote(ssh, rel)
        if remote is None:
            safe_print(f"NEW on VM   {rel}")
            continue
        remote = remote.replace("\r\n", "\n")
        out = snap / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(remote, encoding="utf-8")
        if remote == local:
            safe_print(f"same        {rel}")
            continue
        diff = list(difflib.unified_diff(remote.splitlines(), local.splitlines(), lineterm="", n=0))
        added = sum(1 for d in diff if d.startswith("+") and not d.startswith("+++"))
        removed = sum(1 for d in diff if d.startswith("-") and not d.startswith("---"))
        safe_print(f"differs     {rel}  (+{added} -{removed} vs VM)")

    safe_print("\n=== SQL that prisma db push would run on the live DB (dry run) ===")
    schema = (ROOT / "packages/prisma/prisma/schema.prisma").read_bytes()
    upload(ssh, schema, "/tmp/cullinos-local-schema.prisma")
    run(
        ssh,
        f"cd {APP_DIR} && {COMPOSE} run --rm -T --no-deps "
        f"-v /tmp/cullinos-local-schema.prisma:/tmp/local.prisma api "
        f"npx prisma migrate diff --from-schema-datasource /tmp/local.prisma "
        f"--to-schema-datamodel /tmp/local.prisma --script",
        timeout=600,
    )
    run(ssh, "rm -f /tmp/cullinos-local-schema.prisma; curl -s http://127.0.0.1:3000/api/v1/health; echo")


def make_patch() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for rel in PATCH_FILES:
            tar.add(ROOT / rel, arcname=rel)
    buf.seek(0)
    return buf.read()


def make_admin_tarball() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        tar.add(ROOT / "apps" / "admin" / "dist", arcname="admin")
    buf.seek(0)
    return buf.read()


def deploy(ssh: paramiko.SSHClient) -> int:
    commit = local_git_commit()
    ts = time.strftime("%Y%m%d-%H%M%S")

    safe_print("\n=== DB backup ===")
    dump = f"/root/backups/pre-table-merge-{ts}.dump"
    code, _, _ = run(
        ssh,
        f"mkdir -p /root/backups && docker exec cullinos-postgres pg_dump -U cullinos -d cullinos -Fc > {dump} "
        f"&& ls -lh {dump}",
        timeout=1200,
    )
    if code != 0:
        safe_print("Backup failed - aborting before any change")
        return code

    safe_print("\n=== Overlay patch files ===")
    upload(ssh, make_patch(), "/tmp/cullinos-table-merge.tar.gz")
    code, _, _ = run(
        ssh,
        f"tar -xzf /tmp/cullinos-table-merge.tar.gz -C {APP_DIR} && rm /tmp/cullinos-table-merge.tar.gz && echo PATCH_OK",
    )
    if code != 0:
        return code

    safe_print("\n=== Build api (cached) + recreate ===")
    code = run_detached(
        ssh,
        f"cd {APP_DIR} && GIT_COMMIT={commit}-tablemerge {COMPOSE} build api "
        f"&& {COMPOSE} up -d --force-recreate --no-deps api",
        "/tmp/cullinos-table-merge-build.log",
    )
    if code != 0:
        safe_print("API build/recreate failed")
        return code

    safe_print("\n=== Prisma db push (no data loss) ===")
    code, _, _ = run(
        ssh,
        f"cd {APP_DIR} && {COMPOSE} run --rm -T --no-deps api "
        "node packages/prisma/scripts/migrate-deploy.mjs",
        timeout=900,
    )
    if code != 0:
        safe_print("db push failed (refused data loss or DB error)")
        return code

    health = ""
    for _ in range(36):
        _, health, _ = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30, echo=False)
        if '"status":"ok"' in health.replace(" ", ""):
            break
        time.sleep(5)
    else:
        run(ssh, f"cd {APP_DIR} && {COMPOSE} logs --tail=80 api")
        return 1
    safe_print(f"API health OK: {health.strip()}")

    safe_print("\n=== Publish admin SPA ===")
    upload(ssh, make_admin_tarball(), "/tmp/cullinos-admin.tar.gz")
    code, _, _ = run(
        ssh,
        f"rm -rf /tmp/cullinos-admin-stage && mkdir -p /tmp/cullinos-admin-stage && "
        f"tar -xzf /tmp/cullinos-admin.tar.gz -C /tmp/cullinos-admin-stage && "
        f"cp -a {WWW}/admin {WWW}/admin.prev-{ts} && rm -rf {WWW}/admin && "
        f"mv /tmp/cullinos-admin-stage/admin {WWW}/admin && "
        f"rm -rf /tmp/cullinos-admin-stage /tmp/cullinos-admin.tar.gz && echo PUBLISHED",
    )
    if code != 0:
        return code

    safe_print("\n======== TABLE MERGE DEPLOY REPORT ========")
    safe_print(f"Commit tag: {commit}-tablemerge")
    safe_print(f"DB backup:  {dump}")
    safe_print(f"Admin prev: {WWW}/admin.prev-{ts}")
    safe_print(f"Health:     {health.strip()}")
    safe_print("===========================================")
    return 0


def main() -> int:
    password = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if not password:
        print("DEPLOY_PASSWORD required", file=sys.stderr)
        return 1
    check_only = os.environ.get("DEPLOY_CHECK_ONLY") == "1"
    if not check_only and not (ROOT / "apps" / "admin" / "dist" / "index.html").exists():
        print("Build apps/admin first", file=sys.stderr)
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    safe_print(f"Connecting to root@{HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=60, banner_timeout=90)
    transport = ssh.get_transport()
    if transport:
        transport.set_keepalive(30)
    try:
        if check_only:
            check(ssh)
            return 0
        return deploy(ssh)
    finally:
        ssh.close()


if __name__ == "__main__":
    raise SystemExit(main())
