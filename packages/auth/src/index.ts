import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";

/** Hard cap before bcrypt to prevent Long Password DoS. */
export const MAX_PASSWORD_LENGTH = 128;

export type JwtPayload = {
  sub: string;
  organizationId: string;
  email: string;
  isSuperAdmin?: boolean;
  /** Present when a super-admin is acting as a tenant user. */
  impersonation?: boolean;
  impersonatedBy?: string;
  permissions?: string[];
};

function assertPasswordLength(password: string): void {
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  assertPasswordLength(password);
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Reject oversized input before bcrypt to avoid CPU exhaustion.
  if (password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload, secret: string, expiresIn: SignOptions["expiresIn"] = "7d"): string {
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}

export const PERMISSION_MODULES = [
  "auth", "organizations", "brands", "outlets", "users", "roles", "audit",
  "subscriptions", "menu", "tables", "orders", "pos", "kot", "kitchen",
  "payments", "billing", "tax", "inventory", "recipes", "purchasing", "wastage",
  "customers", "loyalty", "coupons", "delivery", "guests", "rooms", "banquets",
  "franchise", "staff", "reports", "analytics", "super-admin", "notifications",
  "integrations", "devices", "sync",
] as const;

export type PermissionModule = typeof PERMISSION_MODULES[number];
