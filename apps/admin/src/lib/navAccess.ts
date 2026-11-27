import { PERMISSIONS } from '@cullinos/shared';

/**
 * Extra nav filter so each role sees the jobs they actually do.
 * Owners and org admins (org:manage_users or org:read) still see every item
 * the permission map allows. Paths with no rule stay visible.
 */
const JOB_ANY_OF: Record<string, string[]> = {
  '/tables': [PERMISSIONS.TABLE_READ, PERMISSIONS.TABLE_MANAGE],
  '/reservations': [PERMISSIONS.TABLE_READ, PERMISSIONS.TABLE_MANAGE],
  '/displays': [PERMISSIONS.KITCHEN_READ, PERMISSIONS.SETTINGS_READ],
  '/stations': [PERMISSIONS.KITCHEN_READ, PERMISSIONS.KITCHEN_UPDATE, PERMISSIONS.SETTINGS_READ],
  '/kiosk': [PERMISSIONS.SETTINGS_UPDATE, PERMISSIONS.SETTINGS_READ],
  '/delivery': [PERMISSIONS.ORDER_READ, PERMISSIONS.ORDER_UPDATE],
  '/recipes': [PERMISSIONS.MENU_UPDATE, PERMISSIONS.INVENTORY_READ],
  '/production': [PERMISSIONS.INVENTORY_READ, PERMISSIONS.MENU_UPDATE],
  '/brands': [PERMISSIONS.SETTINGS_READ, PERMISSIONS.MENU_UPDATE],
  '/events': [PERMISSIONS.SETTINGS_READ],
  '/banquets': [PERMISSIONS.SETTINGS_READ],
  '/marketplace': [PERMISSIONS.SETTINGS_UPDATE, PERMISSIONS.OUTLET_UPDATE],
  '/hospitality/guests': [PERMISSIONS.SETTINGS_READ, PERMISSIONS.CUSTOMER_READ],
  '/hospitality/rooms': [PERMISSIONS.SETTINGS_READ],
};

export function isJobNavVisible(permissions: string[], path: string): boolean {
  if (
    permissions.includes(PERMISSIONS.ORG_MANAGE_USERS) ||
    permissions.includes(PERMISSIONS.ORG_READ)
  ) {
    return true;
  }
  const anyOf = JOB_ANY_OF[path];
  if (!anyOf) return true;
  return anyOf.some((permission) => permissions.includes(permission));
}
