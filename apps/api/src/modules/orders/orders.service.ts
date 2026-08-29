import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";
import {
  IncomingOrderItem,
  mapOrderToClient,
  resolveOrderItems,
} from "../../common/order-items.util";
import { fromApiStatus } from "../../common/status.util";

type TaxLineResult = { name: string; rate: number; amount: number; type?: string };

function calculateOrderTax(subtotal: number): {
  taxTotal: number;
  total: number;
  taxLines: TaxLineResult[];
} {
  const rate = 5;
  const cgst = subtotal * (rate / 200);
  const sgst = subtotal * (rate / 200);
  const taxLines: TaxLineResult[] = [
    { name: "CGST", rate: rate / 2, amount: cgst, type: "CGST" },
    { name: "SGST", rate: rate / 2, amount: sgst, type: "SGST" },
  ];
  const taxTotal = cgst + sgst;
  return { taxTotal, total: subtotal + taxTotal, taxLines };
}

type CreateOrderDto = {
  outletId: string;
  type?: string;
  source?: string;
  tableId?: string;
  customerId?: string;
  customerName?: string;
  guestCount?: number;
  notes?: string;
  tipAmount?: number;
  scheduledPickupAt?: string;
  items?: IncomingOrderItem[];
  idempotencyKey?: string;
  autoConfirm?: boolean;
};

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService, private ws: WebsocketGateway) {}

  async list(
    orgId: string,
    filters: {
      outletId?: string;
      tableId?: string;
      status?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
      organizationId: orgId,
      ...(filters.outletId ? { outletId: filters.outletId } : {}),
      ...(filters.tableId ? { tableId: filters.tableId } : {}),
      ...(filters.status
        ? { status: fromApiStatus(filters.status) as never }
        : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true, table: true, customer: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => mapOrderToClient(order)),
      meta: { total, page, limit },
    };
  }

  async get(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: { items: true, table: true, customer: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return mapOrderToClient(order);
  }

  async create(orgId: string, userId: string | null, dto: CreateOrderDto) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true },
      });
      if (existing) return mapOrderToClient(existing);
    }

    const outlet = await this.prisma.outlet.findFirst({
      where: { id: dto.outletId, organizationId: orgId },
    });
    if (!outlet) throw new BadRequestException("Invalid outlet");

    const resolvedItems = await resolveOrderItems(
      this.prisma,
      orgId,
      dto.outletId,
      dto.items ?? [],
    );

    const count = await this.prisma.order.count({ where: { outletId: dto.outletId } });
    const orderNumber = String(count + 1).padStart(4, "0");

    const subtotal = resolvedItems.reduce(
      (s, i) => s + i.unitPrice * i.quantity,
      0,
    );
    const tipRupees = dto.tipAmount
      ? dto.tipAmount >= 100
        ? dto.tipAmount / 100
        : dto.tipAmount
      : 0;
    const taxResult = calculateOrderTax(subtotal);
    const totalWithTip = taxResult.total + tipRupees;
    const source = this.normalizeSource(dto.source);
    const type = this.normalizeType(dto.type, dto.source, dto.tableId);
    const initialStatus = dto.autoConfirm ? "confirmed" : "draft";

    const order = await this.prisma.order.create({
      data: {
        organizationId: orgId,
        outletId: dto.outletId,
        orderNumber,
        type: type as never,
        source: source as never,
        status: initialStatus as never,
        tableId: dto.tableId,
        customerId: dto.customerId,
        createdById: userId,
        guestCount: dto.guestCount,
        customerName: dto.customerName,
        scheduledPickupAt: dto.scheduledPickupAt
          ? new Date(dto.scheduledPickupAt)
          : undefined,
        notes: dto.notes,
        subtotal,
        taxTotal: taxResult.taxTotal,
        tipAmount: tipRupees,
        total: totalWithTip,
        idempotencyKey: dto.idempotencyKey,
        items: {
          create: resolvedItems.map((item) => ({
            menuItemId: item.menuItemId,
            variantId: item.variantId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxAmount: item.unitPrice * item.quantity * 0.05,
            total: item.unitPrice * item.quantity * 1.05,
            notes: item.notes,
            modifiers: item.modifiers ?? undefined,
          })),
        },
        timeline: {
          create: { event: "order.created", metadata: { source: dto.source } },
        },
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

    if (dto.tableId) {
      await this.prisma.table.update({
        where: { id: dto.tableId },
        data: { status: "occupied" },
      });
    }

    let kot = null;
    if (initialStatus === "confirmed") {
      kot = await this.createKot(order);
    }

    const mapped = mapOrderToClient(order);
    this.ws.emitToOutlet(dto.outletId, "order.updated", mapped);
    if (kot) {
      this.ws.emitToOutlet(dto.outletId, "kot.created", { order: mapped, kot });
    }
    return mapped;
  }

  async addItems(
    orgId: string,
    orderId: string,
    items: IncomingOrderItem[],
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (["completed", "cancelled", "voided"].includes(order.status)) {
      throw new BadRequestException("Cannot modify a closed order");
    }

    const resolvedItems = await resolveOrderItems(
      this.prisma,
      orgId,
      order.outletId,
      items,
    );

    await this.prisma.orderItem.createMany({
      data: resolvedItems.map((item) => ({
        orderId: order.id,
        menuItemId: item.menuItemId,
        variantId: item.variantId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxAmount: item.unitPrice * item.quantity * 0.05,
        total: item.unitPrice * item.quantity * 1.05,
        notes: item.notes,
        modifiers: item.modifiers ?? undefined,
      })),
    });

    const allItems = await this.prisma.orderItem.findMany({ where: { orderId } });
    const subtotal = allItems.reduce(
      (s, i) => s + Number(i.unitPrice) * i.quantity,
      0,
    );
    const taxResult = calculateOrderTax(subtotal);

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        taxTotal: taxResult.taxTotal,
        total: taxResult.total,
        timeline: {
          create: { event: "order.items_added", metadata: { count: items.length } },
        },
      },
      include: { items: true },
    });

    const mapped = mapOrderToClient(updated);
    this.ws.emitToOutlet(order.outletId, "order.updated", mapped);
    return mapped;
  }

  async confirm(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "draft") {
      return mapOrderToClient(order);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: "confirmed",
        timeline: { create: { event: "order.confirmed", metadata: {} } },
      },
      include: { items: true },
    });

    const kot = await this.createKot(updated);
    const mapped = mapOrderToClient(updated);
    this.ws.emitToOutlet(order.outletId, "order.updated", mapped);
    this.ws.emitToOutlet(order.outletId, "kot.created", { order: mapped, kot });
    return mapped;
  }

  async updateStatus(orgId: string, orderId: string, status: string) {
    const order = await this.prisma.order.update({
      where: { id: orderId, organizationId: orgId },
      data: {
        status: fromApiStatus(status) as never,
        completedAt: fromApiStatus(status) === "completed" ? new Date() : undefined,
        timeline: {
          create: { event: "order.status_changed", metadata: { status } },
        },
      },
      include: { items: true },
    });
    const mapped = mapOrderToClient(order);
    this.ws.emitToOutlet(order.outletId, "order.updated", mapped);
    if (fromApiStatus(status) === "ready") {
      this.ws.emitToOutlet(order.outletId, "order.ready", mapped);
    }
    return mapped;
  }

  async hold(orgId: string, orderId: string) {
    return this.updateStatus(orgId, orderId, "DRAFT");
  }

  async resume(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "draft") {
      return mapOrderToClient(order);
    }
    return this.confirm(orgId, orderId);
  }

  async getPickupQueue(orgId: string, outletId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        organizationId: orgId,
        outletId,
        status: { in: ["confirmed", "preparing", "ready"] },
        type: { in: ["takeaway", "qr", "online"] },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: { items: true },
    });
    return orders.map((o) => mapOrderToClient(o));
  }

  private async createKot(order: { id: string; orderNumber: string; items: { id: string }[] }) {
    return this.prisma.kOT.create({
      data: {
        orderId: order.id,
        kotNumber: `K${order.orderNumber}`,
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
  }

  private normalizeSource(source?: string) {
    const map: Record<string, string> = {
      WAITER: "waiter",
      POS: "pos",
      QR: "customer",
      ONLINE: "customer",
      CUSTOMER: "customer",
    };
    return map[source?.toUpperCase() ?? ""] ?? "pos";
  }

  private normalizeType(type?: string, source?: string, tableId?: string) {
    if (type) return type.toLowerCase();
    const src = source?.toUpperCase();
    if (src === "QR" || (tableId && src !== "ONLINE")) return "qr";
    if (src === "ONLINE") return "online";
    if (tableId) return "dine_in";
    return "takeaway";
  }
}
