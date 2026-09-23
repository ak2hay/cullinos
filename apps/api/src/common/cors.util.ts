/** Shared CORS allowlist parsing for HTTP and Socket.IO. */

const PLACEHOLDER_SECRET_PREFIXES = ["change-me", "dev-secret"] as const;

export function parseCorsOrigins(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isPlaceholderSecret(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return PLACEHOLDER_SECRET_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function assertProductionSecurityConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== "production") return;

  const origins = parseCorsOrigins(env.CORS_ORIGINS);
  if (origins.length === 0) {
    throw new Error("CORS_ORIGINS must be set to an explicit allowlist in production");
  }
  for (const origin of origins) {
    if (origin === "*" || origin.toLowerCase() === "true") {
      throw new Error(`CORS_ORIGINS must not contain wildcard values (got "${origin}")`);
    }
  }

  const skipOtp = (env.AUTH_SKIP_EMAIL_OTP ?? "").trim().toLowerCase();
  if (skipOtp === "true" || skipOtp === "1" || skipOtp === "yes") {
    throw new Error(
      "AUTH_SKIP_EMAIL_OTP must not be enabled in production (email MFA is required)",
    );
  }

  const jwtSecret = (env.JWT_SECRET ?? "").trim();
  if (!jwtSecret || jwtSecret.length < 32 || isPlaceholderSecret(jwtSecret)) {
    throw new Error(
      "JWT_SECRET must be set to a strong non-placeholder value (min 32 chars) in production",
    );
  }

  const internalKey = (env.INTERNAL_API_KEY ?? "").trim();
  if (!internalKey || isPlaceholderSecret(internalKey)) {
    throw new Error(
      "INTERNAL_API_KEY must be set to a non-placeholder value in production",
    );
  }

  const encKey = (env.ENCRYPTION_KEY ?? "").trim();
  if (!encKey || isPlaceholderSecret(encKey)) {
    throw new Error(
      "ENCRYPTION_KEY must be set to a non-placeholder value in production",
    );
  }
}

export function createCorsOriginDelegate(allowedOrigins: ReadonlySet<string>) {
  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    // Non-browser / same-origin clients omit Origin.
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"), false);
  };
}

export function socketIoCorsConfig(allowedOrigins: ReadonlySet<string>) {
  return {
    origin: [...allowedOrigins],
    credentials: true,
  };
}
