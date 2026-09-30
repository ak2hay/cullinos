import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { LoyaltyService, capRedemption } from "./loyalty.service";

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order_1",
    organizationId: "org_1",
    customerId: null as string | null,
    status: "confirmed",
    total: 500,
    discountTotal: 0,
    notes: null as string | null,
    ...overrides,
  };
}

function makePrisma(opts: {
  loyaltyPoints: number;
  order?: ReturnType<typeof makeOrder> | null;
  paid?: number;
}) {
  const customer = { id: "cust_1", organizationId: "org_1", loyaltyPoints: opts.loyaltyPoints };
  const tx = {
    customer: {
      findFirst: vi.fn().mockResolvedValue(customer),
      updateMany: vi.fn().mockImplementation(async ({ data }: { data: { loyaltyPoints: { decrement: number } } }) => {
        if (customer.loyaltyPoints < data.loyaltyPoints.decrement) return { count: 0 };
        customer.loyaltyPoints -= data.loyaltyPoints.decrement;
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn().mockImplementation(async () => ({ ...customer })),
    },
    order: {
      findFirst: vi.fn().mockResolvedValue(opts.order ?? null),
      update: vi.fn().mockResolvedValue({}),
    },
    payment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: opts.paid ?? 0 } }),
    },
    orderDiscount: { create: vi.fn().mockResolvedValue({}) },
    loyaltyTransaction: { create: vi.fn().mockResolvedValue({}) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  const prisma = {
    organizationSettings: {
      findUnique: vi.fn().mockResolvedValue({
        settings: { loyaltySettings: { redemptionValue: 1, minRedeem: 10 } },
      }),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma, tx, customer };
}

describe("capRedemption", () => {
  it("keeps the full redemption when it fits the outstanding amount", () => {
    expect(capRedemption(100, 0.25, 50)).toEqual({ pointsUsed: 100, discountAmount: 25 });
  });

  it("caps at the outstanding amount and only uses the points needed", () => {
    expect(capRedemption(1000, 0.25, 30)).toEqual({ pointsUsed: 120, discountAmount: 30 });
  });
});

describe("LoyaltyService.redeemPoints", () => {
  it("rejects when the customer has too few points", async () => {
    const { prisma, tx } = makePrisma({ loyaltyPoints: 50, order: makeOrder() });
    const service = new LoyaltyService(prisma as never);

    await expect(service.redeemPoints("org_1", "cust_1", 100, "order_1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.customer.updateMany).not.toHaveBeenCalled();
    expect(tx.orderDiscount.create).not.toHaveBeenCalled();
  });

  it("records the loyalty discount in discountTotal and lowers the total", async () => {
    const { prisma, tx, customer } = makePrisma({
      loyaltyPoints: 300,
      order: makeOrder({ total: 500, discountTotal: 20 }),
    });
    const service = new LoyaltyService(prisma as never);

    const result = await service.redeemPoints("org_1", "cust_1", 200, "order_1");

    expect(result).toMatchObject({ pointsRedeemed: 200, discountAmount: 200, remainingPoints: 100 });
    expect(customer.loyaltyPoints).toBe(100);
    expect(tx.orderDiscount.create).toHaveBeenCalledWith({
      data: { orderId: "order_1", type: "loyalty", value: 200, amount: 200 },
    });
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1" },
        data: expect.objectContaining({ customerId: "cust_1", discountTotal: 220, total: 300 }),
      }),
    );
  });

  it("caps the discount at what is still owed after payments", async () => {
    const { prisma, tx, customer } = makePrisma({
      loyaltyPoints: 1000,
      order: makeOrder({ total: 500 }),
      paid: 450,
    });
    const service = new LoyaltyService(prisma as never);

    const result = await service.redeemPoints("org_1", "cust_1", 1000, "order_1");

    expect(result).toMatchObject({ pointsRedeemed: 50, discountAmount: 50 });
    expect(customer.loyaltyPoints).toBe(950);
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ total: 450 }) }),
    );
  });

  it("rejects redemption on a closed order", async () => {
    const { prisma, tx } = makePrisma({
      loyaltyPoints: 500,
      order: makeOrder({ status: "completed" }),
    });
    const service = new LoyaltyService(prisma as never);

    await expect(service.redeemPoints("org_1", "cust_1", 100, "order_1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.customer.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an order linked to a different customer", async () => {
    const { prisma, tx } = makePrisma({
      loyaltyPoints: 500,
      order: makeOrder({ customerId: "cust_other" }),
    });
    const service = new LoyaltyService(prisma as never);

    await expect(service.redeemPoints("org_1", "cust_1", 100, "order_1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.customer.updateMany).not.toHaveBeenCalled();
  });

  it("public redeem requires the order to already belong to the customer", async () => {
    const { prisma, tx } = makePrisma({ loyaltyPoints: 500, order: makeOrder({ customerId: null }) });
    const service = new LoyaltyService(prisma as never);

    await expect(
      service.redeemPoints("org_1", "cust_1", 100, "order_1", { requireOwnedOrder: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.customer.updateMany).not.toHaveBeenCalled();
  });

  it("locks the order row before computing the outstanding cap", async () => {
    const { prisma, tx } = makePrisma({ loyaltyPoints: 500, order: makeOrder() });
    const service = new LoyaltyService(prisma as never);

    await service.redeemPoints("org_1", "cust_1", 100, "order_1");
    expect(tx.$queryRaw).toHaveBeenCalled();
  });
});
