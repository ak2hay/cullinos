import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLE_PERMISSIONS, isErpNavPathAllowed } from './index';

describe('isErpNavPathAllowed', () => {
  it('lets the owner open menu, reports, and billing', () => {
    const owner = DEFAULT_ROLE_PERMISSIONS.OWNER;
    expect(isErpNavPathAllowed(owner, '/menu')).toBe(true);
    expect(isErpNavPathAllowed(owner, '/reports')).toBe(true);
    expect(isErpNavPathAllowed(owner, '/billing')).toBe(true);
  });

  it('lets kitchen open orders and menu, not staff or reports', () => {
    const chef = DEFAULT_ROLE_PERMISSIONS.CHEF;
    expect(isErpNavPathAllowed(chef, '/orders')).toBe(true);
    expect(isErpNavPathAllowed(chef, '/menu')).toBe(true);
    expect(isErpNavPathAllowed(chef, '/staff')).toBe(false);
    expect(isErpNavPathAllowed(chef, '/reports')).toBe(false);
  });

  it('lets an accountant open reports and purchasing, not the menu', () => {
    const accountant = DEFAULT_ROLE_PERMISSIONS.ACCOUNTANT;
    expect(isErpNavPathAllowed(accountant, '/reports')).toBe(true);
    expect(isErpNavPathAllowed(accountant, '/purchasing')).toBe(true);
    expect(isErpNavPathAllowed(accountant, '/orders')).toBe(true);
    expect(isErpNavPathAllowed(accountant, '/menu')).toBe(false);
  });

  it('keeps manager access to menu, staff, and reports', () => {
    const manager = DEFAULT_ROLE_PERMISSIONS.MANAGER;
    expect(isErpNavPathAllowed(manager, '/menu')).toBe(true);
    expect(isErpNavPathAllowed(manager, '/staff')).toBe(true);
    expect(isErpNavPathAllowed(manager, '/reports')).toBe(true);
    expect(isErpNavPathAllowed(manager, '/settings')).toBe(true);
  });
});
