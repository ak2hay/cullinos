const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = "A:/cullinos";
const ENV_PATH = path.join(ROOT, ".env");

function loadEnvFile() {
  const out = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function decryptSecret(payload, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

function upsertEnv(keys) {
  let text = fs.readFileSync(ENV_PATH, "utf8");
  const blockKeys = Object.keys(keys);
  for (const k of blockKeys) {
    const v = keys[k];
    if (v == null || v === "") continue;
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(text)) {
      text = text.replace(re, line);
    } else {
      if (!text.endsWith("\n")) text += "\n";
      text += line + "\n";
    }
  }
  // Ensure MSG91 section comment exists once
  if (!text.includes("MSG91_AUTH_KEY=")) {
    text +=
      "\n# MSG91 (synced from super-admin platform settings)\n" +
      blockKeys.map((k) => `${k}=${keys[k] || ""}`).join("\n") +
      "\n";
  }
  fs.writeFileSync(ENV_PATH, text);
}

(async () => {
  const env = loadEnvFile();
  process.env.DATABASE_URL = env.DATABASE_URL;
  process.env.ENCRYPTION_KEY = env.ENCRYPTION_KEY;
  if (!env.ENCRYPTION_KEY || !/^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_KEY)) {
    throw new Error("ENCRYPTION_KEY missing or invalid in .env");
  }

  const prisma = new PrismaClient();
  const wanted = [
    "MSG91_AUTH_KEY",
    "MSG91_WIDGET_ID",
    "MSG91_WIDGET_TOKEN",
    "MSG91_TEMPLATE_ID",
    "MSG91_MARKETING_TEMPLATE_ID",
    "MSG91_SENDER_ID",
    "MSG91_OTP_TTL_SECONDS",
  ];
  const rows = await prisma.platformSetting.findMany({
    where: { key: { in: wanted } },
  });

  const values = {};
  for (const row of rows) {
    if (row.isSecret && row.valueEnc) {
      values[row.key] = decryptSecret(row.valueEnc, env.ENCRYPTION_KEY);
    } else if (row.value != null && String(row.value).trim() !== "") {
      values[row.key] = String(row.value).trim();
    }
  }

  const present = wanted.filter((k) => values[k]);
  const missing = wanted.filter((k) => !values[k]);
  console.log("synced=" + present.join(","));
  console.log("missing=" + (missing.join(",") || "none"));
  for (const k of present) {
    if (k.includes("KEY") || k.includes("TOKEN")) {
      console.log(`${k}=****${String(values[k]).slice(-4)} (len ${values[k].length})`);
    } else {
      console.log(`${k}=${values[k]}`);
    }
  }

  if (present.length === 0) {
    throw new Error("No MSG91 keys found in platform_settings");
  }

  upsertEnv(values);
  console.log("updated=.env");
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e.message || e);
  process.exit(1);
});
