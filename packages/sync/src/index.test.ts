import { describe, it, expect } from 'vitest';
import { SyncQueue, createIdempotencyKey } from './index';

describe('sync', () => {
  it('creates unique idempotency keys', () => {
    const a = createIdempotencyKey('order');
    const b = createIdempotencyKey('order');
    expect(a).not.toBe(b);
    expect(a.startsWith('order_')).toBe(true);
  });

  it('deduplicates queued events by idempotency key', () => {
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

  it('dequeues events in FIFO order', () => {
    const queue = new SyncQueue();
    const first = {
      type: 'A',
      idempotencyKey: 'a',
      organizationId: 'org-1',
      data: {},
      createdAt: new Date().toISOString(),
    };
    const second = {
      type: 'B',
      idempotencyKey: 'b',
      organizationId: 'org-1',
      data: {},
      createdAt: new Date().toISOString(),
    };

    queue.enqueue(first);
    queue.enqueue(second);
    expect(queue.dequeue()?.type).toBe('A');
    expect(queue.dequeue()?.type).toBe('B');
    expect(queue.size()).toBe(0);
  });
});
