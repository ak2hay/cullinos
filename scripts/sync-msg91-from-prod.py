"""Print which MSG91 keys exist on prod (secrets masked). Optionally upsert non-debug keys into local .env."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path("A:/cullinos")
ENV_PATH = ROOT / ".env"


def load_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^([A-Z0-9_]+)=(.*)$", line)
        if m:
            out[m.group(1)] = m.group(2)
    return out


def upsert_env(values: dict[str, str]) -> None:
    text = ENV_PATH.read_text(encoding="utf-8")
    if not text.endswith("\n"):
        text += "\n"
    for k, v in values.items():
        if not v:
            continue
        line = f"{k}={v}"
        pattern = re.compile(rf"^{re.escape(k)}=.*$", re.M)
        if pattern.search(text):
            text = pattern.sub(line, text)
        else:
            text += line + "\n"
    ENV_PATH.write_text(text, encoding="utf-8")


def main() -> None:
    env = load_env()
    pw = env.get("DEPLOY_PASSWORD")
    if not pw:
        raise SystemExit("DEPLOY_PASSWORD missing")

    try:
        import paramiko
    except ImportError:
        import subprocess

        subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "-q"])
        import paramiko

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("95.135.254.46", username="root", password=pw, timeout=25)

    remote = r"""
set -e
docker exec cullinos-api node -e '
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const keyHex = process.env.ENCRYPTION_KEY;
if (!keyHex) { console.error("no ENCRYPTION_KEY"); process.exit(2); }
const key = /^[0-9a-fA-F]{64}$/.test(keyHex)
  ? Buffer.from(keyHex, "hex")
  : crypto.scryptSync(keyHex, "cullinos-platform-settings-v1", 32);
function decryptSecret(payload) {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.platformSetting.findMany({
      where: { key: { startsWith: "MSG91_" } },
      orderBy: { key: "asc" },
    });
    const out = {};
    for (const r of rows) {
      if (r.value) out[r.key] = r.value;
      else if (r.valueEnc) out[r.key] = decryptSecret(r.valueEnc);
    }
    process.stdout.write("JSON_START" + JSON.stringify(out) + "JSON_END");
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => { console.error(String(e)); process.exit(1); });
'
"""
    _, stdout, stderr = client.exec_command(remote, timeout=120)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    client.close()
    if "JSON_START" not in out:
        print(out[:1500])
        print(err[:1500])
        raise SystemExit("failed")

    values = json.loads(out.split("JSON_START", 1)[1].split("JSON_END", 1)[0])
    upsert_env({k: str(v) for k, v in values.items() if v is not None and str(v) != ""})
    print("UPDATED")
    for k in sorted(values):
        v = str(values[k])
        if any(x in k for x in ("KEY", "TOKEN", "SECRET")):
            print(f"{k}=set len={len(v)}")
        else:
            print(f"{k}={v}")


if __name__ == "__main__":
    main()
