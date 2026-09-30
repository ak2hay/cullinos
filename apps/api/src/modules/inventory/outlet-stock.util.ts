export type OutletStockItem = {
  id: string;
  outletId: string | null;
  name: string;
  sku: string | null;
  unit: string;
  catalogKey: string | null;
  currentStock: number;
  reorderLevel: number;
};

export type OutletStockCell = { itemId: string; stock: number; reorderLevel: number; low: boolean };

export type OutletStockRow = {
  key: string;
  name: string;
  sku: string | null;
  unit: string;
  /** Org-wide row (no outlet) — used by any outlet without its own copy. */
  shared: OutletStockCell | null;
  byOutlet: Record<string, OutletStockCell>;
  total: number;
};

/** Same identity rule transfers and recipe deduction use to match outlet copies. */
export function outletStockKey(item: Pick<OutletStockItem, "catalogKey" | "name" | "sku" | "unit">) {
  if (item.catalogKey) return `ck:${item.catalogKey}`;
  return `n:${item.name.trim().toLowerCase()}|${(item.sku ?? "").trim().toLowerCase()}|${item.unit}`;
}

/** One row per ingredient, one cell per outlet copy, for the all-outlets comparison view. */
export function buildOutletStockMatrix(items: OutletStockItem[]): OutletStockRow[] {
  const rows = new Map<string, OutletStockRow>();
  for (const item of items) {
    const key = outletStockKey(item);
    let row = rows.get(key);
    if (!row) {
      row = { key, name: item.name, sku: item.sku, unit: item.unit, shared: null, byOutlet: {}, total: 0 };
      rows.set(key, row);
    }
    const cell: OutletStockCell = {
      itemId: item.id,
      stock: item.currentStock,
      reorderLevel: item.reorderLevel,
      low: item.currentStock <= item.reorderLevel,
    };
    if (item.outletId) {
      const existing = row.byOutlet[item.outletId];
      row.byOutlet[item.outletId] = existing
        ? { ...existing, stock: existing.stock + cell.stock, low: existing.stock + cell.stock <= existing.reorderLevel }
        : cell;
    } else if (row.shared) {
      const stock = row.shared.stock + cell.stock;
      row.shared = { ...row.shared, stock, low: stock <= row.shared.reorderLevel };
    } else {
      row.shared = cell;
    }
    row.total += item.currentStock;
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}
