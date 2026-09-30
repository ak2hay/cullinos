import { describe, expect, it, vi } from "vitest";
import { PaymentsService } from "./payments.service";

describe("PaymentsService.recordCash", () => {
  it("records full cash pay without marking the order completed", async () => {
    const order = {
      id: "ord_1",
      organizationId: "org_1",
      outletId: "out_1",
      orderNumber: "T-100",
      total: 250,
      status: "confirmed",
    };
    const method = { id: "pm_cash", code: "cash", name: "Cash" };
    const payment = {
      id: "pay_1",
      orderId: order.id,
      amount: 250,
      status: "completed",
    };

    let paidSum = 0;
    const prisma = {
      $queryRaw: vi.fn(),
      order: {
        findFirst: vi.fn().mockResolvedValue(order),
        update: vi.fn(),
      },
      paymentMethod: {
        upsert: vi.fn().mockResolvedValue(method),
      },
      payment: {
        create: vi.fn().mockImplementation(async ({ data }: { data: { amount: number } }) => {
          paidSum += data.amount;
          return { ...payment, amount: data.amount };
        }),
        aggregate: vi.fn().mockImplementation(async () => ({
          _sum: { amount: paidSum },
        })),
      },
      cashierShift: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      cashMovement: {
        create: vi.fn(),
      },
    };

    Object.assign(prisma, { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)) });
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.recordCash("org_1", "ord_1");

    expect(result).toMatchObject({
      success: true,
      orderId: "ord_1",
      paymentId: "pay_1",
      alreadyPaid: false,
      paidAmount: 250,
      remaining: 0,
    });
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "ord_1",
          amount: 250,
          status: "completed",
        }),
      }),
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it("keeps remaining balance on partial cash without changing order status", async () => {
    const order = {
      id: "ord_2",
      organizationId: "org_1",
      outletId: "out_1",
      orderNumber: "T-101",
      total: 500,
      status: "confirmed",
    };
    const method = { id: "pm_cash", code: "cash", name: "Cash" };

    let paidSum = 0;
    const prisma = {
      $queryRaw: vi.fn(),
      order: {
        findFirst: vi.fn().mockResolvedValue(order),
        update: vi.fn(),
      },
      paymentMethod: {
        upsert: vi.fn().mockResolvedValue(method),
      },
      payment: {
        create: vi.fn().mockImplementation(async ({ data }: { data: { amount: number } }) => {
          paidSum += data.amount;
          return { id: "pay_partial", orderId: order.id, amount: data.amount };
        }),
        aggregate: vi.fn().mockImplementation(async () => ({
          _sum: { amount: paidSum },
        })),
      },
      cashierShift: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      cashMovement: {
        create: vi.fn(),
      },
    };

    Object.assign(prisma, { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)) });
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.recordCash("org_1", "ord_2", 200);

    expect(result).toMatchObject({
      success: true,
      paidAmount: 200,
      remaining: 300,
    });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});
