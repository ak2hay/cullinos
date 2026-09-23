import { describe, expect, it } from "vitest";
import { smsChargePaise } from "./wallet.service";

describe("smsChargePaise", () => {
  it("charges pro-rata (37 SMS = 37% of per-100 pack)", () => {
    expect(smsChargePaise(37, 10_000)).toBe(3700);
  });

  it("rounds half up via Math.round", () => {
    expect(smsChargePaise(1, 100)).toBe(1);
    expect(smsChargePaise(0, 10_000)).toBe(0);
  });
});
