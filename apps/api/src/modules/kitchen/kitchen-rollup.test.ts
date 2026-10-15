import { describe, expect, it } from "vitest";
import { rollUpKotStatus, rollUpOrderStatus } from "./kitchen.service";

describe("rollUpKotStatus", () => {
  it("follows the slowest live item", () => {
    expect(rollUpKotStatus(["pending", "preparing"])).toBe("pending");
    expect(rollUpKotStatus(["preparing", "ready"])).toBe("preparing");
    expect(rollUpKotStatus(["ready", "served", "cancelled"])).toBe("ready");
    expect(rollUpKotStatus(["served", "cancelled"])).toBe("served");
    expect(rollUpKotStatus(["cancelled"])).toBe("cancelled");
  });
});

describe("rollUpOrderStatus", () => {
  it("ignores cancelled lines and starts preparing once any item moves", () => {
    expect(rollUpOrderStatus(["pending", "pending"])).toBeNull();
    expect(rollUpOrderStatus(["pending", "preparing"])).toBe("preparing");
    expect(rollUpOrderStatus(["ready", "served", "cancelled"])).toBe("ready");
    expect(rollUpOrderStatus(["served", "cancelled"])).toBe("served");
    expect(rollUpOrderStatus(["cancelled"])).toBeNull();
  });
});
