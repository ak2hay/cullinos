import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.payment.findMany({
      where: { order: { organizationId: orgId } },
      take: 200,
    });
  }

  async createOnlineIntent(
    orgId: string,
    data: { orderId: string; amount: number; provider?: string },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: data.orderId, organizationId: orgId },
    });
    if (!order) throw new Error("Order not found");

    const amountRupees = data.amount >= 100 ? data.amount / 100 : data.amount;
    const provider = data.provider ?? "razorpay";

    return {
      provider,
      orderId: order.id,
      amount: amountRupees,
      currency: "INR",
      status: "pending",
      clientSecret: `pi_${order.id}_${Date.now()}`,
      message: "Payment intent created — integrate Razorpay/PhonePe keys in production",
    };
  }

  async confirmOnlinePayment(orgId: string, orderId: string, paymentRef: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
    });
    if (!order) throw new Error("Order not found");

    const cashMethod = await this.prisma.paymentMethod.findFirst({
      where: { code: "upi" },
    });

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        paymentMethodId: cashMethod?.id ?? (await this.ensureUpiMethod()).id,
        amount: order.total,
        status: "completed",
        reference: paymentRef,
        processedAt: new Date(),
      },
    });

    return { success: true, orderId: order.id };
  }

  private async ensureUpiMethod() {
    return this.prisma.paymentMethod.upsert({
      where: { code: "upi" },
      update: {},
      create: { name: "UPI", code: "upi" },
    });
  }
}
