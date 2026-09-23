import { describe, it, expect } from 'vitest';
import { calculateGst, calculateMixedGst, splitGstRate } from './index';

describe('tax-engine', () => {
  it('calculates exclusive GST (intra-state CGST+SGST)', () => {
    const result = calculateGst([{ amount: 100 }], [{ name: 'GST', rate: 18 }], false);
    expect(result.subtotal).toBe(100);
    expect(result.taxTotal).toBe(18);
    expect(result.total).toBe(118);
    expect(result.taxLines).toHaveLength(2);
    expect(result.itemTaxes[0]).toBe(18);
  });

  it('calculates inter-state IGST', () => {
    const result = calculateGst(
      [{ amount: 100 }],
      [{ name: 'IGST', rate: 18, type: 'IGST' }],
      true,
    );
    expect(result.subtotal).toBe(100);
    expect(result.taxTotal).toBe(18);
    expect(result.taxLines[0]?.type).toBe('IGST');
  });

  it('calculates inclusive GST', () => {
    const result = calculateGst(
      [{ amount: 118, isInclusive: true }],
      [{ name: 'GST', rate: 18 }],
      false,
    );
    expect(result.total).toBe(118);
    expect(result.subtotal).toBe(100);
    expect(result.taxTotal).toBe(18);
  });

  it('supports mixed tax groups via calculateMixedGst', () => {
    const result = calculateMixedGst([
      { amountPaise: 10000, rates: [{ name: 'GST', rate: 5 }] },
      { amountPaise: 10000, rates: [{ name: 'GST', rate: 18 }] },
    ]);
    expect(result.subtotal).toBe(200);
    expect(result.taxTotal).toBe(23);
    expect(result.total).toBe(223);
    expect(result.itemTaxes).toEqual([5, 18]);
  });

  it('splits GST rate evenly for CGST and SGST', () => {
    expect(splitGstRate(18)).toEqual({ cgst: 9, sgst: 9 });
  });

  it('uses paise arithmetic for fractional rupees', () => {
    const result = calculateGst([{ amountPaise: 999 }], [{ name: 'GST', rate: 5 }], false);
    expect(result.taxTotal).toBe(0.5);
    expect(result.total).toBe(10.49);
  });

  it('calculates State Excise without CGST/SGST lines', () => {
    const result = calculateGst(
      [{ amount: 200 }],
      [{ name: 'State Excise', rate: 10, type: 'EXCISE' }],
      false,
    );
    expect(result.subtotal).toBe(200);
    expect(result.taxTotal).toBe(20);
    expect(result.taxLines).toHaveLength(1);
    expect(result.taxLines[0]?.type).toBe('EXCISE');
    expect(result.taxLines[0]?.name).toBe('State Excise');
  });

  it('sums typed CGST+SGST rates as total GST', () => {
    const result = calculateGst(
      [{ amount: 100 }],
      [
        { name: 'CGST', rate: 2.5, type: 'CGST' },
        { name: 'SGST', rate: 2.5, type: 'SGST' },
      ],
      false,
    );
    expect(result.taxTotal).toBe(5);
    expect(result.taxLines).toHaveLength(2);
  });
});
