import { describe, expect, it } from "vitest";
import { buildStockRegister, type RegisterItem } from "./stock-register.util";

const whisky: RegisterItem = {
  id: "whisky",
  name: "Whisky 750ml",
  sku: "WH750",
  unit: "mL",
  currentStock: 4500,
  costPerUnit: 2,
};

describe("buildStockRegister", () => {
  it("returns flat opening/closing when nothing moved", () => {
    const [row] = buildStockRegister([whisky], [], []);
    expect(row).toMatchObject({ opening: 4500, closing: 4500, received: 0, sold: 0 });
    expect(row.closingValue).toBe(9000);
  });

  it("rebuilds opening and closing from period and later movements", () => {
    const [row] = buildStockRegister(
      [whisky],
      [
        { inventoryItemId: "whisky", type: "purchase", quantity: 7500 },
        { inventoryItemId: "whisky", type: "sale", quantity: 2400 },
        { inventoryItemId: "whisky", type: "wastage", quantity: 60 },
        { inventoryItemId: "whisky", type: "transfer", quantity: 750 },
      ],
      [{ inventoryItemId: "whisky", type: "sale", quantity: 300 }],
    );
    // closing = 4500 + 300 (sold after period) = 4800
    // opening = 4800 − (7500 − 2400 − 60 − 750) = 510
    expect(row).toMatchObject({
      opening: 510,
      received: 7500,
      sold: 2400,
      wasted: 60,
      transferredOut: 750,
      closing: 4800,
    });
    expect(row.opening + row.received - row.sold - row.wasted - row.transferredOut).toBe(row.closing);
  });

  it("ignores movements of other items", () => {
    const [row] = buildStockRegister(
      [whisky],
      [{ inventoryItemId: "rum", type: "sale", quantity: 90 }],
      [],
    );
    expect(row.sold).toBe(0);
    expect(row.opening).toBe(4500);
  });
});
