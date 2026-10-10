#!/usr/bin/env python3
"""Point prod transactional SMTP (email OTP) at MSG91 cullinos.com, recreate API, verify.

Writes platform_settings rows (DB overrides env) from inside cullinos-api so SMTP_PASS is
encrypted with the container's ENCRYPTION_KEY. Secrets travel over stdin only; never printed.

Env:
  DEPLOY_HOST, DEPLOY_PASSWORD (or secrets-export.txt)
  DEPLOY_SMTP_USER, DEPLOY_SMTP_PASS   MSG91 SMTP credentials for cullinos.com (required)
  DEPLOY_SMTP_TEST_TO                  optional inbox for a real test email
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parents[1]
HOST = os.environ.get("DEPLOY_HOST") or sys.exit("Set DEPLOY_HOST explicitly (no default target).")
APP_DIR = "/opt/cullinos"

SETTINGS = {
    "SMTP_HOST": "smtp.mailer91.com",
    "SMTP_PORT": "587",
    "SMTP_FROM_EMAIL": "support@cullinos.com",
    "SMTP_FROM_NAME": "Cullinos",
}

UPSERT_JS = r"""
const { createRequire } = require("module");
const crypto = require("crypto");
const req = createRequire("/app/apps/api/package.json");

function key() {
  const raw = (process.env.ENCRYPTION_KEY || "").trim();
  if (!raw) throw new Error("ENCRYPTION_KEY missing in container");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return crypto.scryptSync(raw, "cullinos-platform-settings-v1", 32);
}
function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", async () => {
  const { PrismaClient } = req("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const p = JSON.parse(input);
    key();
    const rows = Object.entries(p.plain).map(([k, v]) => ({ key: k, value: v, valueEnc: null, isSecret: false }));
    for (const [k, v] of Object.entries(p.secret)) {
      rows.push({ key: k, value: null, valueEnc: encryptSecret(v), isSecret: true });
    }
    for (const r of rows) {
      const data = { value: r.value, valueEnc: r.valueEnc, isSecret: r.isSecret, updatedBy: "vm-set-smtp-cullinos" };
      await prisma.platformSetting.upsert({ where: { key: r.key }, update: data, create: { key: r.key, ...data } });
      console.log("upserted " + r.key + (r.isSecret ? " (encrypted)" : "=" + r.value));
    }
  } catch (e) {
    console.log("UPSERT FAILED: " + (e && e.message));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
});
"""

VERIFY_JS = r"""
const { createRequire } = require("module");
const crypto = require("crypto");
const req = createRequire("/app/apps/api/package.json");

function key() {
  const raw = (process.env.ENCRYPTION_KEY || "").trim();
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return crypto.scryptSync(raw, "cullinos-platform-settings-v1", 32);
}
function decryptSecret(payload) {
  const b = Buffer.from(payload, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

let input = "";
process.stdin.on("data", (d) => (input += d));
process.stdin.on("end", async () => {
  const { PrismaClient } = req("@prisma/client");
  const nodemailer = req("nodemailer");
  const prisma = new PrismaClient();
  try {
    const testTo = (JSON.parse(input || "{}").testTo || "").trim();
    const rows = await prisma.platformSetting.findMany({ where: { key: { startsWith: "SMTP_" } } });
    const cfg = {};
    for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL", "SMTP_FROM_NAME"]) {
      const row = rows.find((r) => r.key === k);
      let v;
      if (row) v = row.isSecret ? (row.valueEnc ? decryptSecret(row.valueEnc) : undefined) : row.value;
      if (!v) v = (process.env[k] || "").trim() || undefined;
      cfg[k] = v;
      console.log(k + "=" + (k === "SMTP_PASS" || k === "SMTP_USER" ? (v ? "set" : "MISSING") : v || "MISSING") + (row ? " (db)" : " (env)"));
    }
    if (!cfg.SMTP_HOST || !cfg.SMTP_USER || !cfg.SMTP_PASS) {
      console.log("verify: skipped (effective SMTP incomplete)");
      return;
    }
    const port = Number(cfg.SMTP_PORT || 587);
    const t = nodemailer.createTransport({
      host: cfg.SMTP_HOST, port, secure: port === 465,
      auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS }, connectionTimeout: 15000,
    });
    await t.verify();
    console.log("verify: OK " + cfg.SMTP_HOST + ":" + port);
    if (testTo) {
      await t.sendMail({
        from: (cfg.SMTP_FROM_NAME || "Cullinos") + " <" + (cfg.SMTP_FROM_EMAIL || "noreply@cullinos.com") + ">",
        to: testTo,
        subject: "Cullinos SMTP test",
        text: "SMTP for cullinos.com is working.",
      });
      console.log("test email: SENT");
    }
  } catch (e) {
    console.log("verify: FAILED " + ((e && e.code) || "") + " " + (e && e.message));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
});
"""


def password() -> str:
    pw = os.environ.get("DEPLOY_PASSWORD", "").strip()
    if pw:
        return pw
    secrets = ROOT / "secrets-export.txt"
    if secrets.exists():
        lines = secrets.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines):
            if line.strip() == "DEPLOY_PASSWORD" and i + 1 < len(lines):
                return lines[i + 1].strip()
    raise SystemExit("DEPLOY_PASSWORD required")


def run(ssh: paramiko.SSHClient, cmd: str, stdin_data: str | None = None, timeout: int = 120) -> tuple[int, str]:
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    if stdin_data is not None:
        stdin.write(stdin_data)
        stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    if code != 0 and err.strip():
        print("STDERR", err[-800:])
    return code, out


def run_js(ssh: paramiko.SSHClient, name: str, js: str, payload: dict) -> int:
    host_path = f"/tmp/{name}.js"
    sftp = ssh.open_sftp()
    with sftp.file(host_path, "w") as f:
        f.write(js)
    sftp.chmod(host_path, 0o644)
    sftp.close()
    try:
        code, _ = run(ssh, f"docker cp {host_path} cullinos-api:/tmp/{name}.js")
        if code != 0:
            return code
        code, _ = run(
            ssh,
            f"docker exec -i -w /app cullinos-api node /tmp/{name}.js",
            stdin_data=json.dumps(payload),
        )
        return code
    finally:
        run(ssh, f"rm -f {host_path}; docker exec -u 0 cullinos-api rm -f /tmp/{name}.js || true")


def main() -> int:
    smtp_user = os.environ.get("DEPLOY_SMTP_USER", "").strip()
    smtp_pass = os.environ.get("DEPLOY_SMTP_PASS", "").strip()
    if not smtp_user or not smtp_pass:
        print("DEPLOY_SMTP_USER and DEPLOY_SMTP_PASS are required", file=sys.stderr)
        return 1
    test_to = os.environ.get("DEPLOY_SMTP_TEST_TO", "").strip()

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username="root", password=password(), timeout=30)

    print("== Preflight ==")
    code, out = run(
        ssh,
        "docker exec -w /app cullinos-api sh -c '"
        "test -n \"$ENCRYPTION_KEY\" && echo ENCRYPTION_KEY=set || echo ENCRYPTION_KEY=MISSING; "
        "node -e \"const r=require(\\\"module\\\").createRequire(\\\"/app/apps/api/package.json\\\");"
        "r(\\\"@prisma/client\\\");r(\\\"nodemailer\\\");console.log(\\\"deps=ok\\\")\"'",
    )
    if code != 0 or "ENCRYPTION_KEY=set" not in out or "deps=ok" not in out:
        print("Preflight failed; nothing changed.", file=sys.stderr)
        ssh.close()
        return 1

    print("\n== Upsert platform_settings ==")
    payload = {
        "plain": {**SETTINGS, "SMTP_USER": smtp_user},
        "secret": {"SMTP_PASS": smtp_pass},
    }
    if run_js(ssh, "smtp-upsert", UPSERT_JS, payload) != 0:
        ssh.close()
        return 1

    print("\n== Recreate API ==")
    code, _ = run(
        ssh,
        f"cd {APP_DIR} && docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps api",
        timeout=180,
    )
    if code != 0:
        ssh.close()
        return code
    for _ in range(36):
        _, health = run(ssh, "curl -sf http://127.0.0.1:3000/api/v1/health || true", timeout=30)
        if "ok" in health:
            print("API health OK")
            break
        time.sleep(5)
    else:
        print("API did not become healthy", file=sys.stderr)
        ssh.close()
        return 1

    print("\n== Verify effective SMTP ==")
    code = run_js(ssh, "smtp-verify", VERIFY_JS, {"testTo": test_to})
    ssh.close()
    return code


if __name__ == "__main__":
    raise SystemExit(main())
