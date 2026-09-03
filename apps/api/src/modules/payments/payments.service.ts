import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RazorpayClient } from "./razorpay.client";

type PaymentMetadata = {
  kind?: string;
  tender?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  signature?: string;
  method?: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private razorpay: RazorpayClient,
  ) {}

  list(orgId: string) {
    return this.prisma.payment.findMany({
      where: { order: { organizationId: orgId } },
      include: { paymentMethod: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    });
  }

  async recordCash(orgId: string, orderId: string) {
    const order = await this.requireOrder(orgId, orderId);
    const remaining = await this.remainingUnpaid(order.id, Number(order.total));
    if (remaining <= 0) {
      return { success: true, orderId: order.id, alreadyPaid: true };
    }

    const method = await this.ensureMethod("cash", "Cash");
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethodId: method.id,
        amount: remaining,
        status: "completed",
        processedAt: new Date(),
        metadata: { kind: "diner", tender: "cash" } satisfies PaymentMetadata,
      },
    });

    return { success: true, orderId: order.id, paymentId: payment.id, alreadyPaid: false };
  }

  async createOnlineIntent(orgId: string, orderId: string) {
    this.razorpay.requireConfigured();
    const order = await this.requireOrder(orgId, orderId);
    const remaining = await this.remainingUnpaid(order.id, Number(order.total));
    if (remaining <= 0) {
      throw new BadRequestException("Order is already paid");
    }

    const existing = await this.prisma.payment.findFirst({
      where: { orderId: order.id, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    const existingMeta = (existing?.metadata ?? {}) as PaymentMetadata;
    if (existing?.id && existingMeta.razorpayOrderId) {
      return {
        provider: "razorpay",
        orderId: order.id,
        paymentId: existing.id,
        keyId: this.razorpay.keyId(),
        razorpayOrderId: existingMeta.razorpayOrderId,
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
          orderId: order.id,
          paymentMethodId: (await this.ensureMethod("upi", "UPI")).id,
          amount: remaining,
          status: "pending",
          metadata: { kind: "diner" } satisfies PaymentMetadata,
        },
      }));

    const amountPaise = Math.round(remaining * 100);
    const rzOrder = await this.razorpay.createOrder({
      amountPaise,
      receipt: `ord_${order.id}`.slice(0, 40),
      notes: {
        kind: "diner",
        orderId: order.id,
        organizationId: orgId,
        paymentId: pending.id,
      },
    });

    await this.prisma.payment.update({
      where: { id: pending.id },
      data: {
        amount: remaining,
        reference: rzOrder.id,
        metadata: {
          kind: "diner",
          razorpayOrderId: rzOrder.id,
        } satisfies PaymentMetadata,
      },
    });

    return {
      provider: "razorpay",
      orderId: order.id,
      paymentId: pending.id,
      keyId: this.razorpay.keyId(),
      razorpayOrderId: rzOrder.id,
      amount: remaining,
      amountPaise,
      currency: "INR",
      status: "pending",
    };
  }

  async verifyOnlinePayment(
    orgId: string,
    data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  ) {
    this.razorpay.requireConfigured();
    if (
      !this.razorpay.verifyPaymentSignature(
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
    });
  }

  async completeDinerPayment(input: {
    organizationId?: string;
    paymentId?: string;
    orderId?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    signature?: string;
    method?: string;
    failed?: boolean;
  }) {
    const payment = await this.findDinerPayment(input);
    if (!payment) {
      throw new NotFoundException("Payment not found");
    }

    if (input.failed) {
      if (payment.status === "completed") {
        return { success: true, orderId: payment.orderId, paymentId: payment.id };
      }
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed" },
      });
      return { success: false, orderId: payment.orderId, paymentId: payment.id };
    }

    if (payment.status === "completed") {
      return { success: true, orderId: payment.orderId, paymentId: payment.id, alreadyPaid: true };
    }

    const methodCode = this.mapGatewayMethod(input.method);
    const method = await this.ensureMethod(
      methodCode,
      methodCode === "card" ? "Card" : "UPI",
    );
    const meta = (payment.metadata ?? {}) as PaymentMetadata;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "completed",
        paymentMethodId: method.id,
        reference: input.razorpayPaymentId ?? payment.reference,
        processedAt: new Date(),
        metadata: {
          ...meta,
          kind: "diner",
          razorpayOrderId: input.razorpayOrderId ?? meta.razorpayOrderId,
          razorpayPaymentId: input.razorpayPaymentId,
          signature: input.signature,
          method: input.method,
        } satisfies PaymentMetadata,
      },
    });

    return { success: true, orderId: payment.orderId, paymentId: payment.id };
  }

  notesKind(entity: Record<string, unknown> | null | undefined): string | undefined {
    const notes = entity?.notes;
    if (!notes || typeof notes !== "object") return undefined;
    const kind = (notes as Record<string, unknown>).kind;
    return typeof kind === "string" ? kind : undefined;
  }

  private async findDinerPayment(input: {
    organizationId?: string;
    paymentId?: string;
    orderId?: string;
    razorpayOrderId?: string;
  }) {
    if (input.paymentId) {
      return this.prisma.payment.findFirst({
        where: {
          id: input.paymentId,
          ...(input.organizationId
            ? { order: { organizationId: input.organizationId } }
            : {}),
        },
      });
    }

    if (input.razorpayOrderId) {
      return this.prisma.payment.findFirst({
        where: {
          reference: input.razorpayOrderId,
          ...(input.organizationId
            ? { order: { organizationId: input.organizationId } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (input.orderId) {
      return this.prisma.payment.findFirst({
        where: {
          orderId: input.orderId,
          status: "pending",
          ...(input.organizationId
            ? { order: { organizationId: input.organizationId } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return null;
  }

  private async requireOrder(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  private async remainingUnpaid(orderId: string, total: number) {
    const paid = await this.prisma.payment.aggregate({
      where: { orderId, status: "completed" },
      _sum: { amount: true },
    });
    const paidAmount = Number(paid._sum.amount ?? 0);
    return Math.max(0, Math.round((total - paidAmount) * 100) / 100);
  }

  private mapGatewayMethod(method?: string) {
    const normalized = method?.toLowerCase();
    if (normalized === "card" || normalized === "emi" || normalized === "debit" || normalized === "credit") {
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
}
