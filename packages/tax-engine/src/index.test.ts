import { describe, it, expect } from 'vitest';
import { calculateGst, splitGstRate } from './index';

describe('tax-engine', () => {
  it('calculates exclusive GST (intra-state CGST+SGST)', () => {
    const result = calculateGst([{ amount: 10000 }], [{ name: 'GST', rate: 18 }], false);
    expect(result.subtotal).toBe(10000);
    expect(result.taxTotal).toBe(1800);
    expect(result.total).toBe(11800);
    expect(result.taxLines).toHaveLength(2);
  });

  it('calculates inter-state IGST', () => {
    const result = calculateGst(
      [{ amount: 10000 }],
      [{ name: 'IGST', rate: 18, type: 'IGST' }],
      true,
    );
    expect(result.subtotal).toBe(10000);
    expect(result.taxTotal).toBe(1800);
    expect(result.taxLines[0]?.type).toBe('IGST');
  });

  it('splits GST rate evenly for CGST and SGST', () => {
    expect(splitGstRate(18)).toEqual({ cgst: 9, sgst: 9 });
  });
});
