/**
 * Rkyves internal staff permissions for the super admin panel. These are separate
 * from tenant role permissions (`permissions` claim / RequirePermissions) and only
 * ever appear on platform tokens.
 */

export type PlatformPermissionRisk = "low" | "medium" | "high" | "critical";

export type PlatformPermissionDef = {
  key: string;
  label: string;
  group: string;
  risk: PlatformPermissionRisk;
  /** Holders with only a region / tenant-set scoped grant can use it on in-scope tenants. */
  scopable?: boolean;
};

/** Catalog shown in the role editor; the order here is the display order. */
export const PLATFORM_PERMISSION_CATALOG = [
  { key: "dashboard.read", label: "View dashboard", group: "Overview", risk: "low" },
  { key: "health.read", label: "View system health", group: "Platform", risk: "low" },
  { key: "audit.read", label: "View tenant audit log", group: "Governance", risk: "medium" },
  { key: "activity.read", label: "View staff activity log", group: "Governance", risk: "medium" },
  { key: "activity.export", label: "Export staff activity log", group: "Governance", risk: "high" },

  { key: "tenants.read", label: "View tenants", group: "Customers", risk: "medium", scopable: true },
  { key: "tenants.write", label: "Onboard and edit tenants", group: "Customers", risk: "high", scopable: true },
  { key: "tenants.suspend", label: "Suspend / reactivate tenants", group: "Customers", risk: "high", scopable: true },
  { key: "tenants.delete", label: "Delete tenants", group: "Customers", risk: "critical" },
  { key: "tenants.impersonate", label: "Request ticket-backed tenant access", group: "Customers", risk: "critical", scopable: true },
  { key: "tenants.export", label: "Export tenant data", group: "Customers", risk: "high" },
  { key: "tenant_users.manage", label: "Reset / suspend tenant users", group: "Customers", risk: "high", scopable: true },

  { key: "plans.read", label: "View plans", group: "Finance", risk: "low" },
  { key: "plans.manage", label: "Edit plan catalog and prices", group: "Finance", risk: "high" },
  { key: "subscriptions.manage", label: "Manage subscriptions and collections", group: "Finance", risk: "high", scopable: true },
  { key: "wallet.manage", label: "Adjust tenant wallets", group: "Finance", risk: "critical", scopable: true },

  { key: "tickets.read", label: "View support tickets", group: "Support", risk: "low" },
  { key: "tickets.write", label: "Create and work tickets", group: "Support", risk: "medium" },
  { key: "tickets.assign", label: "Assign and escalate tickets", group: "Support", risk: "medium" },
  { key: "tenant_access.revoke", label: "Revoke anyone's tenant access grant", group: "Support", risk: "high" },

  { key: "marketing.manage", label: "Marketing CMS", group: "Growth", risk: "medium" },
  { key: "marketing.inquiries", label: "Marketing inquiries", group: "Growth", risk: "medium" },
  { key: "guest_ops.manage", label: "Cullinos App Ops", group: "Growth", risk: "medium" },
  { key: "promo.send", label: "Send promo campaigns", group: "Growth", risk: "high" },

  { key: "labs.sql", label: "Labs SQL console", group: "Platform", risk: "critical" },
  { key: "settings.manage", label: "Platform settings and integration keys", group: "Platform", risk: "critical" },

  { key: "directory.read", label: "View employee directory", group: "People", risk: "low" },
  { key: "directory.manage", label: "Edit employee profiles and lifecycle", group: "People", risk: "high" },
  { key: "shifts.manage", label: "Manage shifts and on-call", group: "People", risk: "medium" },
  { key: "team.manage", label: "Invite / deactivate platform staff", group: "People", risk: "critical" },
  { key: "iam.read", label: "View departments, teams and roles", group: "Access", risk: "low" },
  { key: "iam.manage", label: "Edit departments, teams and custom roles", group: "Access", risk: "critical" },
  { key: "iam.assign", label: "Grant and revoke roles", group: "Access", risk: "critical" },
  { key: "access_reviews.manage", label: "Run access review campaigns", group: "Access", risk: "high" },
  { key: "sessions.manage", label: "View and revoke staff sessions", group: "Access", risk: "high" },
  { key: "security.manage", label: "IP allowlists and step-up policy", group: "Access", risk: "critical" },
  { key: "approvals.policies", label: "Edit approval policies", group: "Governance", risk: "critical" },
  { key: "approvals.read_all", label: "View every approval request", group: "Governance", risk: "medium" },

  { key: "reports.read", label: "View operations reports", group: "Reports", risk: "low" },
  { key: "reports.export", label: "Export reports", group: "Reports", risk: "high" },
  { key: "bulk.run", label: "Run bulk tenant operations", group: "Reports", risk: "critical" },
] as const satisfies readonly PlatformPermissionDef[];

export type PlatformPermission = (typeof PLATFORM_PERMISSION_CATALOG)[number]["key"];

export const PLATFORM_PERMISSIONS: readonly PlatformPermission[] = PLATFORM_PERMISSION_CATALOG.map(
  (p) => p.key,
);

const CATALOG_BY_KEY = new Map<string, PlatformPermissionDef>(
  PLATFORM_PERMISSION_CATALOG.map((p) => [p.key, p]),
);

export function isPlatformPermission(value: unknown): value is PlatformPermission {
  return typeof value === "string" && CATALOG_BY_KEY.has(value);
}

export function permissionRisk(key: string): PlatformPermissionRisk | null {
  return CATALOG_BY_KEY.get(key)?.risk ?? null;
}

export function isScopablePermission(key: string): boolean {
  return CATALOG_BY_KEY.get(key)?.scopable === true;
}

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

export const PLATFORM_ROLE_DESCRIPTIONS: Record<PlatformRoleName, string> = {
  owner: "Everything, including team, settings, Labs SQL, IAM and tenant delete.",
  support: "Tenants, tickets, ticket-backed tenant access, tenant user resets, App Ops.",
  sales: "Tenants (read, onboard), subscriptions, plans (read), inquiries.",
  marketing: "Marketing CMS, inquiries, promo email, App Ops.",
  finance: "Plans, subscriptions, tenant wallets, audit and finance reports.",
  viewer: "Read-only dashboard, tenants, plans, audit, health and directory.",
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
    "tickets.read",
    "tickets.write",
    "tickets.assign",
    "directory.read",
    "reports.read",
  ],
  sales: [
    "dashboard.read",
    "tenants.read",
    "tenants.write",
    "plans.read",
    "subscriptions.manage",
    "marketing.inquiries",
    "tickets.read",
    "directory.read",
    "reports.read",
  ],
  marketing: [
    "dashboard.read",
    "marketing.manage",
    "marketing.inquiries",
    "promo.send",
    "guest_ops.manage",
    "directory.read",
  ],
  finance: [
    "dashboard.read",
    "audit.read",
    "tenants.read",
    "plans.read",
    "plans.manage",
    "subscriptions.manage",
    "wallet.manage",
    "directory.read",
    "reports.read",
    "reports.export",
  ],
  viewer: [
    "dashboard.read",
    "health.read",
    "audit.read",
    "tenants.read",
    "plans.read",
    "directory.read",
    "reports.read",
  ],
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
