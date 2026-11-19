import { redactPhone } from "../../common/pii-redact.util";

/** Fields written for a failed MSG91 HTTP call. Secrets never belong here. */
export type Msg91FailureLog = {
  endpoint: string;
  httpStatus: number;
  code: string | null;
  message: string | null;
  phone: string;
};

export type ClassifiedMsg91Call = {
  httpFailed: boolean;
  /** True when the JSON body has `type === "error"` (case-insensitive), even on HTTP 2xx. */
  applicationError: boolean;
  log: { level: "warn" | "error"; entry: Msg91FailureLog } | null;
};

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]+){1,2}/g;
const LONG_OPAQUE_PATTERN = /\b[A-Za-z0-9+/_=-]{40,}\b/g;
const PHONE_DIGITS_PATTERN = /\b\d{10,15}\b/g;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function scalarText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function scalarCode(value: unknown): string | null {
  const text = scalarText(value);
  if (!text || !/^\d{3,4}$/.test(text)) return null;
  return text;
}

export function parseMsg91Body(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

/**
 * Read MSG91's application error without copying the rest of the payload.
 * HTTP 200 + `{ "type": "error" }` is a failure (418 IP-locked, 701 invalid token, …).
 */
export function assessMsg91Body(body: unknown): {
  applicationError: boolean;
  code: string | null;
  message: string | null;
} {
  const row = asRecord(body);
  if (!row) return { applicationError: false, code: null, message: null };

  const type = typeof row.type === "string" ? row.type.trim().toLowerCase() : "";
  const nested = asRecord(row.error) ?? asRecord(row.message);
  const code =
    scalarCode(row.code) ??
    scalarCode(row.errorCode) ??
    scalarCode(row.error_code) ??
    scalarCode(row.status) ??
    (nested ? scalarCode(nested.code) : null);
  const message =
    scalarText(row.message) ??
    scalarText(row.error) ??
    (nested ? scalarText(nested.message) : null);

  return {
    applicationError: type === "error",
    code: code ?? (message && /^\d{3,4}$/.test(message) ? message : null),
    message,
  };
}

/** Strip credentials and full phone numbers before a value is written to a log. */
export function redactMsg91Secrets(
  value: string | null,
  secrets: Array<string | null | undefined> = [],
): string | null {
  if (!value) return null;
  // Mask full numbers before secret substitution so a 6-digit OTP that happens to
  // sit inside a phone cannot split the number apart.
  let out = value.replace(PHONE_DIGITS_PATTERN, (digits) => redactPhone(digits));
  const needles = secrets
    .filter((secret): secret is string => typeof secret === "string" && secret.trim().length >= 6)
    .map((secret) => secret.trim())
    .sort((a, b) => b.length - a.length);
  for (const secret of needles) {
    if (out.includes(secret)) out = out.split(secret).join("[redacted]");
  }
  out = out.replace(JWT_PATTERN, "[redacted]").replace(LONG_OPAQUE_PATTERN, "[redacted]");
  const trimmed = out.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 300);
}

/**
 * Decide whether this MSG91 response must be logged and treated as a failure.
 * Non-2xx is `error`. HTTP 2xx with `type: "error"` is `warn`.
 */
export function classifyMsg91Call(input: {
  endpoint: string;
  httpStatus: number;
  body: unknown;
  phone?: string | null;
  secrets?: Array<string | null | undefined>;
}): ClassifiedMsg91Call {
  const httpFailed = input.httpStatus < 200 || input.httpStatus >= 300;
  const assessed = assessMsg91Body(input.body);
  if (!httpFailed && !assessed.applicationError) {
    return { httpFailed, applicationError: false, log: null };
  }
  return {
    httpFailed,
    applicationError: assessed.applicationError,
    log: {
      level: httpFailed ? "error" : "warn",
      entry: {
        endpoint: input.endpoint,
        httpStatus: input.httpStatus,
        code: redactMsg91Secrets(assessed.code, input.secrets),
        message: redactMsg91Secrets(assessed.message, input.secrets),
        phone: redactPhone(input.phone),
      },
    },
  };
}
