import { describe, expect, it } from "vitest";

/** Pure helpers mirrored from OrdersService recalculation for unit coverage. */
function recalcOrderTotal(
  subtotal: number,
  taxTotal: number,
  tipAmount: number,
  discountTotal: number,
  deliveryFee = 0,
) {
  return Math.max(
    0,
    Math.round((subtotal + taxTotal + tipAmount + deliveryFee - discountTotal) * 100) / 100,
  );
}

function remainingUnpaid(total: number, paidSum: number) {
  return Math.max(0, Math.round((total - paidSum) * 100) / 100);
}

describe("Phase 1 POS billing helpers", () => {
  it("applies discount against subtotal+tax+tip", () => {
    expect(recalcOrderTotal(100, 5, 10, 20)).toBe(95);
  });

  it("clamps total at zero when discount exceeds bill", () => {
    expect(recalcOrderTotal(50, 5, 0, 100)).toBe(0);
  });

  it("computes remaining unpaid for multi-tender", () => {
    expect(remainingUnpaid(200, 50)).toBe(150);
    expect(remainingUnpaid(200, 200)).toBe(0);
    expect(remainingUnpaid(200, 250)).toBe(0);
  });
});
