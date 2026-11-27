export type BulkPriceMode = 'set' | 'add' | 'percent';

/**
 * Apply a bulk price edit. Stored prices are paise.
 * `amount` is rupees for set/add, or a percent for percent (10 means +10%).
 */
export function applyBulkPrice(basePaise: number, mode: BulkPriceMode, amount: number): number {
  const base = Number.isFinite(basePaise) ? basePaise : 0;
  if (!Number.isFinite(amount)) return Math.max(0, Math.round(base));
  if (mode === 'set') return Math.max(0, Math.round(amount * 100));
  if (mode === 'add') return Math.max(0, Math.round(base + amount * 100));
  return Math.max(0, Math.round(base * (1 + amount / 100)));
}
