/**
 * Items without a tax group use the org's configured default group. When no default is
 * configured we only fall back if the org has exactly one group (unambiguous); otherwise
 * the item is untaxed — never guess between several GST schedules.
 */
export function pickDefaultTaxGroup<T extends { id: string }>(
  groups: T[],
  configuredId?: string | null,
): T | null {
  if (configuredId) return groups.find((g) => g.id === configuredId) ?? null;
  return groups.length === 1 ? groups[0] : null;
}

/** Line total in rupees: inclusive prices already contain the tax. */
export function orderLineTotal(grossRupees: number, taxRupees: number, isInclusive: boolean): number {
  const paise = Math.round(grossRupees * 100) + (isInclusive ? 0 : Math.round(taxRupees * 100));
  return paise / 100;
}

export function orderGrandTotal(input: {
  subtotal: number;
  taxTotal: number;
  tipAmount?: number;
  deliveryFee?: number;
  discountTotal?: number;
}): number {
  const paise =
    Math.round(input.subtotal * 100) +
    Math.round(input.taxTotal * 100) +
    Math.round((input.tipAmount ?? 0) * 100) +
    Math.round((input.deliveryFee ?? 0) * 100) -
    Math.round((input.discountTotal ?? 0) * 100);
  return Math.max(0, paise) / 100;
}
