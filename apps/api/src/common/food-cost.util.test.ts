import { describe, expect, it } from "vitest";
import { foodCostPct, ingredientCostForSales } from "./food-cost.util";

describe("food-cost math", () => {
  it("scales ingredient cost by sold qty / yield", () => {
    // 2kg @ ₹50 for yield 1 → cost 100 per serving; 3 sold → 300
    expect(
      ingredientCostForSales([{ quantity: 2, unitCost: 50 }], 1, 3),
    ).toBe(300);
    // yield 2: half cost per serving
    expect(
      ingredientCostForSales([{ quantity: 2, unitCost: 50 }], 2, 2),
    ).toBe(100);
  });

  it("computes food cost percentage", () => {
    expect(foodCostPct(30, 100)).toBe(30);
    expect(foodCostPct(0, 0)).toBe(0);
  });
});
