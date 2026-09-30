import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { OrdersService } from "./orders.service";

type CouponRow = {
  id: string;
  type: string;
  value: number;
  minOrder: number | null;
  maxUses: number | null;
  usedCount: number;
  startsAt: Date | null;
  expiresAt: Date | null;
};

function setup(opts: { coupon?: Partial<CouponRow>; appliedCouponIds?: string[] } = {}) {
  const coupon: CouponRow = {
    id: "cp_1",
    type: "flat",
    value: 50,
    minOrder: null,
    maxUses: null,
    usedCount: 0,
    startsAt: null,
    expiresAt: null,
    ...opts.coupon,
  };
  const order = {
    id: "ord_1",
    organizationId: "org_1",
    outletId: "o1",
    status: "confirmed",
    subtotal: 400,
    taxTotal: 20,
    tipAmount: 0,
    discountTotal: 0,
    notes: null,
    metadata: {},
    customerId: null,
    discounts: (opts.appliedCouponIds ?? []).map((couponId) => ({ couponId })),
  };
  const tx = {
    $queryRaw: vi.fn(async () => []),
    order: {
      findFirst: vi.fn(async (args: { where: { organizationId: string } }) => {
        expect(args.where.organizationId).toBe("org_1");
        return order;
      }),
      update: vi.fn(async () => ({ ...order, items: [], taxLines: [], discounts: [] })),
    },
    coupon: {
      findFirst: vi.fn(async () => coupon),
      updateMany: vi.fn(async ({ where }: { where: { usedCount?: { lt: number } } }) => {
        if (where.usedCount && coupon.usedCount >= where.usedCount.lt) return { count: 0 };
        coupon.usedCount += 1;
        return { count: 1 };
      }),
    },
    couponUsage: { create: vi.fn(async () => ({})) },
    orderDiscount: { create: vi.fn(async () => ({})) },
  };
  const prisma = { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  const ws = { emitToOutlet: vi.fn() };
  const service = new OrdersService(prisma as never, ws as never);
  return { service, tx, coupon };
}

describe("OrdersService.applyDiscount coupons", () => {
  it("locks the order and consumes one coupon use", async () => {
    const { service, tx, coupon } = setup({ coupon: { maxUses: 5, usedCount: 1 } });
    await service.applyDiscount("org_1", "ord_1", { couponCode: "save50" });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(coupon.usedCount).toBe(2);
    expect(tx.orderDiscount.create).toHaveBeenCalledOnce();
  });

  it("rejects when the last use was taken concurrently", async () => {
    const { service, tx } = setup({ coupon: { maxUses: 3, usedCount: 3 } });
    await expect(service.applyDiscount("org_1", "ord_1", { couponCode: "save50" })).rejects.toThrow(
      "Coupon usage limit reached",
    );
    expect(tx.orderDiscount.create).not.toHaveBeenCalled();
  });

  it("rejects applying the same coupon twice to one order", async () => {
    const { service, tx } = setup({ appliedCouponIds: ["cp_1"] });
    await expect(service.applyDiscount("org_1", "ord_1", { couponCode: "save50" })).rejects.toThrow(
      "Coupon already applied to this order",
    );
    expect(tx.coupon.updateMany).not.toHaveBeenCalled();
  });

  it("rejects coupons before their start date", async () => {
    const { service } = setup({ coupon: { startsAt: new Date(Date.now() + 86_400_000) } });
    await expect(service.applyDiscount("org_1", "ord_1", { couponCode: "save50" })).rejects.toThrow(
      BadRequestException,
    );
  });
});
