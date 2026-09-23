/** Default role → permission strings (module:action). Kept in sync with seed. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    "org:read", "org:update", "org:manage_users", "org:manage_settings",
    "outlet:read", "outlet:create", "outlet:update", "outlet:delete",
    "menu:read", "menu:create", "menu:update",
    "order:read", "order:create", "order:update", "order:cancel", "order:discount", "order:discount:approve",
    "pos:access", "pos:shift:open", "pos:shift:close", "pos:day:close",
    "table:read", "table:manage", "inventory:read", "inventory:adjust", "inventory:transfer",
    "purchase:read", "purchase:create",
    "reports:read", "reports:export", "settings:read", "settings:update", "staff:read", "staff:manage",
  ],
  manager: [
    "org:read", "outlet:read", "outlet:update", "menu:read", "menu:create", "menu:update",
    "order:read", "order:create", "order:update", "order:cancel", "order:discount", "order:discount:approve",
    "pos:access", "pos:shift:open", "pos:shift:close", "pos:day:close",
    "table:read", "table:manage", "inventory:read", "inventory:adjust", "inventory:transfer",
    "purchase:read", "purchase:create",
    "reports:read", "reports:export", "settings:read", "settings:update", "staff:read",
  ],
  waiter: [
    "menu:read", "order:read", "order:create", "order:update",
    "table:read", "table:manage", "customer:read",
  ],
  cashier: [
    "outlet:read", "menu:read", "order:read", "order:create", "order:update", "order:discount",
    "pos:access", "pos:shift:open", "pos:shift:close", "table:read", "customer:read",
  ],
  kitchen: [
    "kitchen:read", "kitchen:update", "order:read", "menu:read",
  ],
};

export const SYSTEM_ROLE_SLUGS = ["owner", "manager", "waiter", "cashier", "kitchen"] as const;

export type SystemRoleSlug = (typeof SYSTEM_ROLE_SLUGS)[number];

export const STAFF_CREATABLE_ROLES: SystemRoleSlug[] = ["manager", "waiter", "cashier", "kitchen"];
