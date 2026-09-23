import { describe, expect, it } from "vitest";
import { calculateMixedGst } from "@cullinos/tax-engine";

describe("order tax wiring", () => {
  it("applies configured rates instead of hard-coded 5%", () => {
    const result = calculateMixedGst([
      {
        amountPaise: 20000,
        rates: [
          { name: "CGST", rate: 2.5, type: "CGST" },
          { name: "SGST", rate: 2.5, type: "SGST" },
        ],
      },
      {
        amountPaise: 10000,
        rates: [
          { name: "CGST", rate: 9, type: "CGST" },
          { name: "SGST", rate: 9, type: "SGST" },
        ],
      },
    ]);

    expect(result.subtotal).toBe(300);
    expect(result.taxTotal).toBe(28);
    expect(result.total).toBe(328);
    expect(result.itemTaxes).toEqual([10, 18]);
  });
});
