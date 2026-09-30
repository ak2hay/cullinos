import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

type ClaimRunner = {
  runClaimedWebhook<T>(
    claim: { provider: string; eventId: string; eventType: string; payload: unknown },
    process: () => Promise<T>,
  ): Promise<T | { duplicate: true }>;
};

function controllerWith(claimed: boolean) {
  const service = {
    claimWebhookEvent: vi.fn(async () => claimed),
    releaseWebhookEvent: vi.fn(async () => undefined),
  };
  const controller = new PaymentsController(
    service as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  ) as unknown as ClaimRunner;
  return { controller, service };
}

const claim = { provider: "razorpay", eventId: "evt_1", eventType: "payment.captured", payload: {} };

describe("PaymentsController webhook claims", () => {
  it("returns duplicate without processing an already-claimed event", async () => {
    const { controller } = controllerWith(false);
    const process = vi.fn();
    await expect(controller.runClaimedWebhook(claim, process)).resolves.toMatchObject({
      duplicate: true,
    });
    expect(process).not.toHaveBeenCalled();
  });

  it("releases the claim on unexpected errors so the provider retry is processed", async () => {
    const { controller, service } = controllerWith(true);
    await expect(
      controller.runClaimedWebhook(claim, async () => {
        throw new Error("db down");
      }),
    ).rejects.toThrow("db down");
    expect(service.releaseWebhookEvent).toHaveBeenCalledWith("razorpay", "evt_1");
  });

  it("keeps the claim for permanent HTTP errors like amount mismatch", async () => {
    const { controller, service } = controllerWith(true);
    await expect(
      controller.runClaimedWebhook(claim, async () => {
        throw new BadRequestException("Payment amount mismatch");
      }),
    ).rejects.toThrow(BadRequestException);
    expect(service.releaseWebhookEvent).not.toHaveBeenCalled();
  });
});

describe("PaymentsService.completeDinerPayment", () => {
  it("completes a payment previously marked failed (retry on the same gateway order)", async () => {
    const payment = {
      id: "pay_1",
      orderId: "ord_1",
      organizationId: "org_1",
      status: "failed",
      amount: 250,
      reference: "order_rzp",
      metadata: {},
    };
    const tx = {
      payment: {
        findFirst: vi.fn(async () => payment),
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUnique: vi.fn(),
      },
      paymentMethod: { upsert: vi.fn(async () => ({ id: "pm_upi" })) },
    };
    const prisma = { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
    const service = new PaymentsService(prisma as never, {} as never, {} as never);

    const result = await service.completeDinerPayment({
      organizationId: "org_1",
      paymentId: "pay_1",
      razorpayPaymentId: "pay_rzp",
      amountPaise: 25_000,
      method: "upi",
    });

    expect(result).toMatchObject({ success: true, paymentId: "pay_1" });
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay_1", status: { in: ["pending", "failed"] } },
      }),
    );
  });
});
