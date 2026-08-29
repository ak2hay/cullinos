import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async nextInvoiceNumber(outletId: string): Promise<string> {
    const count = await this.prisma.client.invoice.count({
      where: { order: { outletId } },
    });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `INV-${date}-${String(count + 1).padStart(5, '0')}`;
  }

  private async nextCreditNoteNumber(outletId: string): Promise<string> {
    const orders = await this.prisma.client.order.findMany({
      where: { outletId },
      select: { id: true },
    });
    const orderIds = orders.map((o) => o.id);
    const count = await this.prisma.client.creditNote.count({
      where: { orderId: { in: orderIds } },
    });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `CN-${date}-${String(count + 1).padStart(5, '0')}`;
  }

  private async getOrderForBilling(orderId: string, organizationId: string) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        items: { include: { menuItem: { include: { taxGroup: { include: { taxRates: true } } } } } },
        payments: { where: { status: 'COMPLETED' } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private buildTaxBreakdown(order: Awaited<ReturnType<typeof this.getOrderForBilling>>) {
    const breakdown: Record<string, { name: string; type: string; rate: number; amount: number }> = {};
    for (const item of order.items) {
      const rates = item.menuItem.taxGroup?.taxRates ?? [];
      for (const rate of rates) {
        const key = rate.type;
        const lineAmount = Math.round(item.totalPrice * (rate.rate / 100));
        if (!breakdown[key]) {
          breakdown[key] = { name: rate.name, type: rate.type, rate: rate.rate, amount: 0 };
        }
        breakdown[key].amount += lineAmount;
      }
    }
    return Object.values(breakdown);
  }

  async generateInvoice(
    organizationId: string,
    userId: string,
    orderId: string,
  ) {
    const order = await this.getOrderForBilling(orderId, organizationId);

    const existing = await this.prisma.client.invoice.findFirst({
      where: { orderId, type: 'INVOICE' },
    });
    if (existing) return existing;

    const invoice = await this.prisma.client.invoice.create({
      data: {
        orderId,
        invoiceNumber: await this.nextInvoiceNumber(order.outletId),
        type: 'INVOICE',
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        totalAmount: order.totalAmount,
        taxBreakdown: this.buildTaxBreakdown(order),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: order.outletId,
      action: 'INVOICE_GENERATED',
      entityType: 'Invoice',
      entityId: invoice.id,
    });

    return invoice;
  }

  async generateTaxInvoice(
    organizationId: string,
    userId: string,
    orderId: string,
  ) {
    const order = await this.getOrderForBilling(orderId, organizationId);
    const paidAmount = order.payments.reduce((sum, p) => sum + p.amount, 0);

    if (paidAmount < order.totalAmount) {
      throw new BadRequestException('Order must be fully paid before tax invoice');
    }

    const existing = await this.prisma.client.invoice.findFirst({
      where: { orderId, type: 'TAX_INVOICE' },
    });
    if (existing) return existing;

    const invoice = await this.prisma.client.invoice.create({
      data: {
        orderId,
        invoiceNumber: await this.nextInvoiceNumber(order.outletId),
        type: 'TAX_INVOICE',
        subtotal: order.subtotal,
        taxAmount: order.taxAmount,
        totalAmount: order.totalAmount,
        taxBreakdown: this.buildTaxBreakdown(order),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: order.outletId,
      action: 'TAX_INVOICE_GENERATED',
      entityType: 'Invoice',
      entityId: invoice.id,
    });

    return invoice;
  }

  async generateCreditNote(
    organizationId: string,
    userId: string,
    orderId: string,
    amount: number,
    reason?: string,
  ) {
    const order = await this.getOrderForBilling(orderId, organizationId);

    if (amount <= 0 || amount > order.totalAmount) {
      throw new BadRequestException('Invalid credit note amount');
    }

    const creditNote = await this.prisma.client.creditNote.create({
      data: {
        orderId,
        creditNoteNumber: await this.nextCreditNoteNumber(order.outletId),
        amount,
        reason,
        taxBreakdown: this.buildTaxBreakdown(order),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: order.outletId,
      action: 'CREDIT_NOTE_GENERATED',
      entityType: 'CreditNote',
      entityId: creditNote.id,
      newValue: { amount, reason },
    });

    return creditNote;
  }

  async findInvoicesByOrder(orderId: string) {
    return this.prisma.client.invoice.findMany({
      where: { orderId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  async findCreditNotesByOrder(orderId: string) {
    return this.prisma.client.creditNote.findMany({
      where: { orderId },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
