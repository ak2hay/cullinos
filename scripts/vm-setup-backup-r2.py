#!/usr/bin/env python3
"""Upload prod backup/rollback scripts to VM, wire R2_BACKUP_*, install cron, run first backup + snapshot."""
from __future__ import annotations

import io
import os
import sys
import tarfile
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APP_DIR = "/opt/cullinos"
PROD_SCRIPTS = ROOT / "scripts" / "prod"


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("DEPLOY_PASSWORD="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DEPLOY_PASSWORD required (env or .env)")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 600) -> tuple[int, str, str]:
    print(f"\n$ {cmd[:220]}{'…' if len(cmd) > 220 else ''}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-4000:] if len(out) > 4000 else out)
    if err.strip():
        print("STDERR:", err[-2000:] if len(err) > 2000 else err)
    return code, out, err


def make_scripts_tarball() -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path in sorted(PROD_SCRIPTS.glob("*")):
            if path.is_file():
                tar.add(path, arcname=f"prod/{path.name}")
        compose = ROOT / "docker-compose.prod.yml"
        if compose.exists():
            tar.add(compose, arcname="docker-compose.prod.yml")
    buf.seek(0)
    return buf.read()


MERGE_R2_ENV = r"""
set -euo pipefail
ENV=/opt/cullinos/.env
test -f "$ENV"

docker exec cullinos-postgres psql -U cullinos -d cullinos -At -F $'\t' -c \
  "SELECT key, COALESCE(value,''), COALESCE(value_enc,''), is_secret FROM platform_settings WHERE key LIKE 'R2_%';" \
  > /tmp/r2.platform.tsv 2>/tmp/r2.platform.err || true

set -a
# shellcheck disable=SC1090
source "$ENV"
set +a
export ENCRYPTION_KEY

if command -v node >/dev/null 2>&1; then
  node <<'NODE' > /tmp/r2.from.db.env
const fs = require("fs");
const crypto = require("crypto");
const ALGO = "aes-256-gcm", IV = 12, TAG = 16, SALT = "cullinos-platform-settings-v1";
function key() {
  const raw = (process.env.ENCRYPTION_KEY || "").trim();
  if (!raw) throw new Error("no ENCRYPTION_KEY");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return crypto.scryptSync(raw, SALT, 32);
}
function dec(payload) {
  const keyBuf = key();
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV), tag = buf.subarray(IV, IV + TAG), data = buf.subarray(IV + TAG);
  const d = crypto.createDecipheriv(ALGO, keyBuf, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
const lines = fs.readFileSync("/tmp/r2.platform.tsv", "utf8").split("\n").filter(Boolean);
for (const line of lines) {
  const [k, value, valueEnc, isSecret] = line.split("\t");
  let v = "";
  try {
    if (isSecret === "t" || isSecret === "true") v = valueEnc ? dec(valueEnc) : "";
    else v = value || "";
  } catch (e) {
    process.stderr.write("decrypt_failed:" + k + "\n");
  }
  if (v) process.stdout.write(k + "=" + v + "\n");
}
NODE
else
  touch /tmp/r2.from.db.env
fi

python3 - <<'PY'
from pathlib import Path
env_path = Path("/opt/cullinos/.env")
text = env_path.read_text(encoding="utf-8", errors="replace")
existing = {}
for line in text.splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        existing[k.strip()] = v.strip()

db_vals = {}
frag = Path("/tmp/r2.from.db.env")
if frag.exists():
    for line in frag.read_text(encoding="utf-8", errors="replace").splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            if v.strip():
                db_vals[k.strip()] = v.strip()

updates = {
    "R2_BACKUP_BUCKET": "cullinos-backups",
    "BACKUP_LOCAL_DIR": "/var/backups/cullinos",
    "BACKUP_KEEP_LOCAL_DAYS": "7",
    "BACKUP_KEEP_R2_DAYS": "30",
    "RELEASE_KEEP_COUNT": "5",
}
for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT"):
    if not existing.get(k) and db_vals.get(k):
        updates[k] = db_vals[k]

acct = existing.get("R2_ACCOUNT_ID") or updates.get("R2_ACCOUNT_ID") or db_vals.get("R2_ACCOUNT_ID") or ""
if acct and not existing.get("R2_ENDPOINT") and "R2_ENDPOINT" not in updates:
    updates["R2_ENDPOINT"] = f"https://{acct}.r2.cloudflarestorage.com"

lines = text.splitlines()
seen = set()
out = []
for line in lines:
    if "=" in line and not line.strip().startswith("#"):
        k = line.split("=", 1)[0].strip()
        if k in updates:
            out.append(f"{k}={updates[k]}")
            seen.add(k)
            continue
    out.append(line)
for k, v in updates.items():
    if k not in seen:
        out.append(f"{k}={v}")
env_path.write_text("\n".join(out) + "\n", encoding="utf-8")

final = {}
for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        final[k.strip()] = bool(v.strip())
check = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BACKUP_BUCKET"]
print("env presence:", {k: ("set" if final.get(k) else "MISSING") for k in check})
print("db_keys_found:", sorted(db_vals.keys()))
PY
rm -f /tmp/r2.platform.tsv /tmp/r2.platform.err /tmp/r2.from.db.env
chmod 600 /opt/cullinos/.env
"""


def main() -> int:
    if not PROD_SCRIPTS.is_dir():
        print(f"Missing {PROD_SCRIPTS}", file=sys.stderr)
        return 1

    password = load_password()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}...")
    ssh.connect(HOST, username="root", password=password, timeout=30)

    print("Uploading scripts/prod + docker-compose.prod.yml...")
    blob = make_scripts_tarball()
    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos-prod-backup.tgz", "wb") as f:
        f.write(blob)
    sftp.close()

    code, _, _ = run(
        ssh,
        f"mkdir -p {APP_DIR}/scripts && tar -xzf /tmp/cullinos-prod-backup.tgz -C {APP_DIR}/scripts "
        f"&& mv -f {APP_DIR}/scripts/docker-compose.prod.yml {APP_DIR}/docker-compose.prod.yml "
        f"&& chmod +x {APP_DIR}/scripts/prod/*.sh "
        f"&& rm -f /tmp/cullinos-prod-backup.tgz "
        f"&& ls -la {APP_DIR}/scripts/prod/",
    )
    if code != 0:
        ssh.close()
        return code

    print("Wiring R2 backup env on VM (secrets not printed)...")
    code, out, _ = run(ssh, MERGE_R2_ENV, timeout=180)
    critical_missing = any(
        f"'{k}': 'MISSING'" in out
        for k in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")
    )
    if critical_missing:
        print(
            "R2 credentials incomplete on VM. Save Cloudflare R2 in Super Admin, then re-run.",
            file=sys.stderr,
        )
        ssh.close()
        return 1

    print("Installing cron...")
    code, _, _ = run(ssh, f"bash {APP_DIR}/scripts/prod/install-cron.sh", timeout=60)
    if code != 0:
        ssh.close()
        return code

    print("Running first full backup (may take several minutes — includes docker save)...")
    code, _, _ = run(ssh, f"bash {APP_DIR}/scripts/prod/backup.sh", timeout=3600)
    if code != 0:
        print("Backup failed.", file=sys.stderr)
        ssh.close()
        return code

    print("Taking release snapshot for rollback...")
    code, _, _ = run(ssh, f"bash {APP_DIR}/scripts/prod/snapshot-release.sh", timeout=600)
    if code != 0:
        print("Snapshot failed (backup OK).", file=sys.stderr)
        ssh.close()
        return code

    run(ssh, f"bash {APP_DIR}/scripts/prod/rollback.sh --list", timeout=30)
    run(ssh, "ls -lah /var/backups/cullinos/daily/ | tail -20", timeout=30)

    print("\n=== Backup + rollback integration complete ===")
    print("Daily cron: 02:00 → scripts/prod/backup.sh")
    print("Rollback:   bash /opt/cullinos/scripts/prod/rollback.sh")
    ssh.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
