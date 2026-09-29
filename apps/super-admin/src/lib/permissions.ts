import { useAuthStore } from '@/stores/auth';

/** Mirrors apps/api/src/common/platform-permissions.ts; the API is the source of truth. */
export type PlatformPermission =
  | 'dashboard.read'
  | 'health.read'
  | 'audit.read'
  | 'tenants.read'
  | 'tenants.write'
  | 'tenants.suspend'
  | 'tenants.delete'
  | 'tenants.impersonate'
  | 'tenant_users.manage'
  | 'plans.read'
  | 'plans.manage'
  | 'subscriptions.manage'
  | 'wallet.manage'
  | 'labs.sql'
  | 'settings.manage'
  | 'marketing.manage'
  | 'marketing.inquiries'
  | 'guest_ops.manage'
  | 'promo.send'
  | 'team.manage';

export type PlatformRole = 'owner' | 'support' | 'sales' | 'marketing' | 'finance' | 'viewer';

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  owner: 'Owner',
  support: 'Support',
  sales: 'Sales',
  marketing: 'Marketing',
  finance: 'Finance',
  viewer: 'Viewer',
};

export function hasPermission(
  permissions: readonly string[] | undefined,
  permission: PlatformPermission | readonly PlatformPermission[],
): boolean {
  if (!permissions) return false;
  const wanted = typeof permission === 'string' ? [permission] : permission;
  return wanted.some((p) => permissions.includes(p));
}

/** Returns a checker bound to the signed-in staff member's permissions. */
export function useCan() {
  const permissions = useAuthStore((s) => s.admin?.platformPermissions);
  return (permission: PlatformPermission | readonly PlatformPermission[]) =>
    hasPermission(permissions, permission);
}
