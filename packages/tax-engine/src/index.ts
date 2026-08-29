export const GST_TYPES = ["CGST", "SGST", "IGST"] as const;
export type GstType = typeof GST_TYPES[number];

export type TaxLineInput = {
  name: string;
  rate: number;
  type?: GstType;
};

export type TaxableItem = {
  amount: number;
  taxGroupId?: string;
  isInclusive?: boolean;
};

export type TaxLineResult = {
  name: string;
  rate: number;
  amount: number;
  type?: GstType;
};

export type TaxCalculationResult = {
  subtotal: number;
  taxLines: TaxLineResult[];
  taxTotal: number;
  total: number;
};

export function calculateGst(
  items: TaxableItem[],
  rates: TaxLineInput[],
  isInterState = false
): TaxCalculationResult {
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const taxLines: TaxLineResult[] = [];

  if (isInterState) {
    const igstRate = rates.find((r) => r.type === "IGST")?.rate ?? rates[0]?.rate ?? 0;
    const taxAmount = subtotal * (igstRate / 100);
    taxLines.push({ name: "IGST", rate: igstRate, amount: taxAmount, type: "IGST" });
  } else {
    const halfRate = (rates.find((r) => r.type === "CGST")?.rate ?? rates[0]?.rate ?? 0) / 2;
    const cgst = subtotal * (halfRate / 100);
    const sgst = subtotal * (halfRate / 100);
    taxLines.push({ name: "CGST", rate: halfRate, amount: cgst, type: "CGST" });
    taxLines.push({ name: "SGST", rate: halfRate, amount: sgst, type: "SGST" });
  }

  const taxTotal = taxLines.reduce((sum, line) => sum + line.amount, 0);
  return { subtotal, taxLines, taxTotal, total: subtotal + taxTotal };
}

export function splitGstRate(totalRate: number): { cgst: number; sgst: number } {
  return { cgst: totalRate / 2, sgst: totalRate / 2 };
}
