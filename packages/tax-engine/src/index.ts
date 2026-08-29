export interface TaxRate {
  name: string;
  rate: number;
  type: 'CGST' | 'SGST' | 'IGST' | 'GST' | 'VAT' | 'OTHER';
}

export interface TaxGroup {
  id: string;
  name: string;
  isInclusive: boolean;
  rates: TaxRate[];
}

export interface TaxLineItem {
  name: string;
  type: string;
  rate: number;
  amount: number;
}

export interface TaxCalculationInput {
  amount: number;
  taxGroup: TaxGroup;
  isInterState?: boolean;
}

export interface TaxCalculationResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxBreakdown: TaxLineItem[];
  isInclusive: boolean;
}

export function calculateTax(input: TaxCalculationInput): TaxCalculationResult {
  const { amount, taxGroup, isInterState = false } = input;
  const taxBreakdown: TaxLineItem[] = [];

  if (taxGroup.rates.length === 0) {
    return {
      subtotal: amount,
      taxAmount: 0,
      total: amount,
      taxBreakdown: [],
      isInclusive: taxGroup.isInclusive,
    };
  }

  let subtotal: number;
  let taxAmount: number;
  let total: number;

  if (taxGroup.isInclusive) {
    const totalRate = taxGroup.rates.reduce((sum, r) => sum + r.rate, 0);
    subtotal = Math.round(amount / (1 + totalRate / 100));
    taxAmount = amount - subtotal;
    total = amount;
  } else {
    subtotal = amount;
    taxAmount = 0;
    for (const rate of taxGroup.rates) {
      if (isInterState && (rate.type === 'CGST' || rate.type === 'SGST')) continue;
      if (!isInterState && rate.type === 'IGST') continue;
      const lineAmount = Math.round(subtotal * (rate.rate / 100));
      taxAmount += lineAmount;
      taxBreakdown.push({
        name: rate.name,
        type: rate.type,
        rate: rate.rate,
        amount: lineAmount,
      });
    }
    total = subtotal + taxAmount;
  }

  if (taxGroup.isInclusive && taxBreakdown.length === 0) {
    for (const rate of taxGroup.rates) {
      if (isInterState && (rate.type === 'CGST' || rate.type === 'SGST')) continue;
      if (!isInterState && rate.type === 'IGST') continue;
      const lineAmount = Math.round(subtotal * (rate.rate / 100));
      taxBreakdown.push({
        name: rate.name,
        type: rate.type,
        rate: rate.rate,
        amount: lineAmount,
      });
    }
  }

  return { subtotal, taxAmount, total, taxBreakdown, isInclusive: taxGroup.isInclusive };
}

export function createGstTaxGroup(
  id: string,
  name: string,
  gstRate: number,
  isInclusive = false,
): TaxGroup {
  const halfRate = gstRate / 2;
  return {
    id,
    name,
    isInclusive,
    rates: [
      { name: 'CGST', rate: halfRate, type: 'CGST' },
      { name: 'SGST', rate: halfRate, type: 'SGST' },
      { name: 'IGST', rate: gstRate, type: 'IGST' },
    ],
  };
}
