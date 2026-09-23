export function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Digits-only phone-like values (10–15 digits, optional leading +). */
export function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function phoneFromUnknown(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const s = String(value);
    return looksLikePhone(s) ? s : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (looksLikePhone(trimmed)) return trimmed.replace(/\D/g, "");
  // Nested JSON string payloads from MSG91
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return extractPhoneFromVerifyPayload(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  // JWT access-token nested in a field
  if (trimmed.split(".").length === 3) {
    return extractPhoneFromJwt(trimmed);
  }
  return null;
}

function phoneFromRecord(record: Record<string, unknown> | null): string | null {
  if (!record) return null;
  const direct = firstString(
    record.mobile,
    record.phone,
    record.identifier,
    record.phone_number,
    record.phoneNumber,
    record.mobile_no,
    record.mobileNo,
    record.number,
    record.Number,
    record.userMobile,
    record.user_mobile,
  );
  if (direct) {
    const fromDirect = phoneFromUnknown(direct);
    if (fromDirect) return fromDirect;
  }

  for (const value of Object.values(record)) {
    const nested = phoneFromUnknown(value);
    if (nested) return nested;
    const child = asRecord(value);
    if (child) {
      const fromChild = phoneFromRecord(child);
      if (fromChild) return fromChild;
    }
  }
  return null;
}

export function extractPhoneFromVerifyPayload(raw: unknown): string | null {
  if (typeof raw === "string") {
    return phoneFromUnknown(raw);
  }
  const root = asRecord(raw);
  if (!root) return null;

  // Common MSG91 shapes: data/message as phone string, JWT, or nested object
  const fromData = phoneFromUnknown(root.data);
  if (fromData) return fromData;
  const fromMessage = phoneFromUnknown(root.message);
  if (fromMessage) return fromMessage;

  return phoneFromRecord(root);
}

export function extractPhoneFromJwt(token: string): string | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  for (const encoding of ["base64url", "base64"] as const) {
    try {
      const json = Buffer.from(parts[1], encoding).toString("utf8");
      const payload = JSON.parse(json) as Record<string, unknown>;
      const phone = phoneFromRecord(payload);
      if (phone) return phone;
      // Avoid treating opaque UUID `sub` as a phone unless it looks like one
      const sub = firstString(payload.sub);
      if (sub && looksLikePhone(sub)) return sub.replace(/\D/g, "");
    } catch {
      // try next encoding
    }
  }
  return null;
}

export function extractMsg91AccessTokenFromClientPayload(
  data: string | {
    message?: string;
    accessToken?: string;
    token?: string;
    identifier?: string;
  },
): string | null {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object") {
    return firstString(data.message, data.accessToken, data.token);
  }
  return null;
}

export function extractIdentifierFromClientPayload(
  data: string | {
    message?: string;
    accessToken?: string;
    token?: string;
    identifier?: string;
    mobile?: string;
    phone?: string;
  },
): string | null {
  if (typeof data !== "object" || !data) return null;
  return phoneFromUnknown(
    firstString(data.identifier, data.mobile, data.phone),
  );
}
