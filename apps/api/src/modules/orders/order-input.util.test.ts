import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import {
  assertCanSetOrderStatus,
  pickPublicOrderFields,
  sanitizeStaffOrderBody,
  stripReservedOrderMetadata,
} from "./order-input.util";

describe("pickPublicOrderFields", () => {
  it("drops server-owned fields a guest could abuse", () => {
    const picked = pickPublicOrderFields({
      type: "takeaway",
      items: [{ menuItemId: "m1", quantity: 1 }],
      tableId: "t_other_tenant",
      tableSessionId: "s1",
      customerId: "c1",
      metadata: { deliveryFee: -500, stockDeductedAt: "2026-01-01" },
      deliveryFee: -500,
      autoConfirm: false,
      organizationId: "org_evil",
    }) as Record<string, unknown>;

    for (const key of [
      "tableId",
      "tableSessionId",
      "customerId",
      "metadata",
      "deliveryFee",
      "autoConfirm",
      "organizationId",
    ]) {
      expect(picked).not.toHaveProperty(key);
    }
    expect(picked.items).toEqual([{ menuItemId: "m1", quantity: 1 }]);
  });

  it("restricts source to guest channels", () => {
    expect(pickPublicOrderFields({ source: "QR" }).source).toBe("QR");
    expect(pickPublicOrderFields({ source: "online" }).source).toBe("ONLINE");
    expect(pickPublicOrderFields({ source: "POS" }).source).toBe("ONLINE");
    expect(pickPublicOrderFields({ source: "SWIGGY" }).source).toBe("ONLINE");
  });

  it("ignores non-numeric tips and treats ageConfirmed strictly", () => {
    const picked = pickPublicOrderFields({ tipAmount: "100", ageConfirmed: "true" });
    expect(picked.tipAmount).toBeUndefined();
    expect(picked.ageConfirmed).toBe(false);
  });
});

describe("stripReservedOrderMetadata / sanitizeStaffOrderBody", () => {
  it("removes keys the server trusts for totals, stock and settlements", () => {
    expect(
      stripReservedOrderMetadata({
        deliveryFee: -500,
        stockDeductedAt: "x",
        stockDeductedItemIds: [],
        aggregator: { provider: "swiggy" },
        alcoholAgeConfirmed: true,
        channelNote: "window seat",
      }),
    ).toEqual({ channelNote: "window seat" });
    expect(stripReservedOrderMetadata({ deliveryFee: 1 })).toBeUndefined();
    expect(stripReservedOrderMetadata("nope")).toBeUndefined();
  });

  it("keeps staff fields but strips flags and reserved metadata", () => {
    const dto = sanitizeStaffOrderBody({
      outletId: "o1",
      tableId: "t1",
      publicOrder: true,
      customerOrder: true,
      organizationId: "org_evil",
      deliveryFee: 10,
      metadata: { stockDeductedAt: "x" },
    });
    expect(dto).toMatchObject({ outletId: "o1", tableId: "t1" });
    expect(dto).not.toHaveProperty("publicOrder");
    expect(dto).not.toHaveProperty("customerOrder");
    expect(dto).not.toHaveProperty("organizationId");
    expect(dto).not.toHaveProperty("deliveryFee");
    expect(dto.metadata).toBeUndefined();
  });
});

describe("assertCanSetOrderStatus", () => {
  const kitchen = { permissions: ["kitchen:update", "order:read"] };
  const manager = { permissions: ["order:update", "order:cancel"] };

  it("lets any staff move orders through normal states", () => {
    expect(() => assertCanSetOrderStatus(kitchen, "ready")).not.toThrow();
    expect(() => assertCanSetOrderStatus(kitchen, "preparing")).not.toThrow();
  });

  it("requires order:cancel to cancel or void via the status route", () => {
    expect(() => assertCanSetOrderStatus(kitchen, "cancelled")).toThrow(ForbiddenException);
    expect(() => assertCanSetOrderStatus(kitchen, "voided")).toThrow(ForbiddenException);
    expect(() => assertCanSetOrderStatus(undefined, "voided")).toThrow(ForbiddenException);
    expect(() => assertCanSetOrderStatus(manager, "cancelled")).not.toThrow();
  });
});
