/** POS quick keys: slot N is bound to F<N> (1-12) and Alt+<N> (1-9). */
export const POS_QUICK_KEY_SLOTS = 12;

export type PosQuickKeyBinding = { slot: number; menuItemId: string };

export function posQuickKeyLabel(slot: number): string {
  return `F${slot}`;
}

/** Quick-key slot for a keydown, or null when the key is not a quick key. */
export function posQuickKeySlot(e: {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}): number | null {
  if (e.ctrlKey || e.metaKey || e.shiftKey) return null;
  const fn = /^F(\d{1,2})$/.exec(e.key);
  if (fn && !e.altKey) {
    const slot = Number(fn[1]);
    return slot >= 1 && slot <= POS_QUICK_KEY_SLOTS ? slot : null;
  }
  if (e.altKey && /^[1-9]$/.test(e.key)) return Number(e.key);
  return null;
}

/** Item whose POS short code exactly matches the typed text (case-insensitive). */
export function findItemByShortCode<T extends { shortCode?: string | null }>(
  items: readonly T[],
  typed: string,
): T | undefined {
  const code = typed.trim().toUpperCase();
  if (!code) return undefined;
  return items.find((i) => i.shortCode?.toUpperCase() === code);
}

/** Search match on item name or short-code prefix. */
export function matchesPosSearch(
  item: { name: string; shortCode?: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.name.toLowerCase().includes(q) || Boolean(item.shortCode?.toLowerCase().startsWith(q));
}
