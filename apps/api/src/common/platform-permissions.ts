/**
 * Rkyves internal staff permissions for the super admin panel. These are separate
 * from tenant role permissions (`permissions` claim / RequirePermissions) and only
 * ever appear on platform tokens.
 */
export const PLATFORM_PERMISSIONS = [
  "dashboard.read",
  "health.read",
  "audit.read",
  "tenants.read",
  "tenants.write",
  "tenants.suspend",
  "tenants.delete",
  "tenants.impersonate",
  "tenant_users.manage",
  "plans.read",
  "plans.manage",
  "subscriptions.manage",
  "wallet.manage",
  "labs.sql",
  "settings.manage",
  "marketing.manage",
  "marketing.inquiries",
  "guest_ops.manage",
  "promo.send",
  "team.manage",
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export const PLATFORM_ROLES = [
  "owner",
  "support",
  "sales",
  "marketing",
  "finance",
  "viewer",
] as const;

export type PlatformRoleName = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_ROLE_LABELS: Record<PlatformRoleName, string> = {
  owner: "Owner",
  support: "Support",
  sales: "Sales",
  marketing: "Marketing",
  finance: "Finance",
  viewer: "Viewer",
};

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRoleName, readonly PlatformPermission[]> = {
  owner: PLATFORM_PERMISSIONS,
  support: [
    "dashboard.read",
    "health.read",
    "audit.read",
    "tenants.read",
    "tenants.suspend",
    "tenants.impersonate",
    "tenant_users.manage",
    "plans.read",
    "guest_ops.manage",
  ],
  sales: [
    "dashboard.read",
    "tenants.read",
    "tenants.write",
    "plans.read",
    "subscriptions.manage",
    "marketing.inquiries",
  ],
  marketing: [
    "dashboard.read",
    "marketing.manage",
    "marketing.inquiries",
    "promo.send",
    "guest_ops.manage",
  ],
  finance: [
    "dashboard.read",
    "audit.read",
    "tenants.read",
    "plans.read",
    "plans.manage",
    "subscriptions.manage",
    "wallet.manage",
  ],
  viewer: ["dashboard.read", "health.read", "audit.read", "tenants.read", "plans.read"],
};

export function isPlatformRole(value: unknown): value is PlatformRoleName {
  return typeof value === "string" && (PLATFORM_ROLES as readonly string[]).includes(value);
}

/** Unknown or missing roles get the least-privileged set. */
export function normalizePlatformRole(value: unknown): PlatformRoleName {
  return isPlatformRole(value) ? value : "viewer";
}

export function permissionsForPlatformRole(role: unknown): PlatformPermission[] {
  return [...PLATFORM_ROLE_PERMISSIONS[normalizePlatformRole(role)]];
}
