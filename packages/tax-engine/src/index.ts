export const GST_TYPES = ["CGST", "SGST", "IGST"] as const;
export type GstType = (typeof GST_TYPES)[number];

export const LEVY_TYPES = ["EXCISE"] as const;
export type LevyType = (typeof LEVY_TYPES)[number];

export type TaxLineInput = {
  name: string;
  rate: number;
  type?: GstType | LevyType | string;
};

export type TaxableItem = {
  /** Amount in major currency units (rupees). Prefer amountPaise for precision. */
  amount?: number;
  /** Amount in paise (integer). Takes precedence over amount when set. */
  amountPaise?: number;
  taxGroupId?: string;
  isInclusive?: boolean;
};

export type TaxLineResult = {
  name: string;
  rate: number;
  amount: number;
  type?: GstType | LevyType | string;
};

export type TaxCalculationResult = {
  /** Exclusive taxable subtotal (rupees). */
  subtotal: number;
  taxLines: TaxLineResult[];
  taxTotal: number;
  total: number;
  /** Per-item tax in rupees, aligned with input order. */
  itemTaxes: number[];
};

function toPaise(value: number): number {
  return Math.round(value * 100);
}

function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

function itemPaise(item: TaxableItem): number {
  if (item.amountPaise != null && Number.isFinite(item.amountPaise)) {
    return Math.round(item.amountPaise);
  }
  return toPaise(Number(item.amount ?? 0));
}

function asGstType(type: string | undefined): GstType | undefined {
  if (type === "CGST" || type === "SGST" || type === "IGST") return type;
  return undefined;
}

function isExciseOnly(rates: TaxLineInput[]): boolean {
  return rates.length > 0 && rates.every((r) => r.type === "EXCISE");
}

function partitionRates(rates: TaxLineInput[]): {
  gst: TaxLineInput[];
  excise: TaxLineInput[];
} {
  const gst: TaxLineInput[] = [];
  const excise: TaxLineInput[] = [];
  for (const r of rates) {
    if (r.type === "EXCISE") excise.push(r);
    else gst.push(r);
  }
  return { gst, excise };
}

function totalRatePercent(rates: TaxLineInput[], isInterState: boolean): number {
  if (isExciseOnly(rates)) {
    return rates.reduce((sum, r) => sum + (Number(r.rate) || 0), 0);
  }

  const { gst } = partitionRates(rates);
  const schedule = gst.length ? gst : rates;

  if (isInterState) {
    const igst = schedule.find((r) => r.type === "IGST");
    if (igst) return Number(igst.rate) || 0;
    return schedule.reduce((sum, r) => sum + (Number(r.rate) || 0), 0);
  }

  const cgst = schedule.find((r) => r.type === "CGST");
  const sgst = schedule.find((r) => r.type === "SGST");
  if (cgst || sgst) {
    return (Number(cgst?.rate) || 0) + (Number(sgst?.rate) || 0);
  }

  // Single "GST" / percentage rate → split CGST+SGST when intra-state.
  return Number(schedule[0]?.rate) || 0;
}

function buildExciseLines(
  taxablePaise: number,
  rates: TaxLineInput[],
): { lines: TaxLineResult[]; taxPaise: number } {
  const lines: TaxLineResult[] = [];
  let taxPaise = 0;
  for (const r of rates) {
    const rate = Number(r.rate) || 0;
    const amountPaise = Math.round((taxablePaise * rate) / 100);
    taxPaise += amountPaise;
    lines.push({
      name: r.name?.trim() || "State Excise",
      rate,
      amount: fromPaise(amountPaise),
      type: "EXCISE",
    });
  }
  return { lines, taxPaise };
}

function buildLines(
  taxablePaise: number,
  rates: TaxLineInput[],
  isInterState: boolean,
): { lines: TaxLineResult[]; taxPaise: number } {
  if (taxablePaise <= 0 || rates.length === 0) {
    return { lines: [], taxPaise: 0 };
  }

  if (isExciseOnly(rates)) {
    return buildExciseLines(taxablePaise, rates);
  }

  const { gst, excise } = partitionRates(rates);
  const schedule = gst.length ? gst : rates;

  let lines: TaxLineResult[] = [];
  let taxPaise = 0;

  if (isInterState) {
    const rate = totalRatePercent(schedule, true);
    const igstPaise = Math.round((taxablePaise * rate) / 100);
    const name = schedule.find((r) => r.type === "IGST")?.name ?? "IGST";
    lines = [{ name, rate, amount: fromPaise(igstPaise), type: "IGST" }];
    taxPaise = igstPaise;
  } else {
    const cgstRate =
      schedule.find((r) => r.type === "CGST")?.rate ??
      (schedule[0] ? Number(schedule[0].rate) / 2 : 0);
    const sgstRate =
      schedule.find((r) => r.type === "SGST")?.rate ??
      (schedule[0] ? Number(schedule[0].rate) / 2 : 0);

    const cgstPaise = Math.round((taxablePaise * Number(cgstRate)) / 100);
    const sgstPaise = Math.round((taxablePaise * Number(sgstRate)) / 100);
    const cgstName = schedule.find((r) => r.type === "CGST")?.name ?? "CGST";
    const sgstName = schedule.find((r) => r.type === "SGST")?.name ?? "SGST";

    lines = [
      { name: cgstName, rate: Number(cgstRate), amount: fromPaise(cgstPaise), type: "CGST" },
      { name: sgstName, rate: Number(sgstRate), amount: fromPaise(sgstPaise), type: "SGST" },
    ];
    taxPaise = cgstPaise + sgstPaise;
  }

  if (excise.length) {
    const exciseResult = buildExciseLines(taxablePaise, excise);
    lines = [...lines, ...exciseResult.lines];
    taxPaise += exciseResult.taxPaise;
  }

  return { lines, taxPaise };
}

/**
 * Calculate GST (and optional State Excise) for a set of line amounts sharing one rate schedule.
 * Uses integer paise arithmetic for stable rounding.
 */
export function calculateGst(
  items: TaxableItem[],
  rates: TaxLineInput[],
  isInterState = false,
): TaxCalculationResult {
  const isInclusive = items.some((i) => i.isInclusive);
  const itemTaxes: number[] = [];
  let subtotalPaise = 0;
  let taxPaiseTotal = 0;
  const lineMap = new Map<string, TaxLineResult>();

  for (const item of items) {
    const grossPaise = itemPaise(item);
    const ratePercent = totalRatePercent(rates, isInterState);
    let taxablePaise = grossPaise;
    let itemTaxPaise = 0;

    if (rates.length === 0 || ratePercent === 0) {
      itemTaxes.push(0);
      subtotalPaise += grossPaise;
      continue;
    }

    if (isInclusive || item.isInclusive) {
      taxablePaise = Math.round((grossPaise * 100) / (100 + ratePercent));
      itemTaxPaise = grossPaise - taxablePaise;
    } else {
      itemTaxPaise = Math.round((grossPaise * ratePercent) / 100);
    }

    const { lines, taxPaise } = buildLines(
      isInclusive || item.isInclusive ? taxablePaise : grossPaise,
      rates,
      isInterState,
    );

    // Prefer line-built tax when exclusive; for inclusive use derived split.
    if (isInclusive || item.isInclusive) {
      const scale = taxPaise > 0 ? itemTaxPaise / taxPaise : 0;
      for (const line of lines) {
        const amountPaise = Math.round(toPaise(line.amount) * scale);
        const key = `${line.type ?? line.name}:${line.rate}`;
        const existing = lineMap.get(key);
        if (existing) {
          existing.amount = fromPaise(toPaise(existing.amount) + amountPaise);
        } else {
          lineMap.set(key, { ...line, amount: fromPaise(amountPaise) });
        }
      }
      itemTaxes.push(fromPaise(itemTaxPaise));
      subtotalPaise += taxablePaise;
      taxPaiseTotal += itemTaxPaise;
    } else {
      for (const line of lines) {
        const key = `${line.type ?? line.name}:${line.rate}`;
        const existing = lineMap.get(key);
        if (existing) {
          existing.amount = fromPaise(toPaise(existing.amount) + toPaise(line.amount));
        } else {
          lineMap.set(key, { ...line });
        }
      }
      itemTaxes.push(fromPaise(taxPaise));
      subtotalPaise += grossPaise;
      taxPaiseTotal += taxPaise;
    }
  }

  return {
    subtotal: fromPaise(subtotalPaise),
    taxLines: [...lineMap.values()],
    taxTotal: fromPaise(taxPaiseTotal),
    total: fromPaise(subtotalPaise + taxPaiseTotal),
    itemTaxes,
  };
}

/**
 * Calculate tax across items that may use different tax groups.
 */
export function calculateMixedGst(
  items: Array<{
    amountPaise: number;
    rates: TaxLineInput[];
    isInclusive?: boolean;
  }>,
  isInterState = false,
): TaxCalculationResult {
  const itemTaxes: number[] = [];
  let subtotalPaise = 0;
  let taxPaiseTotal = 0;
  const lineMap = new Map<string, TaxLineResult>();

  for (const item of items) {
    const result = calculateGst(
      [{ amountPaise: item.amountPaise, isInclusive: item.isInclusive }],
      item.rates,
      isInterState,
    );
    itemTaxes.push(result.itemTaxes[0] ?? 0);
    subtotalPaise += toPaise(result.subtotal);
    taxPaiseTotal += toPaise(result.taxTotal);
    for (const line of result.taxLines) {
      const key = `${line.type ?? line.name}:${line.rate}`;
      const existing = lineMap.get(key);
      if (existing) {
        existing.amount = fromPaise(toPaise(existing.amount) + toPaise(line.amount));
      } else {
        lineMap.set(key, { ...line });
      }
    }
  }

  return {
    subtotal: fromPaise(subtotalPaise),
    taxLines: [...lineMap.values()],
    taxTotal: fromPaise(taxPaiseTotal),
    total: fromPaise(subtotalPaise + taxPaiseTotal),
    itemTaxes,
  };
}

export function splitGstRate(totalRate: number): { cgst: number; sgst: number } {
  return { cgst: totalRate / 2, sgst: totalRate / 2 };
}

export { asGstType };
