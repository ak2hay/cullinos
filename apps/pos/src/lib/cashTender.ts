/** Indian notes the cashier can tap as "cash received". */
export const CASH_NOTES = [100, 200, 500, 2000] as const;

/**
 * Exact amount, then the next larger notes (at most four chips).
 * Amounts are rupees.
 */
export function tenderChips(dueRupees: number): number[] {
  const due = Math.max(0, Math.round((Number.isFinite(dueRupees) ? dueRupees : 0) * 100) / 100);
  const chips = [due];
  for (const note of CASH_NOTES) {
    if (note > due + 0.001) chips.push(note);
    if (chips.length >= 4) break;
  }
  return chips;
}

/** Change to hand back. Never negative. */
export function changeDue(tenderRupees: number, dueRupees: number): number {
  const change = tenderRupees - dueRupees;
  if (!Number.isFinite(change) || change <= 0) return 0;
  return Math.round(change * 100) / 100;
}

export function formatRupeeChip(amount: number): string {
  if (!Number.isFinite(amount)) return "0";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

/**
 * Taps and server round-trips for a 3-item cash sale of items that do not
 * need a size or a required modifier, with the shift already open.
 * The "before" path is the previous Pay-full then Cash buttons.
 */
export const THREE_ITEM_CASH_ORDER = {
  before: {
    taps: 5,
    steps: ["item", "item", "item", "pay", "cash"] as const,
    /** quick-order, then payments/cash. The cart stayed until both finished. */
    blockingApiRequests: 2,
  },
  after: {
    taps: 4,
    steps: ["item", "item", "item", "cash"] as const,
    /** One quick-order that also creates the KOT and records cash. Cart clears first. */
    blockingApiRequests: 0,
    backgroundApiRequests: 1,
  },
} as const;
