import { describe, it, expect } from 'vitest';
import { createSyncEvent, validateChecksum } from '@cullinos/sync';
import { calculateTax, createGstTaxGroup } from '@cullinos/tax-engine';
import { hasPermission } from '@cullinos/auth';
import { PERMISSIONS } from '@cullinos/shared';

describe('Cullinos critical paths', () => {
  it('sync events are idempotent by checksum', () => {
    const event = createSyncEvent('id-1', 'device-1', 'OrderCreated', { orderId: 'o1' });
    expect(validateChecksum(event)).toBe(true);
    event.checksum = 'tampered';
    expect(validateChecksum(event)).toBe(false);
  });

  it('GST tax calculation for India', () => {
    const group = createGstTaxGroup('g1', 'GST 18%', 18, false);
    const result = calculateTax({ amount: 10000, taxGroup: group });
    expect(result.taxAmount).toBe(1800);
    expect(result.total).toBe(11800);
  });

  it('RBAC permission check', () => {
    const perms = [PERMISSIONS.ORDER_CREATE, PERMISSIONS.POS_ACCESS];
    expect(hasPermission(perms, PERMISSIONS.ORDER_CREATE)).toBe(true);
    expect(hasPermission(perms, PERMISSIONS.ORDER_REFUND)).toBe(false);
  });
});
