import { describe, expect, it } from "vitest";
import { buildOutletStockMatrix, type OutletStockItem } from "./outlet-stock.util";

const item = (over: Partial<OutletStockItem>): OutletStockItem => ({
  id: "i",
  outletId: null,
  name: "Paneer",
  sku: null,
  unit: "kg",
  catalogKey: null,
  currentStock: 0,
  reorderLevel: 0,
  ...over,
});

describe("buildOutletStockMatrix", () => {
  it("groups outlet copies of the same ingredient into one row", () => {
    const rows = buildOutletStockMatrix([
      item({ id: "a", outletId: "o1", currentStock: 5, reorderLevel: 2 }),
      item({ id: "b", outletId: "o2", name: " paneer ", currentStock: 1, reorderLevel: 2 }),
      item({ id: "c", name: "Rice", currentStock: 10 }),
    ]);
    expect(rows).toHaveLength(2);
    const paneer = rows.find((r) => r.name === "Paneer")!;
    expect(paneer.total).toBe(6);
    expect(paneer.byOutlet.o1).toMatchObject({ itemId: "a", stock: 5, low: false });
    expect(paneer.byOutlet.o2).toMatchObject({ itemId: "b", stock: 1, low: true });
    expect(rows.find((r) => r.name === "Rice")!.shared).toMatchObject({ itemId: "c", stock: 10 });
  });

  it("matches by catalog key before name", () => {
    const rows = buildOutletStockMatrix([
      item({ id: "a", outletId: "o1", name: "Coke 300ml", catalogKey: "coke-300", unit: "bottles" }),
      item({ id: "b", outletId: "o2", name: "Coca-Cola", catalogKey: "coke-300", unit: "bottles" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0].byOutlet)).toEqual(["o1", "o2"]);
  });

  it("keeps different units apart", () => {
    const rows = buildOutletStockMatrix([
      item({ id: "a", outletId: "o1", unit: "kg" }),
      item({ id: "b", outletId: "o2", unit: "g" }),
    ]);
    expect(rows).toHaveLength(2);
  });
});
