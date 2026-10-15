import { describe, expect, it } from "vitest";
import {
  outletOpsSettings,
  parseKdsServedCompletesOrder,
  parsePosQuickKeys,
  parseQrSessionTimeoutMinutes,
  parseTablesEnabled,
  qrSessionExpiryAction,
} from "./outlet-ops-settings.util";

describe("outletOpsSettings", () => {
  it("defaults to 60 min expiry, complete-on-serve always, no quick keys", () => {
    expect(outletOpsSettings(null)).toEqual({
      qrSessionTimeoutMinutes: 60,
      kdsServedCompletesOrder: "always",
      posQuickKeys: [],
      tablesEnabled: null,
    });
  });

  it("reads stored values and ignores bad ones", () => {
    expect(
      outletOpsSettings({
        qrSessionTimeoutMinutes: 0,
        kdsServedCompletesOrder: "paid_only",
        posQuickKeys: [{ slot: 2, menuItemId: "b" }, { slot: 1, menuItemId: "a" }],
        tablesEnabled: false,
      }),
    ).toEqual({
      qrSessionTimeoutMinutes: 0,
      kdsServedCompletesOrder: "paid_only",
      posQuickKeys: [{ slot: 1, menuItemId: "a" }, { slot: 2, menuItemId: "b" }],
      tablesEnabled: false,
    });
    expect(
      outletOpsSettings({
        qrSessionTimeoutMinutes: -5,
        kdsServedCompletesOrder: "x",
        posQuickKeys: "x",
        tablesEnabled: "yes",
      }),
    ).toEqual({
      qrSessionTimeoutMinutes: 60,
      kdsServedCompletesOrder: "always",
      posQuickKeys: [],
      tablesEnabled: null,
    });
  });
});

describe("setting parsers", () => {
  it("validates timeout and kds mode", () => {
    expect(parseQrSessionTimeoutMinutes("90")).toBe(90);
    expect(() => parseQrSessionTimeoutMinutes(2000)).toThrow();
    expect(() => parseQrSessionTimeoutMinutes(1.5)).toThrow();
    expect(parseKdsServedCompletesOrder("off")).toBe("off");
    expect(() => parseKdsServedCompletesOrder("sometimes")).toThrow();
  });

  it("accepts only booleans or null for tablesEnabled", () => {
    expect(parseTablesEnabled(true)).toBe(true);
    expect(parseTablesEnabled(false)).toBe(false);
    expect(parseTablesEnabled(null)).toBeNull();
    expect(() => parseTablesEnabled("false")).toThrow();
    expect(() => parseTablesEnabled(0)).toThrow();
  });

  it("rejects out-of-range or duplicate quick key slots", () => {
    expect(() => parsePosQuickKeys([{ slot: 13, menuItemId: "a" }])).toThrow();
    expect(() =>
      parsePosQuickKeys([
        { slot: 1, menuItemId: "a" },
        { slot: 1, menuItemId: "b" },
      ]),
    ).toThrow();
    expect(() => parsePosQuickKeys([{ slot: 1, menuItemId: "" }])).toThrow();
  });
});

describe("qrSessionExpiryAction", () => {
  it("closes empty sessions and cancels guest drafts", () => {
    expect(qrSessionExpiryAction([], false)).toBe("close");
    expect(qrSessionExpiryAction([{ status: "draft", source: "customer" }], false)).toBe(
      "cancel_drafts",
    );
  });

  it("only alerts once when the kitchen or staff own an order", () => {
    const kitchen = [{ status: "preparing", source: "customer" }];
    expect(qrSessionExpiryAction(kitchen, false)).toBe("alert");
    expect(qrSessionExpiryAction(kitchen, true)).toBe("none");
    expect(qrSessionExpiryAction([{ status: "draft", source: "pos" }], false)).toBe("alert");
  });
});
