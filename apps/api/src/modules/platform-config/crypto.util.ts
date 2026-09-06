import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "crypto";
import { ServiceUnavailableException } from "@nestjs/common";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const SCRYPT_SALT = "cullinos-platform-settings-v1";

function resolveKeyMaterial(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new ServiceUnavailableException(
      "ENCRYPTION_KEY is required to store platform secrets",
    );
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return scryptSync(raw, SCRYPT_SALT, KEY_LEN);
}

export function encryptionKeyConfigured(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY?.trim());
}

/** Encrypt plaintext → base64(iv | tag | ciphertext). */
export function encryptSecret(plaintext: string): string {
  const key = resolveKeyMaterial();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/** Decrypt base64(iv | tag | ciphertext) → plaintext. */
export function decryptSecret(payload: string): string {
  const key = resolveKeyMaterial();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Invalid ciphertext");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export function maskSecret(value: string): string {
  if (value.length < 8) return "••••";
  return `••••${value.slice(-4)}`;
}

/** Stable fingerprint for change detection without exposing the value. */
export function secretFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
