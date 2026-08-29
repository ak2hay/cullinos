import { Injectable } from "@nestjs/common";
import { calculateGst } from "@cullinos/tax-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";

type CreateOrderDto = {
  outletId: string;
  type?: string;
  source?: string;
  tableId?: string;
  customerId?: string;
  guestCount?: number;
  notes?: string;
  items: Array<{
    menuItemId?: string;
    variantId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  idempotencyKey?: string;
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService, private ws: WebsocketGateway) {}

  async list(orgId: string, outletId?: string) {
    return this.prisma.order.findMany({
      where: { organizationId: orgId, ...(outletId ? { outletId } : {}) },
      include: { items: true, table: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async create(orgId: string, userId: string, dto: CreateOrderDto) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true },
      });
      if (existing) return existing;
    }

    const count = await this.prisma.order.count({ where: { outletId: dto.outletId } });
    const orderNumber = String(count + 1);

    const subtotal = dto.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const taxResult = calculateGst(
      dto.items.map((i) => ({ amount: i.unitPrice * i.quantity })),
      [{ name: "GST", rate: 5, type: "CGST" }],
      false
    );

    const order = await this.prisma.order.create({
      data: {
        organizationId: orgId,
        outletId: dto.outletId,
        orderNumber,
        type: (dto.type as never) || "dine_in",
        source: (dto.source as never) || "pos",
        status: "confirmed",
        tableId: dto.tableId,
        customerId: dto.customerId,
        createdById: userId,
        guestCount: dto.guestCount,
        notes: dto.notes,
        subtotal: subtotal,
        taxTotal: taxResult.taxTotal,
        total: taxResult.total,
        idempotencyKey: dto.idempotencyKey,
        items: {
          create: dto.items.map((item) => ({
            menuItemId: item.menuItemId,
            variantId: item.variantId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxAmount: item.unitPrice * item.quantity * 0.05,
            total: item.unitPrice * item.quantity * 1.05,
          })),
        },
        timeline: { create: { event: "order.created", metadata: { source: dto.source } } },
        taxLines: {
          create: taxResult.taxLines.map((t) => ({
            taxName: t.name,
            rate: t.rate,
            amount: t.amount,
          })),
        },
      },
      include: { items: true, taxLines: true },
    });

    const kot = await this.prisma.kOT.create({
      data: {
        orderId: order.id,
        kotNumber: `K${orderNumber}`,
        status: "pending",
        items: {
          create: order.items.map((item) => ({
            orderItemId: item.id,
            status: "pending",
          })),
        },
      },
      include: { items: true },
    });

    this.ws.emitToOutlet(dto.outletId, "kot.created", { order, kot });
    return { order, kot };
  }

  async updateStatus(orgId: string, orderId: string, status: string) {
    const order = await this.prisma.order.update({
      where: { id: orderId, organizationId: orgId },
      data: {
        status: status as never,
        completedAt: status === "completed" ? new Date() : undefined,
        timeline: { create: { event: "order.status_changed", metadata: { status } } },
      },
      include: { items: true },
    });
    this.ws.emitToOutlet(order.outletId, "order.updated", order);
    return order;
  }
}
