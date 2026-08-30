import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";

export type JwtPayload = {
  sub: string;
  organizationId: string;
  email: string;
  isSuperAdmin?: boolean;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
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
