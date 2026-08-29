/** Default role → permission strings (module:action). Kept in sync with seed. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    "org:read", "org:update", "org:manage_users", "org:manage_settings",
    "outlet:read", "menu:read", "menu:create", "menu:update",
    "order:read", "order:create", "order:update", "order:cancel", "pos:access",
    "table:read", "table:manage", "inventory:read", "inventory:adjust", "inventory:transfer",
    "reports:read", "reports:export", "settings:read", "settings:update", "staff:read", "staff:manage",
  ],
  manager: [
    "org:read", "outlet:read", "menu:read", "menu:create", "menu:update",
    "order:read", "order:create", "order:update", "order:cancel", "pos:access",
    "table:read", "table:manage", "inventory:read", "inventory:adjust", "inventory:transfer",
    "reports:read", "reports:export", "settings:read", "settings:update", "staff:read",
  ],
  waiter: [
    "menu:read", "order:read", "order:create", "order:update",
    "table:read", "table:manage", "customer:read",
  ],
  cashier: [
    "outlet:read", "menu:read", "order:read", "order:create", "order:update",
    "pos:access", "table:read", "customer:read",
  ],
};

export const SYSTEM_ROLE_SLUGS = ["owner", "manager", "waiter", "cashier"] as const;

export type SystemRoleSlug = (typeof SYSTEM_ROLE_SLUGS)[number];

export const STAFF_CREATABLE_ROLES: SystemRoleSlug[] = ["manager", "waiter", "cashier"];
