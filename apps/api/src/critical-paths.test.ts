import { describe, it, expect } from 'vitest';
import { SyncQueue, createIdempotencyKey } from '@cullinos/sync';
import { calculateGst } from '@cullinos/tax-engine';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from '@cullinos/shared';

describe('Cullinos critical paths', () => {
  it('sync queue deduplicates by idempotency key', () => {
    const queue = new SyncQueue();
    const key = createIdempotencyKey('order');
    const event = {
      type: 'OrderCreated',
      idempotencyKey: key,
      organizationId: 'org-1',
      data: { orderId: 'o1' },
      createdAt: new Date().toISOString(),
    };

    queue.enqueue(event);
    queue.enqueue(event);
    expect(queue.size()).toBe(1);
  });

  it('GST tax calculation for India', () => {
    const result = calculateGst([{ amount: 10000 }], [{ name: 'GST', rate: 18 }], false);
    expect(result.taxTotal).toBe(1800);
    expect(result.total).toBe(11800);
  });

  it('RBAC default waiter permissions', () => {
    const waiterPerms = DEFAULT_ROLE_PERMISSIONS.WAITER;
    expect(waiterPerms).toContain(PERMISSIONS.ORDER_CREATE);
    expect(waiterPerms).not.toContain(PERMISSIONS.ORDER_REFUND);
  });
});
