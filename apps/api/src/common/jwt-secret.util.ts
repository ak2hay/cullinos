/** Central JWT secret resolution — fail closed in production. */

const DEV_FALLBACK = "dev-secret";

/**
 * Returns JWT signing/verify secret.
 * Production: requires JWT_SECRET (assertProductionSecurityConfig also validates strength).
 * Non-production: falls back to a local-only placeholder when unset.
 */
export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = (env.JWT_SECRET ?? "").trim();
  if (secret) return secret;
  if (env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return DEV_FALLBACK;
}
