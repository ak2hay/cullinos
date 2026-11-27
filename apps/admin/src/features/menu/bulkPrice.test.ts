import { describe, expect, it } from 'vitest';
import { applyBulkPrice } from './bulkPrice';

describe('applyBulkPrice', () => {
  it('sets a rupee price in paise', () => {
    expect(applyBulkPrice(15000, 'set', 99)).toBe(9900);
  });

  it('adds rupees', () => {
    expect(applyBulkPrice(10000, 'add', 20)).toBe(12000);
  });

  it('applies a percent and never goes below zero', () => {
    expect(applyBulkPrice(20000, 'percent', 10)).toBe(22000);
    expect(applyBulkPrice(5000, 'percent', -100)).toBe(0);
    expect(applyBulkPrice(5000, 'add', -100)).toBe(0);
  });
});
