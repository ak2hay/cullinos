import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CashfreeClient } from "./cashfree.client";
import { PaymentCredentialsService } from "./payment-credentials.service";
import type {
  PaymentGatewayProvider,
  ResolvedPaymentCredentials,
} from "./payment-gateway.types";
import { isPaymentGatewayProvider } from "./payment-gateway.types";
import {
  createTenantRazorpayOrder,
  verifyTenantRazorpayPaymentSignature,
  verifyTenantRazorpayWebhookSignature,
} from "./tenant-razorpay";

type PaymentMetadata = {
  kind?: string;
  tender?: string;
  provider?: PaymentGatewayProvider;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  cashfreeOrderId?: string;
  paymentSessionId?: string;
  signature?: string;
  method?: string;
  outletId?: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private credentials: PaymentCredentialsService,
    private cashfree: CashfreeClient,
  ) {}

  list(orgId: string) {
    return this.prisma.payment.findMany({
      where: { organizationId: orgId },
      include: { paymentMethod: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    });
  }

  async recordCash(
    orgId: string,
    orderId: string,
    amount?: number,
    userId?: string,
  ) {
    const order = await this.requireOrder(orgId, orderId);
    const remaining = await this.remainingUnpaid(order.id, Number(order.total));
    if (remaining <= 0) {
      return {
        success: true,
        orderId: order.id,
        alreadyPaid: true,
        remaining: 0,
      };
    }

    let payAmount = remaining;
    if (amount != null && Number.isFinite(amount)) {
      if (amount <= 0) throw new BadRequestException("Amount must be positive");
      payAmount = Math.min(remaining, Math.round(amount * 100) / 100);
    }

    const method = await this.ensureMethod("cash", "Cash");
    const payment = await this.prisma.payment.create({
      data: {
        organizationId: orgId,
        orderId: order.id,
        paymentMethodId: method.id,
        amount: payAmount,
        status: "completed",
        processedAt: new Date(),
        metadata: { kind: "diner", tender: "cash" } satisfies PaymentMetadata,
      },
    });

    if (userId) {
      const shift = await this.prisma.cashierShift.findFirst({
        where: { outletId: order.outletId, userId, status: "open" },
      });
      if (shift) {
        await this.prisma.cashMovement.create({
          data: {
            shiftId: shift.id,
            type: "sale",
            amount: payAmount,
            reason: `POS cash · order ${order.orderNumber}`,
          },
        });
      }
    }

    const left = await this.remainingUnpaid(order.id, Number(order.total));
    if (left <= 0 && !["completed", "cancelled", "voided"].includes(order.status)) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: "completed", completedAt: new Date() },
      });
    }

    return {
      success: true,
      orderId: order.id,
      paymentId: payment.id,
      alreadyPaid: false,
      paidAmount: payAmount,
      remaining: left,
    };
  }

  async getBalance(orgId: string, orderId: string) {
    const order = await this.requireOrder(orgId, orderId);
    const remaining = await this.remainingUnpaid(order.id, Number(order.total));
    return {
      orderId: order.id,
      total: Number(order.total),
      remaining,
      paid: Math.round((Number(order.total) - remaining) * 100) / 100,
    };
  }

  async createOnlineIntent(
    orgId: string,
    orderId: string,
    amount?: number,
    preferredProvider?: string,
  ) {
    const order = await this.requireOrder(orgId, orderId);
    let remaining = await this.remainingUnpaid(order.id, Number(order.total));
    if (remaining <= 0) {
      throw new BadRequestException("Order is already paid");
    }
    if (amount != null && Number.isFinite(amount)) {
      if (amount <= 0) throw new BadRequestException("Amount must be positive");
      remaining = Math.min(remaining, Math.round(amount * 100) / 100);
    }

    const creds = await this.credentials.resolve(
      orgId,
      order.outletId,
      preferredProvider,
    );

    const existing = await this.prisma.payment.findFirst({
      where: { organizationId: orgId, orderId: order.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    const existingMeta = (existing?.metadata ?? {}) as PaymentMetadata;

    if (
      existing?.id &&
      existingMeta.provider === creds.provider &&
      ((creds.provider === "razorpay" && existingMeta.razorpayOrderId) ||
        (creds.provider === "cashfree" && existingMeta.paymentSessionId))
    ) {
      if (creds.provider === "razorpay") {
        return {
          provider: "razorpay" as const,
          orderId: order.id,
          paymentId: existing.id,
          keyId: creds.keyId,
          razorpayOrderId: existingMeta.razorpayOrderId!,
          amount: remaining,
          amountPaise: Math.round(remaining * 100),
          currency: "INR",
          status: "pending",
        };
      }
      return {
        provider: "cashfree" as const,
        orderId: order.id,
        paymentId: existing.id,
        cashfreeOrderId: existingMeta.cashfreeOrderId!,
        paymentSessionId: existingMeta.paymentSessionId!,
        mode: creds.mode,
        amount: remaining,
        amountPaise: Math.round(remaining * 100),
        currency: "INR",
        status: "pending",
      };
    }

    const pending =
      existing ??
      (await this.prisma.payment.create({
        data: {
          organizationId: orgId,
          orderId: order.id,
          paymentMethodId: (await this.ensureMethod("upi", "UPI")).id,
          amount: remaining,
          status: "pending",
          metadata: {
            kind: "diner",
            provider: creds.provider,
            outletId: order.outletId,
          } satisfies PaymentMetadata,
        },
      }));

    if (creds.provider === "razorpay") {
      return this.createRazorpayIntent(creds, order, pending.id, remaining);
    }
    return this.createCashfreeIntent(creds, order, pending.id, remaining);
  }

  private async createRazorpayIntent(
    creds: ResolvedPaymentCredentials,
    order: { id: string; organizationId: string; outletId: string },
    paymentId: string,
    remaining: number,
  ) {
    const amountPaise = Math.round(remaining * 100);
    if (amountPaise < 100) {
      throw new BadRequestException("Amount must be at least ₹1.00 (100 paise)");
    }

    const rzOrder = await createTenantRazorpayOrder(creds, {
      amountPaise,
      receipt: `ord_${order.id}`.slice(0, 40),
      notes: {
        kind: "diner",
        orderId: order.id,
        organizationId: order.organizationId,
        paymentId,
        outletId: order.outletId,
      },
    });

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        amount: remaining,
        reference: rzOrder.id,
        metadata: {
          kind: "diner",
          provider: "razorpay",
          outletId: order.outletId,
          razorpayOrderId: rzOrder.id,
        } satisfies PaymentMetadata,
      },
    });

    return {
      provider: "razorpay" as const,
      orderId: order.id,
      paymentId,
      keyId: creds.keyId,
      razorpayOrderId: rzOrder.id,
      amount: remaining,
      amountPaise: rzOrder.amount ?? amountPaise,
      currency: rzOrder.currency ?? "INR",
      status: "pending",
    };
  }

  private async createCashfreeIntent(
    creds: ResolvedPaymentCredentials,
    order: { id: string; organizationId: string; outletId: string },
    paymentId: string,
    remaining: number,
  ) {
    if (remaining < 1) {
      throw new BadRequestException("Amount must be at least ₹1.00");
    }

    const cfOrderId = `cf_${paymentId}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);
    const created = await this.cashfree.createOrder(creds, {
      orderId: cfOrderId,
      amount: remaining,
      customerId: `guest_${order.id}`.slice(0, 50),
      tags: {
        kind: "diner",
        orderId: order.id,
        organizationId: order.organizationId,
        paymentId,
        outletId: order.outletId,
      },
    });

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        amount: remaining,
        reference: created.cashfreeOrderId,
        metadata: {
          kind: "diner",
          provider: "cashfree",
          outletId: order.outletId,
          cashfreeOrderId: created.cashfreeOrderId,
          paymentSessionId: created.paymentSessionId,
        } satisfies PaymentMetadata,
      },
    });

    return {
      provider: "cashfree" as const,
      orderId: order.id,
      paymentId,
      cashfreeOrderId: created.cashfreeOrderId,
      paymentSessionId: created.paymentSessionId,
      mode: creds.mode,
      amount: remaining,
      amountPaise: Math.round(remaining * 100),
      currency: created.orderCurrency ?? "INR",
      status: "pending",
    };
  }

  async verifyOnlinePayment(
    orgId: string,
    data: {
      provider?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
      cashfreeOrderId?: string;
    },
  ) {
    const providerHint =
      data.provider && isPaymentGatewayProvider(data.provider)
        ? data.provider
        : data.cashfreeOrderId
          ? "cashfree"
          : "razorpay";

    if (providerHint === "cashfree") {
      return this.verifyCashfreePayment(orgId, data.cashfreeOrderId ?? "");
    }

    if (
      !data.razorpayOrderId?.trim() ||
      !data.razorpayPaymentId?.trim() ||
      !data.razorpaySignature?.trim()
    ) {
      throw new BadRequestException("Missing payment verification fields");
    }

    const byRef = await this.prisma.payment.findFirst({
      where: { organizationId: orgId, reference: data.razorpayOrderId },
      orderBy: { createdAt: "desc" },
    });

    if (!byRef) throw new NotFoundException("Payment not found");

    const meta = (byRef.metadata ?? {}) as PaymentMetadata;
    const creds = await this.credentials.resolveForProvider(
      orgId,
      "razorpay",
      meta.outletId,
    );
    if (!creds) {
      throw new BadRequestException("Razorpay is not configured for this restaurant");
    }

    if (
      !verifyTenantRazorpayPaymentSignature(
        creds.secret,
        data.razorpayOrderId,
        data.razorpayPaymentId,
        data.razorpaySignature,
      )
    ) {
      throw new BadRequestException("Invalid payment signature");
    }

    return this.completeDinerPayment({
      organizationId: orgId,
      razorpayOrderId: data.razorpayOrderId,
      razorpayPaymentId: data.razorpayPaymentId,
      signature: data.razorpaySignature,
      provider: "razorpay",
    });
  }

  private async verifyCashfreePayment(orgId: string, cashfreeOrderId: string) {
    if (!cashfreeOrderId?.trim()) {
      throw new BadRequestException("Missing cashfreeOrderId");
    }

    const payment = await this.prisma.payment.findFirst({
      where: { organizationId: orgId, reference: cashfreeOrderId },
      orderBy: { createdAt: "desc" },
    });
    if (!payment) throw new NotFoundException("Payment not found");

    const meta = (payment.metadata ?? {}) as PaymentMetadata;
    const creds = await this.credentials.resolveForProvider(
      orgId,
      "cashfree",
      meta.outletId,
    );
    if (!creds) {
      throw new BadRequestException("Cashfree is not configured for this restaurant");
    }

    const order = await this.cashfree.getOrder(creds, cashfreeOrderId);
    if (order.orderStatus !== "PAID") {
      throw new BadRequestException(
        `Cashfree payment not completed (status: ${order.orderStatus})`,
      );
    }

    if (order.orderAmount != null) {
      const expected = Math.round(Number(payment.amount) * 100) / 100;
      if (Math.abs(order.orderAmount - expected) > 0.01) {
        throw new BadRequestException("Payment amount mismatch");
      }
    }

    return this.completeDinerPayment({
      organizationId: orgId,
      paymentId: payment.id,
      cashfreeOrderId,
      provider: "cashfree",
      amountPaise: Math.round(Number(payment.amount) * 100),
      currency: order.orderCurrency ?? "INR",
    });
  }

  /**
   * Persist webhook event idempotently.
   * Returns false when the event was already processed.
   */
  async claimWebhookEvent(input: {
    provider: string;
    eventId: string;
    eventType: string;
    payload?: unknown;
  }): Promise<boolean> {
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: {
          provider: input.provider,
          eventId: input.eventId,
          eventType: input.eventType,
          payload: input.payload as Prisma.InputJsonValue | undefined,
        },
      });
      return true;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return false;
      }
      throw err;
    }
  }

  async resolveRazorpayWebhookCredentials(body: Record<string, unknown>): Promise<{
    kind: "saas" | "diner" | "unknown";
    creds: ResolvedPaymentCredentials | null;
    organizationId?: string;
    paymentId?: string;
    outletId?: string;
  }> {
    const payload = (body.payload ?? {}) as Record<string, unknown>;
    const payment = (payload.payment as { entity?: Record<string, unknown> } | undefined)
      ?.entity;
    const order = (payload.order as { entity?: Record<string, unknown> } | undefined)
      ?.entity;
    const subscription = (
      payload.subscription as { entity?: Record<string, unknown> } | undefined
    )?.entity;

    const kind =
      this.notesKind(payment) ??
      this.notesKind(order) ??
      this.notesKind(subscription);

    const event = typeof body.event === "string" ? body.event : "";
    const isSaas =
      kind === "saas" ||
      event.startsWith("subscription.") ||
      Boolean(payment?.subscription_id);

    if (isSaas) {
      return { kind: "saas", creds: null };
    }

    const notes =
      (typeof payment?.notes === "object" && payment.notes
        ? (payment.notes as Record<string, string>)
        : undefined) ??
      (typeof order?.notes === "object" && order.notes
        ? (order.notes as Record<string, string>)
        : undefined);

    const organizationId = notes?.organizationId;
    const paymentId = notes?.paymentId;
    const outletId = notes?.outletId;
    const razorpayOrderId =
      (typeof payment?.order_id === "string" ? payment.order_id : undefined) ??
      (typeof order?.id === "string" ? order.id : undefined);

    let orgId = organizationId;
    let outlet = outletId;

    if (!orgId && (paymentId || razorpayOrderId)) {
      const row = await this.prisma.payment.findFirst({
        where: paymentId
          ? { id: paymentId }
          : { reference: razorpayOrderId! },
      });
      if (row) {
        orgId = row.organizationId;
        const meta = (row.metadata ?? {}) as PaymentMetadata;
        outlet = outlet ?? meta.outletId;
      }
    }

    if (!orgId) {
      return { kind: "unknown", creds: null };
    }

    const creds = await this.credentials.resolveForProvider(
      orgId,
      "razorpay",
      outlet,
    );
    return {
      kind: "diner",
      creds,
      organizationId: orgId,
      paymentId,
      outletId: outlet,
    };
  }

  verifyDinerRazorpayWebhook(
    creds: ResolvedPaymentCredentials | null,
    raw: Buffer | string,
    signature: string | undefined,
  ): boolean {
    if (!creds) return false;
    return verifyTenantRazorpayWebhookSignature(
      creds.webhookSecret ?? creds.secret,
      raw,
      signature,
    );
  }

  async resolveCashfreeWebhookCredentials(body: Record<string, unknown>): Promise<{
    creds: ResolvedPaymentCredentials | null;
    organizationId?: string;
    paymentId?: string;
    cashfreeOrderId?: string;
  }> {
    const data = (body.data ?? body) as Record<string, unknown>;
    const order = (data.order ?? data) as Record<string, unknown>;
    const tags =
      typeof order.order_tags === "object" && order.order_tags
        ? (order.order_tags as Record<string, string>)
        : typeof data.order_tags === "object" && data.order_tags
          ? (data.order_tags as Record<string, string>)
          : {};

    const cashfreeOrderId =
      (typeof order.order_id === "string" ? order.order_id : undefined) ??
      (typeof data.order_id === "string" ? data.order_id : undefined);

    let organizationId = tags.organizationId;
    let paymentId = tags.paymentId;
    let outletId = tags.outletId;

    if ((!organizationId || !outletId) && cashfreeOrderId) {
      const row = await this.prisma.payment.findFirst({
        where: { reference: cashfreeOrderId },
      });
      if (row) {
        organizationId = organizationId ?? row.organizationId;
        paymentId = paymentId ?? row.id;
        const meta = (row.metadata ?? {}) as PaymentMetadata;
        outletId = outletId ?? meta.outletId;
      }
    }

    if (!organizationId) {
      return { creds: null, cashfreeOrderId };
    }

    const creds = await this.credentials.resolveForProvider(
      organizationId,
      "cashfree",
      outletId,
    );
    return { creds, organizationId, paymentId, cashfreeOrderId };
  }

  async completeDinerPayment(input: {
    organizationId?: string;
    paymentId?: string;
    orderId?: string;
    provider?: PaymentGatewayProvider;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    cashfreeOrderId?: string;
    signature?: string;
    method?: string;
    failed?: boolean;
    amountPaise?: number;
    currency?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await this.findDinerPaymentTx(tx, input);
      if (!payment) {
        throw new NotFoundException("Payment not found");
      }

      if (input.failed) {
        if (payment.status === "completed") {
          return { success: true, orderId: payment.orderId, paymentId: payment.id };
        }
        await tx.payment.updateMany({
          where: { id: payment.id, status: { not: "completed" } },
          data: { status: "failed" },
        });
        return { success: false, orderId: payment.orderId, paymentId: payment.id };
      }

      if (payment.status === "completed") {
        return {
          success: true,
          orderId: payment.orderId,
          paymentId: payment.id,
          alreadyPaid: true,
        };
      }

      if (input.amountPaise != null) {
        const expectedPaise = Math.round(Number(payment.amount) * 100);
        if (expectedPaise !== input.amountPaise) {
          throw new BadRequestException("Payment amount mismatch");
        }
      }
      if (input.currency && input.currency.toUpperCase() !== "INR") {
        throw new BadRequestException("Payment currency mismatch");
      }

      const methodCode = this.mapGatewayMethod(input.method);
      const method = await this.ensureMethodTx(
        tx,
        methodCode,
        methodCode === "card" ? "Card" : "UPI",
      );
      const meta = (payment.metadata ?? {}) as PaymentMetadata;
      const provider =
        input.provider ?? meta.provider ?? ("razorpay" as PaymentGatewayProvider);

      const updated = await tx.payment.updateMany({
        where: { id: payment.id, status: "pending" },
        data: {
          status: "completed",
          paymentMethodId: method.id,
          reference:
            input.razorpayPaymentId ??
            input.cashfreeOrderId ??
            payment.reference,
          processedAt: new Date(),
          metadata: {
            ...meta,
            kind: "diner",
            provider,
            razorpayOrderId: input.razorpayOrderId ?? meta.razorpayOrderId,
            razorpayPaymentId: input.razorpayPaymentId,
            cashfreeOrderId: input.cashfreeOrderId ?? meta.cashfreeOrderId,
            signature: input.signature,
            method: input.method,
          } satisfies PaymentMetadata,
        },
      });

      if (updated.count === 0) {
        const current = await tx.payment.findUnique({ where: { id: payment.id } });
        if (current?.status === "completed") {
          return {
            success: true,
            orderId: payment.orderId,
            paymentId: payment.id,
            alreadyPaid: true,
          };
        }
        throw new BadRequestException("Payment could not be completed");
      }

      return { success: true, orderId: payment.orderId, paymentId: payment.id };
    });
  }

  notesKind(entity: Record<string, unknown> | null | undefined): string | undefined {
    const notes = entity?.notes;
    if (!notes || typeof notes !== "object") return undefined;
    const kind = (notes as Record<string, unknown>).kind;
    return typeof kind === "string" ? kind : undefined;
  }

  private findDinerPaymentTx(
    tx: Prisma.TransactionClient,
    input: {
      organizationId?: string;
      paymentId?: string;
      orderId?: string;
      razorpayOrderId?: string;
      cashfreeOrderId?: string;
    },
  ) {
    if (input.paymentId) {
      return tx.payment.findFirst({
        where: {
          id: input.paymentId,
          ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        },
      });
    }

    const ref = input.razorpayOrderId ?? input.cashfreeOrderId;
    if (ref) {
      return tx.payment.findFirst({
        where: {
          reference: ref,
          ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (input.orderId) {
      return tx.payment.findFirst({
        where: {
          orderId: input.orderId,
          status: "pending",
          ...(input.organizationId ? { organizationId: input.organizationId } : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return Promise.resolve(null);
  }

  private async requireOrder(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async remainingUnpaid(orderId: string, total: number) {
    const paid = await this.prisma.payment.aggregate({
      where: { orderId, status: "completed" },
      _sum: { amount: true },
    });
    const paidAmount = Number(paid._sum.amount ?? 0);
    return Math.max(0, Math.round((total - paidAmount) * 100) / 100);
  }

  private mapGatewayMethod(method?: string) {
    const normalized = method?.toLowerCase();
    if (
      normalized === "card" ||
      normalized === "emi" ||
      normalized === "debit" ||
      normalized === "credit"
    ) {
      return "card";
    }
    if (normalized === "wallet") return "wallet";
    return "upi";
  }

  private ensureMethod(code: string, name: string) {
    return this.prisma.paymentMethod.upsert({
      where: { code },
      update: { isActive: true },
      create: { name, code },
    });
  }

  private ensureMethodTx(tx: Prisma.TransactionClient, code: string, name: string) {
    return tx.paymentMethod.upsert({
      where: { code },
      update: { isActive: true },
      create: { name, code },
    });
  }
}
