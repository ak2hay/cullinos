function trimNumber(value: number, digits = 2): string {
  return String(Math.round(value * 10 ** digits) / 10 ** digits);
}

export function hasPack<T extends { packSize?: number | null }>(
  item: T,
): item is T & { packSize: number } {
  return typeof item.packSize === 'number' && item.packSize > 0;
}

/**
 * Pieces: "3 packets + 20 pcs" for 170 pcs at 50/packet. Weight/volume: "≈ 3.4 buckets".
 * Null when no pack is configured.
 */
export function formatPackStock(item: {
  currentStock: number;
  unit?: string;
  packLabel?: string | null;
  packSize?: number | null;
}): string | null {
  if (!hasPack(item)) return null;
  const label = item.packLabel || 'pack';
  const plural = (n: number) => `${label}${n === 1 ? '' : 's'}`;
  const isPieces = item.unit === 'pieces' || item.unit === 'pcs';
  if (isPieces && Number.isInteger(item.packSize) && item.currentStock >= 0) {
    const whole = Math.floor(item.currentStock / item.packSize);
    const loose = Math.round((item.currentStock - whole * item.packSize) * 1000) / 1000;
    if (whole === 0) return `${loose} pcs`;
    return loose ? `${whole} ${plural(whole)} + ${loose} pcs` : `${whole} ${plural(whole)}`;
  }
  const packs = item.currentStock / item.packSize;
  return `≈ ${trimNumber(packs, 1)} ${plural(packs)}`;
}

/** "1 packet = 50 pieces" */
export function formatPackDefinition(item: {
  unit: string;
  packLabel?: string | null;
  packSize?: number | null;
}): string | null {
  if (!hasPack(item)) return null;
  return `1 ${item.packLabel || 'pack'} = ${trimNumber(item.packSize, 3)} ${item.unit}`;
}

/** Purchase line in base units from a pack count and price per pack (price kept to paise). */
export function packPurchaseLine(
  item: { packSize?: number | null },
  packs: number,
  pricePerPack: number,
): { quantity: number; unitPrice: number } | null {
  if (!hasPack(item) || !(packs > 0) || !(pricePerPack >= 0)) return null;
  return {
    quantity: Math.round(packs * item.packSize * 1000) / 1000,
    unitPrice: Math.round((pricePerPack / item.packSize) * 100) / 100,
  };
}

/** "1 packet = 8.3 serves" given how much one serve consumes. */
export function formatServesPerPack(
  item: { packLabel?: string | null; packSize?: number | null },
  perServe: number,
): string | null {
  if (!hasPack(item) || !(perServe > 0)) return null;
  return `1 ${item.packLabel || 'pack'} ≈ ${trimNumber(item.packSize / perServe, 1)} serves`;
}
