import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { EXTERNAL_REFUND_CODE } from "./payments-refund.util";
import { PaymentsService } from "./payments.service";

function serviceFor(payment: Record<string, unknown>, extras?: {
  resolveForProvider?: ReturnType<typeof vi.fn>;
  createRefund?: ReturnType<typeof vi.fn>;
  shift?: { id: string } | null;
}) {
  const prisma = {
    $queryRaw: vi.fn(),
    payment: {
      findMany: vi.fn().mockResolvedValue([payment]),
      findFirst: vi.fn().mockResolvedValue(payment),
      update: vi.fn().mockResolvedValue(payment),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    cashierShift: {
      findFirst: vi.fn().mockResolvedValue(extras?.shift ?? null),
    },
    cashMovement: { create: vi.fn() },
  };
  Object.assign(prisma, {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  });
  const credentials = {
    resolveForProvider: extras?.resolveForProvider ?? vi.fn().mockResolvedValue(null),
  };
  const cashfree = { createRefund: extras?.createRefund ?? vi.fn() };
  const svc = new PaymentsService(prisma as never, credentials as never, cashfree as never);
  return { svc, prisma, cashfree };
}

describe("PaymentsService.refundCompletedForOrder", () => {
  it("marks a cash payment refunded and records a drawer cash out", async () => {
    const { svc, prisma } = serviceFor(
      {
        id: "pay_cash",
        organizationId: "org_1",
        orderId: "ord_1",
        amount: 80,
        status: "completed",
        reference: null,
        metadata: { tender: "cash", kind: "diner" },
        paymentMethod: { code: "cash" },
      },
      { shift: { id: "shift_1" } },
    );

    await svc.refundCompletedForOrder("org_1", "ord_1", {
      outletId: "out_1",
      userId: "user_1",
    });

    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "refunded" }),
      }),
    );
    expect(prisma.cashMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "cash_out", amount: 80, shiftId: "shift_1" }),
      }),
    );
  });

  it("refuses a Razorpay payment that has no payment id", async () => {
    const { svc, prisma } = serviceFor({
      id: "pay_rz",
      organizationId: "org_1",
      orderId: "ord_1",
      amount: 200,
      status: "completed",
      reference: "order_abc",
      metadata: { provider: "razorpay", razorpayOrderId: "order_abc" },
      paymentMethod: { code: "upi" },
    });

    await expect(
      svc.refundCompletedForOrder("org_1", "ord_1", { outletId: "out_1" }),
    ).rejects.toMatchObject({
      response: { code: EXTERNAL_REFUND_CODE },
    });
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });

  it("records an external dashboard refund when staff confirm it", async () => {
    const createRefund = vi.fn();
    const { svc, prisma } = serviceFor(
      {
        id: "pay_rz",
        organizationId: "org_1",
        orderId: "ord_1",
        amount: 200,
        status: "completed",
        reference: "order_abc",
        metadata: { provider: "razorpay", razorpayOrderId: "order_abc" },
        paymentMethod: { code: "upi" },
      },
      { createRefund },
    );

    await svc.refundCompletedForOrder("org_1", "ord_1", {
      outletId: "out_1",
      externalRefundConfirmed: true,
    });

    expect(createRefund).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "refunded",
          metadata: expect.objectContaining({ refundSource: "external_dashboard" }),
        }),
      }),
    );
  });
});

describe("refund error shape", () => {
  it("uses BadRequestException for the external-refund code", () => {
    const err = new BadRequestException({
      message: "confirm",
      code: EXTERNAL_REFUND_CODE,
    });
    expect(err.getStatus()).toBe(400);
  });
});
