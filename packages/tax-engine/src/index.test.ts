import { describe, it, expect } from 'vitest';
import { calculateTax, createGstTaxGroup } from './index';

describe('tax-engine', () => {
  it('calculates exclusive GST', () => {
    const group = createGstTaxGroup('1', 'GST 5%', 5, false);
    const result = calculateTax({ amount: 10000, taxGroup: group });
    expect(result.subtotal).toBe(10000);
    expect(result.taxAmount).toBe(500);
    expect(result.total).toBe(10500);
  });

  it('calculates inclusive GST', () => {
    const group = createGstTaxGroup('1', 'GST 5%', 5, true);
    const result = calculateTax({ amount: 10500, taxGroup: group });
    expect(result.total).toBe(10500);
    expect(result.subtotal).toBeLessThan(10500);
  });
});
