import { describe, expect, it } from "vitest";
import {
  applyDiscount,
  bestHappyHourPrice,
  isRuleActiveAt,
  localClock,
  parseHm,
  type HappyHourRuleLike,
} from "./happy-hour.util";

const WEEKDAYS = [1, 2, 3, 4, 5];

function rule(overrides: Partial<HappyHourRuleLike> = {}): HappyHourRuleLike {
  return {
    id: "r1",
    name: "Happy hour",
    outletId: null,
    daysOfWeek: WEEKDAYS,
    startTime: "17:00",
    endTime: "19:00",
    discountType: "percent",
    discountValue: 50,
    categoryIds: [],
    menuItemIds: [],
    ...overrides,
  };
}

describe("parseHm", () => {
  it("parses valid times and rejects malformed ones", () => {
    expect(parseHm("17:30")).toBe(17 * 60 + 30);
    expect(parseHm("24:00")).toBeNull();
    expect(parseHm("5:00")).toBeNull();
  });
});

describe("localClock", () => {
  it("uses the organization timezone", () => {
    // 2026-09-28 12:00 UTC = Monday 17:30 in Asia/Kolkata
    const clock = localClock(new Date("2026-09-28T12:00:00Z"), "Asia/Kolkata");
    expect(clock).toEqual({ day: 1, minutes: 17 * 60 + 30 });
  });
});

describe("isRuleActiveAt", () => {
  it("matches inside a same-day window only on listed days", () => {
    expect(isRuleActiveAt(rule(), { day: 1, minutes: 17 * 60 })).toBe(true);
    expect(isRuleActiveAt(rule(), { day: 1, minutes: 19 * 60 })).toBe(false);
    expect(isRuleActiveAt(rule(), { day: 0, minutes: 18 * 60 })).toBe(false);
  });

  it("handles windows that run past midnight", () => {
    const late = rule({ startTime: "22:00", endTime: "01:00", daysOfWeek: [5] });
    expect(isRuleActiveAt(late, { day: 5, minutes: 23 * 60 })).toBe(true);
    // Saturday 00:30 belongs to Friday's window
    expect(isRuleActiveAt(late, { day: 6, minutes: 30 })).toBe(true);
    expect(isRuleActiveAt(late, { day: 6, minutes: 23 * 60 })).toBe(false);
  });

  it("treats equal start and end as invalid", () => {
    expect(isRuleActiveAt(rule({ startTime: "10:00", endTime: "10:00" }), { day: 1, minutes: 600 })).toBe(
      false,
    );
  });
});

describe("applyDiscount", () => {
  it("applies percent and flat discounts without going below zero", () => {
    expect(applyDiscount(300, { discountType: "percent", discountValue: 50 })).toBe(150);
    expect(applyDiscount(300, { discountType: "amount", discountValue: 75 })).toBe(225);
    expect(applyDiscount(50, { discountType: "amount", discountValue: 75 })).toBe(0);
    expect(applyDiscount(99.99, { discountType: "percent", discountValue: 33 })).toBe(66.99);
  });
});

describe("bestHappyHourPrice", () => {
  const item = { menuItemId: "beer", categoryId: "cat-beer" };

  it("returns null when no rule matches the item", () => {
    expect(bestHappyHourPrice(300, item, [rule({ categoryIds: ["cat-food"] })])).toBeNull();
  });

  it("picks the rule with the lowest resulting price", () => {
    const best = bestHappyHourPrice(300, item, [
      rule({ id: "a", discountValue: 20, categoryIds: ["cat-beer"] }),
      rule({ id: "b", discountType: "amount", discountValue: 100, menuItemIds: ["beer"] }),
    ]);
    expect(best).toEqual({ price: 200, rule: expect.objectContaining({ id: "b" }) });
  });
});
