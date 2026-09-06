import type { BusinessType } from './business-types';
import { getBusinessTypeParent } from './business-types';
import { PERMISSIONS } from './permissions';

export type PortalMode = 'erp' | 'pos';

/** QSR-family orgs use the dual ERP / POS portal shell. */
export function isQsrPortalOrg(type: BusinessType | null | undefined): boolean {
  if (!type) return false;
  return getBusinessTypeParent(type) === 'qsr';
}

export function canAccessPortalMode(permissions: string[], mode: PortalMode): boolean {
  if (mode === 'pos') {
    return permissions.includes(PERMISSIONS.POS_ACCESS);
  }
  // ERP: management-capable permissions (cashiers typically lack these)
  return (
    permissions.includes(PERMISSIONS.ORG_READ) ||
    permissions.includes(PERMISSIONS.REPORTS_READ) ||
    permissions.includes(PERMISSIONS.SETTINGS_READ) ||
    permissions.includes(PERMISSIONS.MENU_CREATE) ||
    permissions.includes(PERMISSIONS.STAFF_READ) ||
    permissions.includes(PERMISSIONS.ORG_MANAGE_SETTINGS)
  );
}

export function defaultPortalMode(permissions: string[]): PortalMode {
  const canErp = canAccessPortalMode(permissions, 'erp');
  const canPos = canAccessPortalMode(permissions, 'pos');
  if (!canErp && canPos) return 'pos';
  return 'erp';
}

/** Optional permission gate for ERP deep links / nav. */
export const ERP_NAV_PERMISSION_MAP: Record<string, string> = {
  '/staff': PERMISSIONS.STAFF_READ,
  '/settings': PERMISSIONS.SETTINGS_READ,
  '/reports': PERMISSIONS.REPORTS_READ,
  '/billing': PERMISSIONS.ORG_READ,
  '/onboarding': PERMISSIONS.ORG_UPDATE,
};

export function isErpNavPathAllowed(permissions: string[], path: string): boolean {
  const required = ERP_NAV_PERMISSION_MAP[path];
  if (!required) return true;
  // Owners/admins with ORG_READ can reach most admin surfaces
  if (permissions.includes(PERMISSIONS.ORG_MANAGE_USERS)) return true;
  return permissions.includes(required);
}
