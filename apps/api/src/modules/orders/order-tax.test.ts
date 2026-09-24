import { describe, expect, it } from "vitest";
import { calculateMixedGst } from "@cullinos/tax-engine";
import { orderGrandTotal, orderLineTotal, pickDefaultTaxGroup } from "./order-tax.util";
import { normalizeOrderStatusFilter } from "../../common/status.util";

const GST5 = [
  { name: "CGST", rate: 2.5, type: "CGST" },
  { name: "SGST", rate: 2.5, type: "SGST" },
];
const GST18 = [
  { name: "CGST", rate: 9, type: "CGST" },
  { name: "SGST", rate: 9, type: "SGST" },
];

describe("order tax wiring", () => {
  it("applies configured rates instead of hard-coded 5%", () => {
    const result = calculateMixedGst([
      { amountPaise: 20000, rates: GST5 },
      { amountPaise: 10000, rates: GST18 },
    ]);

    expect(result.subtotal).toBe(300);
    expect(result.taxTotal).toBe(28);
    expect(result.total).toBe(328);
    expect(result.itemTaxes).toEqual([10, 18]);
  });

  it("reconciles line totals + tax lines with the grand total (exclusive)", () => {
    const result = calculateMixedGst([
      { amountPaise: 14000, rates: GST5 },
      { amountPaise: 32000, rates: GST5 },
    ]);
    const lineSum = [140, 320].reduce(
      (s, gross, i) => s + orderLineTotal(gross, result.itemTaxes[i], false),
      0,
    );
    const taxLineSum = result.taxLines.reduce((s, t) => s + Math.round(t.amount * 100), 0) / 100;
    const total = orderGrandTotal({ subtotal: result.subtotal, taxTotal: result.taxTotal });
    expect(result.subtotal).toBe(460);
    expect(taxLineSum).toBe(result.taxTotal);
    expect(Math.abs(lineSum - total)).toBeLessThan(0.01);
    expect(Math.abs(result.subtotal + taxLineSum - total)).toBeLessThan(0.01);
  });

  it("does not double-count tax for inclusive prices", () => {
    const result = calculateMixedGst([{ amountPaise: 10500, rates: GST5, isInclusive: true }]);
    expect(result.total).toBe(105);
    expect(orderLineTotal(105, result.itemTaxes[0], true)).toBe(105);
    expect(result.subtotal + result.taxTotal).toBeCloseTo(105, 2);
  });

  it("leaves items untaxed when there are no rates", () => {
    const result = calculateMixedGst([{ amountPaise: 46000, rates: [] }]);
    expect(result.taxTotal).toBe(0);
    expect(result.total).toBe(460);
    expect(result.taxLines).toEqual([]);
  });
});

describe("pickDefaultTaxGroup", () => {
  const groups = [{ id: "catering" }, { id: "restaurant" }];

  it("uses the configured default", () => {
    expect(pickDefaultTaxGroup(groups, "restaurant")?.id).toBe("restaurant");
  });

  it("never guesses between several groups", () => {
    expect(pickDefaultTaxGroup(groups, null)).toBeNull();
  });

  it("falls back to the only group when unambiguous", () => {
    expect(pickDefaultTaxGroup([{ id: "only" }], undefined)?.id).toBe("only");
  });

  it("ignores a configured id from another org", () => {
    expect(pickDefaultTaxGroup(groups, "foreign")).toBeNull();
  });
});

describe("orderGrandTotal", () => {
  it("adds tip and delivery and subtracts discount in paise", () => {
    expect(
      orderGrandTotal({
        subtotal: 460,
        taxTotal: 23,
        tipAmount: 10.1,
        deliveryFee: 30,
        discountTotal: 20.2,
      }),
    ).toBe(502.9);
  });

  it("never goes negative", () => {
    expect(orderGrandTotal({ subtotal: 10, taxTotal: 0, discountTotal: 50 })).toBe(0);
  });
});

describe("normalizeOrderStatusFilter", () => {
  it("accepts API casing and aliases", () => {
    expect(normalizeOrderStatusFilter("COMPLETED")).toBe("completed");
    expect(normalizeOrderStatusFilter("HELD")).toBe("draft");
  });

  it("rejects unknown statuses with 400", () => {
    expect(() => normalizeOrderStatusFilter("REFUNDED")).toThrow(/Invalid order status/);
  });
});
