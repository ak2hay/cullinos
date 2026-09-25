import { describe, expect, it } from "vitest";
import { normalizeStaffPhone, staffPhoneLookupVariants } from "./phone.util";

describe("phone.util", () => {
  it("normalizes Indian mobiles", () => {
    expect(normalizeStaffPhone("+91 76660 71619")).toBe("917666071619");
    expect(normalizeStaffPhone("7666071619")).toBe("917666071619");
    expect(normalizeStaffPhone("917666071619")).toBe("917666071619");
  });

  it("builds lookup variants", () => {
    const v = staffPhoneLookupVariants("917666071619");
    expect(v).toContain("917666071619");
    expect(v).toContain("+917666071619");
    expect(v).toContain("7666071619");
  });
});
