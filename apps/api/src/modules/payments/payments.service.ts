import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface PaymentTenderInput {
  method: string;
  amount: number;
  reference?: string;
}

export interface ProcessPaymentInput {
  orderId: string;
  method: string;
  amount: number;
  reference?: string;
  gatewayRef?: string;
  tipAmount?: number;
  tenders?: PaymentTenderInput[];
}

export interface PartialPaymentInput {
  orderId: string;
  amount: number;
  method: string;
  reference?: string;
  tipAmount?: number;
}

export interface RefundPaymentInput {
  paymentId: string;
  amount?: number;
  reason?: string;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findByOrder(orderId: string) {
    return this.prisma.client.payment.findMany({
      where: { orderId },
      include: { tenders: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const payment = await this.prisma.client.payment.findUnique({
      where: { id },
      include: { tenders: true, order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async processPayment(
    organizationId: string,
    userId: string,
    input: ProcessPaymentInput,
  ) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: input.orderId, organizationId },
      include: { payments: { where: { status: 'COMPLETED' } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const paidAmount = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = order.totalAmount - paidAmount;
    if (remaining <= 0) {
      throw new BadRequestException('Order is already fully paid');
    }

    const isSplit = input.tenders && input.tenders.length > 0;
    const totalTenderAmount = isSplit
      ? input.tenders!.reduce((sum, t) => sum + t.amount, 0)
      : input.amount;

    if (totalTenderAmount > remaining) {
      throw new BadRequestException(
        `Payment amount exceeds remaining balance of ${remaining}`,
      );
    }

    const payment = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          orderId: input.orderId,
          amount: totalTenderAmount,
          method: isSplit ? 'SPLIT' : input.method,
          status: 'COMPLETED',
          reference: input.reference,
          gatewayRef: input.gatewayRef,
          tipAmount: input.tipAmount ?? 0,
          processedAt: new Date(),
          tenders: isSplit
            ? {
                create: input.tenders!.map((t) => ({
                  method: t.method,
                  amount: t.amount,
                  reference: t.reference,
                })),
              }
            : undefined,
        },
        include: { tenders: true },
      });

      const newPaid = paidAmount + totalTenderAmount;
      const isFullyPaid = newPaid >= order.totalAmount;

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: isFullyPaid ? 'COMPLETED' : order.status,
          completedAt: isFullyPaid ? new Date() : order.completedAt,
        },
      });

      return created;
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: order.outletId,
      action: 'PAYMENT_PROCESSED',
      entityType: 'Payment',
      entityId: payment.id,
      newValue: { amount: payment.amount, method: payment.method },
    });

    return payment;
  }

  async processPartialPayment(
    organizationId: string,
    userId: string,
    input: PartialPaymentInput,
  ) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: input.orderId, organizationId },
      include: { payments: { where: { status: 'COMPLETED' } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const paidAmount = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = order.totalAmount - paidAmount;

    if (input.amount <= 0 || input.amount >= remaining) {
      throw new BadRequestException(
        'Partial payment must be greater than 0 and less than remaining balance',
      );
    }

    const payment = await this.prisma.client.payment.create({
      data: {
        orderId: input.orderId,
        amount: input.amount,
        method: input.method,
        status: 'COMPLETED',
        reference: input.reference,
        tipAmount: input.tipAmount ?? 0,
        processedAt: new Date(),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: order.outletId,
      action: 'PARTIAL_PAYMENT',
      entityType: 'Payment',
      entityId: payment.id,
      newValue: { amount: input.amount, remaining: remaining - input.amount },
    });

    return {
      payment,
      paidAmount: paidAmount + input.amount,
      remainingAmount: remaining - input.amount,
    };
  }

  async refund(
    organizationId: string,
    userId: string,
    input: RefundPaymentInput,
  ) {
    const payment = await this.prisma.client.payment.findUnique({
      where: { id: input.paymentId },
      include: { order: true },
    });
    if (!payment || payment.order.organizationId !== organizationId) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status === 'REFUNDED') {
      throw new BadRequestException('Payment already refunded');
    }

    const refundAmount = input.amount ?? payment.amount;
    if (refundAmount <= 0 || refundAmount > payment.amount) {
      throw new BadRequestException('Invalid refund amount');
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: refundAmount >= payment.amount ? 'REFUNDED' : 'PARTIAL',
        },
      });

      const refund = await tx.payment.create({
        data: {
          orderId: payment.orderId,
          amount: -refundAmount,
          method: payment.method,
          status: 'REFUNDED',
          reference: input.reason ?? 'REFUND',
          processedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: 'REFUNDED' },
      });

      return { updated, refund };
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: payment.order.outletId,
      action: 'PAYMENT_REFUNDED',
      entityType: 'Payment',
      entityId: payment.id,
      newValue: { refundAmount, reason: input.reason },
    });

    return result;
  }
}
