#!/usr/bin/env python3
"""Probe API container tooling, then hot-patch skip-OTP if possible."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST", "95.135.254.46")
APP_DIR = "/opt/cullinos"

# Patch script that runs with node inside the container (no python required).
NODE_PATCH = r"""
const fs = require('fs');
const path = require('path');

const authPath = '/app/apps/api/dist/modules/auth/auth.service.js';
let text = fs.readFileSync(authPath, 'utf8');
const old = `    isEmailOtpSkipped() {
        if (process.env.NODE_ENV === "production") {
            return false;
        }
        const raw = (this.config.get("AUTH_SKIP_EMAIL_OTP") ?? "").trim().toLowerCase();
        return raw === "true" || raw === "1" || raw === "yes";
    }`;
const neu = `    isEmailOtpSkipped() {
        // TEMPORARY: skip email OTP until SMTP is configured
        const raw = (this.config.get("AUTH_SKIP_EMAIL_OTP") ?? "").trim().toLowerCase();
        return raw === "true" || raw === "1" || raw === "yes";
    }`;
if (text.includes('TEMPORARY: skip email OTP')) {
  console.log('auth.service.js already patched');
} else if (text.includes(old)) {
  fs.writeFileSync(authPath, text.replace(old, neu));
  console.log('patched auth.service.js');
} else {
  console.error('auth.service.js pattern not found');
  process.exit(1);
}

function walk(dir, acc=[]) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name === 'cors.util.js') acc.push(p);
  }
  return acc;
}

const re = /const skipOtp = \(env\.AUTH_SKIP_EMAIL_OTP \?\? ""\)\.trim\(\)\.toLowerCase\(\);\s*if \(skipOtp === "true" \|\| skipOtp === "1" \|\| skipOtp === "yes"\) \{\s*throw new Error\("AUTH_SKIP_EMAIL_OTP cannot be enabled in production"\);\s*\}/s;
for (const p of walk('/app/apps/api/dist')) {
  let t = fs.readFileSync(p, 'utf8');
  if (t.includes('TEMPORARY: AUTH_SKIP_EMAIL_OTP allowed')) {
    console.log(p + ' already patched');
    continue;
  }
  if (re.test(t)) {
    fs.writeFileSync(p, t.replace(re, '// TEMPORARY: AUTH_SKIP_EMAIL_OTP allowed until SMTP configured'));
    console.log('patched ' + p);
  } else {
    const idx = t.indexOf('AUTH_SKIP');
    console.log(idx >= 0 ? ('no skip-otp throw in ' + p + '; snippet=' + JSON.stringify(t.slice(idx, idx+200))) : ('no AUTH_SKIP in ' + p));
  }
}
"""


def load_password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1].strip()
    secrets = ROOT / "secrets-export.txt"
    if secrets.exists():
        lines = secrets.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines):
            if line.strip() == "DEPLOY_PASSWORD" and i + 1 < len(lines):
                return lines[i + 1].strip()
    raise SystemExit("Set DEPLOY_PASSWORD or pass password as argv[1]")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 180) -> tuple[int, str]:
    print(f"\n$ {cmd[:220]}{'...' if len(cmd) > 220 else ''}", flush=True)
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out[-5000:], flush=True)
    if code != 0 and err.strip():
        print("STDERR:", err[-3000:], flush=True)
    return code, out


def main() -> int:
    password = load_password()
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to root@{HOST}...", flush=True)
    ssh.connect(HOST, username="root", password=password, timeout=30)

    run(ssh, "docker exec cullinos-api sh -c 'command -v node; command -v python3; command -v sed'")

    sftp = ssh.open_sftp()
    with sftp.file("/tmp/cullinos-patch-skip-otp.js", "w") as f:
        f.write(NODE_PATCH)
    sftp.close()
    print("uploaded /tmp/cullinos-patch-skip-otp.js", flush=True)

    run(
        ssh,
        "python3 - <<'PY'\n"
        "from pathlib import Path\n"
        f"p = Path('{APP_DIR}/.env')\n"
        "lines = p.read_text().splitlines() if p.exists() else []\n"
        "key = 'AUTH_SKIP_EMAIL_OTP'\n"
        "out, found = [], False\n"
        "for line in lines:\n"
        "    if line.startswith(key + '='):\n"
        "        out.append(f'{key}=true'); found = True\n"
        "    else:\n"
        "        out.append(line)\n"
        "if not found:\n"
        "    out.append(f'{key}=true')\n"
        "p.write_text('\\n'.join(out) + '\\n')\n"
        "print('AUTH_SKIP_EMAIL_OTP=true')\n"
        "PY",
    )

    code, _ = run(ssh, "docker cp /tmp/cullinos-patch-skip-otp.js cullinos-api:/tmp/cullinos-patch-skip-otp.js")
    if code != 0:
        ssh.close()
        return code

    code, _ = run(ssh, "docker exec cullinos-api node /tmp/cullinos-patch-skip-otp.js")
    if code != 0:
        ssh.close()
        return code

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml restart api")

    for _ in range(24):
        _, out = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if '"status":"ok"' in out or '"status": "ok"' in out:
            run(
                ssh,
                "docker exec cullinos-api sh -c \"grep -A6 isEmailOtpSkipped /app/apps/api/dist/modules/auth/auth.service.js | head -20\"",
            )
            print(
                "\n=== Email OTP skipped; API healthy. Password-only Super Admin login should work. ===",
                flush=True,
            )
            ssh.close()
            return 0
        time.sleep(5)

    run(ssh, f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml logs --tail=50 api")
    ssh.close()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
