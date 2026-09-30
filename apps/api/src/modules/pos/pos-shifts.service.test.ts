import { describe, expect, it } from "vitest";
import { expectedDrawerCash } from "./pos-shifts.service";

describe("expectedDrawerCash", () => {
  it("counts the opening float once", () => {
    expect(
      expectedDrawerCash(500, [
        { type: "cash_in", amount: 500, reason: "Opening float" },
        { type: "sale", amount: 250 },
      ]),
    ).toBe(750);
  });

  it("adds sales and manual cash-ins, subtracts payouts and drops", () => {
    expect(
      expectedDrawerCash(1000, [
        { type: "sale", amount: 300 },
        { type: "cash_in", amount: 100, reason: "Change top-up" },
        { type: "cash_out", amount: 50 },
        { type: "drop", amount: 200 },
      ]),
    ).toBe(1150);
  });
});
