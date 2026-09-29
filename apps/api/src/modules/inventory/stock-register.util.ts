/**
 * StockMovement.quantity is always stored positive; direction comes from the type.
 * `transfer` rows are written on the source item only, so they count as stock out.
 */
const MOVEMENT_SIGN: Record<string, 1 | -1> = {
  purchase: 1,
  return: 1,
  adjustment: 1,
  sale: -1,
  wastage: -1,
  transfer: -1,
};

export const LIQUID_UNITS = ["mL", "L", "bottles"] as const;

export type RegisterItem = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  costPerUnit: number;
};

export type MovementSum = { inventoryItemId: string; type: string; quantity: number };

export type StockRegisterRow = {
  inventoryItemId: string;
  name: string;
  sku: string | null;
  unit: string;
  opening: number;
  received: number;
  sold: number;
  wasted: number;
  transferredOut: number;
  closing: number;
  costPerUnit: number;
  closingValue: number;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function signedNet(sums: MovementSum[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const s of sums) {
    const sign = MOVEMENT_SIGN[s.type] ?? 0;
    net.set(s.inventoryItemId, (net.get(s.inventoryItemId) ?? 0) + sign * s.quantity);
  }
  return net;
}

/**
 * Rebuild opening/closing for a period from today's stock:
 * closing = current − net movements after the period, opening = closing − net movements in it.
 */
export function buildStockRegister(
  items: RegisterItem[],
  periodSums: MovementSum[],
  afterSums: MovementSum[],
): StockRegisterRow[] {
  const afterNet = signedNet(afterSums);
  const byItem = new Map<string, Record<string, number>>();
  for (const s of periodSums) {
    const bucket = byItem.get(s.inventoryItemId) ?? {};
    bucket[s.type] = (bucket[s.type] ?? 0) + s.quantity;
    byItem.set(s.inventoryItemId, bucket);
  }
  const periodNet = signedNet(periodSums);

  return items.map((item) => {
    const bucket = byItem.get(item.id) ?? {};
    const closing = item.currentStock - (afterNet.get(item.id) ?? 0);
    const opening = closing - (periodNet.get(item.id) ?? 0);
    return {
      inventoryItemId: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      opening: round3(opening),
      received: round3((bucket.purchase ?? 0) + (bucket.return ?? 0) + (bucket.adjustment ?? 0)),
      sold: round3(bucket.sale ?? 0),
      wasted: round3(bucket.wastage ?? 0),
      transferredOut: round3(bucket.transfer ?? 0),
      closing: round3(closing),
      costPerUnit: item.costPerUnit,
      closingValue: Math.round(closing * item.costPerUnit * 100) / 100,
    };
  });
}
