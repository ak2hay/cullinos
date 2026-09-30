import type { JwtService } from "@nestjs/jwt";
import { getJwtSecret } from "./jwt-secret.util";

/**
 * Guest, customer, refresh, OTP-challenge, step-up and preview tokens share the
 * signing secret but must never authorize staff routes: only staff access tokens
 * carry `organizationId` and no `type` claim.
 */
export function isStaffAccessPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (p.type !== undefined || p.preview !== undefined) return false;
  if (typeof p.sub !== "string" || !p.sub) return false;
  if (typeof p.organizationId !== "string" || !p.organizationId) return false;
  return true;
}

/** Audience of super-admin access tokens, which are signed with their own key. */
export const PLATFORM_AUDIENCE = "cullinos-platform";

const DEV_SUPER_ADMIN_FALLBACK = "dev-super-admin-secret";

export function getSuperAdminJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = (env.SUPER_ADMIN_JWT_SECRET ?? "").trim();
  if (secret) return secret;
  if (env.NODE_ENV === "production") {
    throw new Error("SUPER_ADMIN_JWT_SECRET must be set in production");
  }
  return DEV_SUPER_ADMIN_FALLBACK;
}

/** Access-token lifetime in seconds (JWT_ACCESS_TTL_SECONDS, default 15 minutes). */
export function accessTokenTtlSeconds(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.JWT_ACCESS_TTL_SECONDS);
  return Number.isFinite(raw) && raw >= 60 ? Math.floor(raw) : 15 * 60;
}

export type StaffAccessPayload = {
  sub: string;
  organizationId: string;
  email?: string;
  isSuperAdmin?: boolean;
  permissions?: string[];
  /** Platform staff role and its permissions; only on super-admin tokens. */
  platformRole?: string;
  platformPermissions?: string[];
  portal?: string;
  impersonation?: boolean;
  impersonatedBy?: string;
  /** users.token_version at issue time; tokens without it predate revocation support. */
  tv?: number;
};

/**
 * Verifies a staff access token. Tenant tokens use JWT_SECRET and may never claim
 * isSuperAdmin; super-admin tokens use SUPER_ADMIN_JWT_SECRET + PLATFORM_AUDIENCE.
 * Returns null for anything else (guest, customer, refresh, challenge, preview...).
 */
export function verifyStaffAccessToken(
  jwt: JwtService,
  token: string,
): StaffAccessPayload | null {
  let payload: Record<string, unknown>;
  try {
    payload = jwt.verify(token, { secret: getJwtSecret() });
    if (payload.isSuperAdmin === true) return null;
  } catch {
    try {
      payload = jwt.verify(token, {
        secret: getSuperAdminJwtSecret(),
        audience: PLATFORM_AUDIENCE,
      });
    } catch {
      return null;
    }
    if (payload.isSuperAdmin !== true) return null;
  }
  return isStaffAccessPayload(payload) ? (payload as StaffAccessPayload) : null;
}
