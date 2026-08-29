import { describe, it, expect } from 'vitest';
import { createSyncEvent, validateChecksum, computeChecksum } from './index';

describe('sync', () => {
  it('creates sync event with valid checksum', () => {
    const event = createSyncEvent('uuid-1', 'device-1', 'OrderCreated', { orderId: 'o1' });
    expect(event.id).toBe('uuid-1');
    expect(validateChecksum(event)).toBe(true);
  });

  it('detects invalid checksum', () => {
    const event = createSyncEvent('uuid-2', 'device-1', 'OrderCreated', { orderId: 'o2' });
    event.checksum = 'invalid';
    expect(validateChecksum(event)).toBe(false);
  });

  it('checksum is deterministic', () => {
    const a = computeChecksum({ b: 2, a: 1 });
    const b = computeChecksum({ a: 1, b: 2 });
    expect(a).toBe(b);
  });
});
