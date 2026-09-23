import {
  createHash,
  randomBytes,
} from "crypto";
import {
  decryptSecret,
  encryptSecret,
  encryptionKeyConfigured,
} from "../platform-config/crypto.util";
import { DOCUMENT_ENC_PREFIX } from "./privacy.constants";

export function newUnsubscribeToken(): string {
  return randomBytes(24).toString("hex");
}

export function newHandoffCode(): string {
  return randomBytes(32).toString("hex");
}

export function hashHandoffCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** Encrypt guest ID document when ENCRYPTION_KEY is configured.
 * In production, refuse plaintext storage when the key is missing.
 */
export function encryptDocumentNumber(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(DOCUMENT_ENC_PREFIX)) return trimmed;
  if (!encryptionKeyConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY is required in production to store sensitive document numbers",
      );
    }
    return trimmed;
  }
  return `${DOCUMENT_ENC_PREFIX}${encryptSecret(trimmed)}`;
}

export function decryptDocumentNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(DOCUMENT_ENC_PREFIX)) return value;
  if (!encryptionKeyConfigured()) return "[encrypted]";
  try {
    return decryptSecret(value.slice(DOCUMENT_ENC_PREFIX.length));
  } catch {
    return "[encrypted]";
  }
}

export function maskDocumentNumber(value: string | null | undefined): string | null {
  const plain = decryptDocumentNumber(value);
  if (!plain || plain === "[encrypted]") return plain;
  if (plain.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, plain.length - 4))}${plain.slice(-4)}`;
}
