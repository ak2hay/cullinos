import { describe, expect, it, vi } from "vitest";
import { PaymentsService } from "../payments/payments.service";
import { LoyaltyService } from "./loyalty.service";

function makeLoyaltyPrisma(opts: {
  order: Record<string, unknown> | null;
  paid: number;
  existingEarn?: boolean;
}) {
  const customer = { id: "cust_1", organizationId: "org_1", loyaltyPoints: 0, stampCount: 0 };
  const tx = {
    loyaltyTransaction: { create: vi.fn().mockResolvedValue({ id: "earn_order_1" }) },
    customer: {
      update: vi.fn().mockImplementation(async ({ data }: { data: { loyaltyPoints: { increment: number } } }) => {
        customer.loyaltyPoints += data.loyaltyPoints.increment;
        return { ...customer };
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUniqueOrThrow: vi.fn().mockImplementation(async () => ({ ...customer })),
    },
  };
  const prisma = {
    order: { findFirst: vi.fn().mockResolvedValue(opts.order) },
    payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: opts.paid } }) },
    loyaltyTransaction: {
      findFirst: vi.fn().mockResolvedValue(opts.existingEarn ? { id: "earn_order_1" } : null),
    },
    customer: { findFirst: vi.fn().mockResolvedValue(customer) },
    organizationSettings: {
      findUnique: vi.fn().mockResolvedValue({
        settings: { loyaltySettings: { pointsPerCurrency: 1, stampCardEnabled: false } },
      }),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma, tx, customer };
}

const order = (overrides: Record<string, unknown> = {}) => ({
  id: "order_1",
  organizationId: "org_1",
  customerId: "cust_1",
  status: "confirmed",
  total: 250,
  ...overrides,
});

describe("LoyaltyService.earnIfOrderSettled", () => {
  it("credits points once the order is fully paid", async () => {
    const { prisma, customer } = makeLoyaltyPrisma({ order: order(), paid: 250 });
    const service = new LoyaltyService(prisma as never);

    await service.earnIfOrderSettled("order_1", { organizationId: "org_1" });

    expect(customer.loyaltyPoints).toBe(250);
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order_1", organizationId: "org_1" } }),
    );
  });

  it("does not credit a partially paid order", async () => {
    const { prisma, tx } = makeLoyaltyPrisma({ order: order(), paid: 100 });
    const service = new LoyaltyService(prisma as never);

    expect(await service.earnIfOrderSettled("order_1")).toBeNull();
    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
  });

  it("does not credit orders without a customer or cancelled orders", async () => {
    for (const o of [order({ customerId: null }), order({ status: "cancelled" })]) {
      const { prisma, tx } = makeLoyaltyPrisma({ order: o, paid: 250 });
      const service = new LoyaltyService(prisma as never);
      expect(await service.earnIfOrderSettled("order_1")).toBeNull();
      expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
    }
  });

  it("does not double credit when the order was already earned (paid then completed)", async () => {
    const { prisma, tx } = makeLoyaltyPrisma({
      order: order({ status: "completed" }),
      paid: 250,
      existingEarn: true,
    });
    const service = new LoyaltyService(prisma as never);

    await service.earnIfOrderSettled("order_1", { force: true });

    expect(tx.loyaltyTransaction.create).not.toHaveBeenCalled();
  });

  it("swallows earn failures", async () => {
    const { prisma } = makeLoyaltyPrisma({ order: order(), paid: 250 });
    prisma.$transaction.mockRejectedValue(new Error("db down"));
    const service = new LoyaltyService(prisma as never);

    await expect(service.earnIfOrderSettled("order_1")).resolves.toBeNull();
  });
});

describe("PaymentsService loyalty hooks", () => {
  function cashPrisma(total: number) {
    let paidSum = 0;
    const prisma = {
      $queryRaw: vi.fn(),
      order: {
        findFirst: vi.fn().mockResolvedValue({
          id: "ord_1",
          organizationId: "org_1",
          outletId: "out_1",
          orderNumber: "T-1",
          total,
          status: "confirmed",
        }),
      },
      paymentMethod: { upsert: vi.fn().mockResolvedValue({ id: "pm_cash" }) },
      payment: {
        create: vi.fn().mockImplementation(async ({ data }: { data: { amount: number } }) => {
          paidSum += data.amount;
          return { id: "pay_1", amount: data.amount };
        }),
        aggregate: vi.fn().mockImplementation(async () => ({ _sum: { amount: paidSum } })),
      },
      cashierShift: { findFirst: vi.fn().mockResolvedValue(null) },
      cashMovement: { create: vi.fn() },
    };
    Object.assign(prisma, { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)) });
    return prisma;
  }

  it("earns after a full cash payment", async () => {
    const loyalty = { earnIfOrderSettled: vi.fn().mockResolvedValue(null) };
    const service = new PaymentsService(cashPrisma(250) as never, {} as never, {} as never, loyalty as never);

    await service.recordCash("org_1", "ord_1");

    expect(loyalty.earnIfOrderSettled).toHaveBeenCalledWith("ord_1", { organizationId: "org_1" });
  });

  it("does not earn on a partial cash payment", async () => {
    const loyalty = { earnIfOrderSettled: vi.fn().mockResolvedValue(null) };
    const service = new PaymentsService(cashPrisma(500) as never, {} as never, {} as never, loyalty as never);

    await service.recordCash("org_1", "ord_1", 200);

    expect(loyalty.earnIfOrderSettled).not.toHaveBeenCalled();
  });

  it("earns after a gateway payment completes", async () => {
    const tx = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          id: "pay_1",
          orderId: "ord_1",
          amount: 250,
          status: "pending",
          metadata: {},
          reference: "rzp_order",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      paymentMethod: { upsert: vi.fn().mockResolvedValue({ id: "pm_upi" }) },
    };
    const prisma = {
      $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
      paymentMethod: tx.paymentMethod,
    };
    const loyalty = { earnIfOrderSettled: vi.fn().mockResolvedValue(null) };
    const service = new PaymentsService(prisma as never, {} as never, {} as never, loyalty as never);

    await service.completeDinerPayment({ organizationId: "org_1", paymentId: "pay_1" });

    expect(loyalty.earnIfOrderSettled).toHaveBeenCalledWith("ord_1", { organizationId: "org_1" });
  });
});
