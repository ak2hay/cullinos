import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { calculateTax, TaxGroup } from '@cullinos/tax-engine';
import { DOMAIN_EVENTS } from '@cullinos/events';
import { OrderStatus, PaginatedResponse } from '@cullinos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { toInputJson } from '../../common/utils/prisma-json';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../../events/events.service';
import { WebsocketGateway } from '../../websocket/websocket.gateway';
import { KotService } from '../kot/kot.service';
import {
  CreateOrderDto,
  AddOrderItemsDto,
  ApplyDiscountDto,
  CancelOrderDto,
  ListOrdersQueryDto,
  CreateOrderItemDto,
} from './dto/orders.dto';

const IDEMPOTENCY_TTL_HOURS = 24;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventsService,
    private readonly websocket: WebsocketGateway,
    private readonly kotService: KotService,
  ) {}

  async createOrder(
    organizationId: string,
    userId: string,
    dto: CreateOrderDto,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const cached = await this.prisma.client.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });
      if (cached) {
        if (cached.expiresAt > new Date()) {
          return cached.response;
        }
        await this.prisma.client.idempotencyKey.delete({ where: { key: idempotencyKey } });
      }
    }

    const outlet = await this.prisma.client.outlet.findFirst({
      where: { id: dto.outletId, organizationId, deletedAt: null },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    if (dto.tableId) {
      await this.prisma.client.table.update({
        where: { id: dto.tableId },
        data: { status: 'OCCUPIED' },
      });
    }

    const orderNumber = await this.generateOrderNumber(dto.outletId);

    const order = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          organizationId,
          outletId: dto.outletId,
          orderNumber,
          source: dto.source,
          orderType: dto.orderType ?? 'DINE_IN',
          status: 'DRAFT',
          tableId: dto.tableId,
          customerId: dto.customerId,
          notes: dto.notes,
        },
      });

      await tx.orderTimeline.create({
        data: {
          orderId: created.id,
          status: 'DRAFT',
          notes: 'Order created',
          userId,
        },
      });

      if (dto.items?.length) {
        await this.addItemsToOrder(tx, organizationId, dto.outletId, created.id, dto.items);
      }

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: { items: true, timeline: true, table: true },
      });
    });

    const recalculated = await this.recalculateOrderTotals(order.id);

    await this.events.publish({
      type: DOMAIN_EVENTS.ORDER_CREATED,
      organizationId,
      outletId: dto.outletId,
      payload: {
        orderId: recalculated.id,
        orderNumber: recalculated.orderNumber,
        source: recalculated.source,
        totalAmount: recalculated.totalAmount,
      },
    });

    this.websocket.emitOrderCreated(dto.outletId, {
      orderId: recalculated.id,
      orderNumber: recalculated.orderNumber,
      status: recalculated.status,
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: dto.outletId,
      action: 'CREATE',
      entityType: 'Order',
      entityId: recalculated.id,
      newValue: { orderNumber, source: dto.source },
    });

    if (idempotencyKey) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + IDEMPOTENCY_TTL_HOURS);
      await this.prisma.client.idempotencyKey.create({
        data: {
          key: idempotencyKey,
          response: toInputJson(recalculated) ?? {},
          expiresAt,
        },
      });
    }

    return recalculated;
  }

  async confirmOrder(organizationId: string, userId: string, orderId: string) {
    const order = await this.getOrder(organizationId, orderId);
    this.assertStatusTransition(order.status, ['DRAFT', 'HELD'], 'CONFIRMED');

    const updated = await this.transitionOrder(orderId, 'CONFIRMED', userId, 'Order confirmed');

    await this.events.publish({
      type: DOMAIN_EVENTS.ORDER_CONFIRMED,
      organizationId,
      outletId: order.outletId,
      payload: { orderId, orderNumber: order.orderNumber },
    });

    const kots = await this.kotService.generateKotsFromOrder(organizationId, orderId, userId);

    this.websocket.emitOrderUpdate(order.outletId, {
      orderId,
      status: 'CONFIRMED',
      kotsGenerated: kots.length,
    });

    return { order: updated, kots };
  }

  async holdOrder(organizationId: string, userId: string, orderId: string) {
    const order = await this.getOrder(organizationId, orderId);
    this.assertStatusTransition(order.status, ['DRAFT', 'CONFIRMED'], 'HELD');

    const updated = await this.prisma.client.order.update({
      where: { id: orderId },
      data: { isHeld: true, status: 'HELD' },
    });

    await this.prisma.client.orderTimeline.create({
      data: { orderId, status: 'HELD', notes: 'Order held', userId },
    });

    this.websocket.emitOrderUpdate(order.outletId, { orderId, status: 'HELD' });
    return updated;
  }

  async resumeOrder(organizationId: string, userId: string, orderId: string) {
    const order = await this.getOrder(organizationId, orderId);
    if (order.status !== 'HELD') {
      throw new BadRequestException('Only held orders can be resumed');
    }

    const updated = await this.prisma.client.order.update({
      where: { id: orderId },
      data: { isHeld: false, status: 'DRAFT' },
    });

    await this.prisma.client.orderTimeline.create({
      data: { orderId, status: 'DRAFT', notes: 'Order resumed', userId },
    });

    this.websocket.emitOrderUpdate(order.outletId, { orderId, status: 'DRAFT' });
    return updated;
  }

  async cancelOrder(
    organizationId: string,
    userId: string,
    orderId: string,
    dto: CancelOrderDto,
  ) {
    const order = await this.getOrder(organizationId, orderId);
    if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    const updated = await this.prisma.client.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.reason,
      },
    });

    await this.prisma.client.orderTimeline.create({
      data: {
        orderId,
        status: 'CANCELLED',
        notes: dto.reason ?? 'Order cancelled',
        userId,
      },
    });

    if (order.tableId) {
      await this.prisma.client.table.update({
        where: { id: order.tableId },
        data: { status: 'AVAILABLE' },
      });
    }

    await this.events.publish({
      type: DOMAIN_EVENTS.ORDER_CANCELLED,
      organizationId,
      outletId: order.outletId,
      payload: { orderId, reason: dto.reason },
    });

    this.websocket.emitOrderUpdate(order.outletId, { orderId, status: 'CANCELLED' });
    return updated;
  }

  async completeOrder(organizationId: string, userId: string, orderId: string) {
    const order = await this.getOrder(organizationId, orderId);
    this.assertStatusTransition(order.status, ['CONFIRMED', 'READY', 'SERVED'], 'COMPLETED');

    const updated = await this.transitionOrder(orderId, 'COMPLETED', userId, 'Order completed');

    await this.prisma.client.order.update({
      where: { id: orderId },
      data: { completedAt: new Date() },
    });

    if (order.tableId) {
      await this.prisma.client.table.update({
        where: { id: order.tableId },
        data: { status: 'AVAILABLE' },
      });
    }

    await this.events.publish({
      type: DOMAIN_EVENTS.ORDER_COMPLETED,
      organizationId,
      outletId: order.outletId,
      payload: { orderId, totalAmount: order.totalAmount },
    });

    this.websocket.emitOrderUpdate(order.outletId, { orderId, status: 'COMPLETED' });
    return updated;
  }

  async addItems(
    organizationId: string,
    userId: string,
    orderId: string,
    dto: AddOrderItemsDto,
  ) {
    const order = await this.getOrder(organizationId, orderId);
    if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.status)) {
      throw new BadRequestException('Cannot modify completed or cancelled order');
    }

    await this.prisma.client.$transaction(async (tx) => {
      await this.addItemsToOrder(tx, organizationId, order.outletId, orderId, dto.items);
    });

    const updated = await this.recalculateOrderTotals(orderId);

    await this.events.publish({
      type: DOMAIN_EVENTS.ORDER_UPDATED,
      organizationId,
      outletId: order.outletId,
      payload: { orderId, action: 'items_added' },
    });

    this.websocket.emitOrderUpdate(order.outletId, { orderId, action: 'items_added' });
    return updated;
  }

  async removeItem(organizationId: string, userId: string, orderId: string, itemId: string) {
    const order = await this.getOrder(organizationId, orderId);
    if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.status)) {
      throw new BadRequestException('Cannot modify completed or cancelled order');
    }

    const item = await this.prisma.client.orderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!item) throw new NotFoundException('Order item not found');

    await this.prisma.client.orderItem.delete({ where: { id: itemId } });
    const updated = await this.recalculateOrderTotals(orderId);

    this.websocket.emitOrderUpdate(order.outletId, { orderId, action: 'item_removed', itemId });
    return updated;
  }

  async applyDiscount(
    organizationId: string,
    userId: string,
    orderId: string,
    dto: ApplyDiscountDto,
  ) {
    const order = await this.getOrder(organizationId, orderId);
    if (dto.discountAmount > order.subtotal) {
      throw new BadRequestException('Discount exceeds subtotal');
    }

    await this.prisma.client.order.update({
      where: { id: orderId },
      data: { discountAmount: dto.discountAmount },
    });

    const updated = await this.recalculateOrderTotals(orderId);

    await this.audit.log({
      organizationId,
      userId,
      outletId: order.outletId,
      action: 'DISCOUNT',
      entityType: 'Order',
      entityId: orderId,
      newValue: { discountAmount: dto.discountAmount, reason: dto.reason },
    });

    this.websocket.emitOrderUpdate(order.outletId, {
      orderId,
      discountAmount: dto.discountAmount,
    });
    return updated;
  }

  async listOrders(
    organizationId: string,
    query: ListOrdersQueryDto,
  ): Promise<PaginatedResponse<unknown>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      organizationId,
      ...(query.outletId ? { outletId: query.outletId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.tableId ? { tableId: query.tableId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.client.order.findMany({
        where,
        include: {
          items: true,
          table: true,
          timeline: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.client.order.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, hasMore: skip + data.length < total },
    };
  }

  async getOrder(organizationId: string, orderId: string) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        items: true,
        timeline: { orderBy: { createdAt: 'asc' } },
        table: true,
        kots: { include: { items: true } },
        payments: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async transitionOrder(
    orderId: string,
    status: OrderStatus,
    userId: string,
    notes: string,
  ) {
    const updated = await this.prisma.client.order.update({
      where: { id: orderId },
      data: { status, isHeld: false },
    });
    await this.prisma.client.orderTimeline.create({
      data: { orderId, status, notes, userId },
    });
    return updated;
  }

  private assertStatusTransition(
    current: string,
    allowed: string[],
    target: string,
  ) {
    if (!allowed.includes(current)) {
      throw new ConflictException(
        `Cannot transition from ${current} to ${target}`,
      );
    }
  }

  private async generateOrderNumber(outletId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const count = await this.prisma.client.order.count({
      where: { outletId, createdAt: { gte: startOfDay } },
    });
    return `ORD-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  private async addItemsToOrder(
    tx: Parameters<Parameters<typeof this.prisma.client.$transaction>[0]>[0],
    organizationId: string,
    outletId: string,
    orderId: string,
    items: CreateOrderItemDto[],
  ) {
    for (const item of items) {
      const menuItem = await tx.menuItem.findFirst({
        where: { id: item.menuItemId, organizationId, deletedAt: null },
        include: {
          taxGroup: { include: { taxRates: true } },
          outletPrices: { where: { outletId } },
          variants: item.variantId ? { where: { id: item.variantId } } : undefined,
        },
      });

      if (!menuItem) throw new NotFoundException(`Menu item ${item.menuItemId} not found`);

      const outletPrice = menuItem.outletPrices[0];
      let unitPrice = outletPrice?.price ?? menuItem.basePrice;

      if (item.variantId) {
        const variant = menuItem.variants?.find((v) => v.id === item.variantId);
        if (!variant) throw new NotFoundException('Variant not found');
        unitPrice = variant.price;
      }

      const modifierTotal =
        item.modifiers?.reduce((sum, m) => sum + m.price, 0) ?? 0;
      const lineSubtotal = (unitPrice + modifierTotal) * item.quantity;

      let taxAmount = 0;
      if (menuItem.taxGroup) {
        const taxGroup: TaxGroup = {
          id: menuItem.taxGroup.id,
          name: menuItem.taxGroup.name,
          isInclusive: menuItem.taxGroup.isInclusive,
          rates: menuItem.taxGroup.taxRates.map((r) => ({
            name: r.name,
            rate: r.rate,
            type: r.type as TaxGroup['rates'][0]['type'],
          })),
        };
        const taxResult = calculateTax({ amount: lineSubtotal, taxGroup });
        taxAmount = taxResult.taxAmount;
      }

      const totalPrice = lineSubtotal + (menuItem.taxGroup?.isInclusive ? 0 : taxAmount);

      await tx.orderItem.create({
        data: {
          orderId,
          menuItemId: item.menuItemId,
          variantId: item.variantId,
          name: menuItem.name,
          quantity: item.quantity,
          unitPrice,
          modifiers: toInputJson(item.modifiers ?? []) ?? [],
          taxAmount,
          totalPrice,
          notes: item.notes,
        },
      });
    }
  }

  private async recalculateOrderTotals(orderId: string) {
    const items = await this.prisma.client.orderItem.findMany({ where: { orderId } });
    const order = await this.prisma.client.order.findUniqueOrThrow({ where: { id: orderId } });

    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const taxAmount = items.reduce((sum, i) => sum + i.taxAmount, 0);
    const itemDiscount = items.reduce((sum, i) => sum + i.discount, 0);
    const totalAmount = subtotal + taxAmount + order.serviceCharge + order.tipAmount
      - order.discountAmount - itemDiscount;

    return this.prisma.client.order.update({
      where: { id: orderId },
      data: {
        subtotal,
        taxAmount,
        totalAmount: Math.max(0, totalAmount),
      },
      include: { items: true, timeline: true, table: true },
    });
  }
}
