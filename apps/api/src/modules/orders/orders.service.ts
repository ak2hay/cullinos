import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Optional,
} from "@nestjs/common";
import { calculateMixedGst, type TaxLineInput } from "@cullinos/tax-engine";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";
import {
  IncomingOrderItem,
  mapOrderToClient,
  resolveOrderItems,
  type ResolvedOrderItem,
} from "../../common/order-items.util";
import { generatePickupCode } from "../../common/pickup-code.util";
import { normalizeOrderStatusFilter } from "../../common/status.util";
import { toPaise } from "../../common/money.util";
import { orderGrandTotal, orderLineTotal, pickDefaultTaxGroup } from "./order-tax.util";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { GuestPushService } from "../guest/guest-push.service";
import { RecipesService } from "../recipes/recipes.service";
import { MailService } from "../mail/mail.service";
import { Msg91Service } from "../sms/msg91.service";
import { FeedbackService } from "../feedback/feedback.service";

type TaxComputation = {
  subtotal: number;
  taxTotal: number;
  total: number;
  taxLines: Array<{ name: string; rate: number; amount: number; type?: string }>;
  itemTaxes: number[];
  itemInclusive: boolean[];
};

const ORDER_CLIENT_INCLUDE = {
  items: true,
  table: true,
  customer: true,
  taxLines: true,
} as const;

const TERMINAL_ORDER_STATUSES = ["completed", "cancelled", "voided"];

type CreateOrderDto = {
  outletId: string;
  type?: string;
  source?: string;
  tableId?: string;
  tableSessionId?: string;
  customerId?: string;
  customerName?: string;
  guestCount?: number;
  notes?: string;
  tipAmount?: number;
  scheduledPickupAt?: string;
  items?: IncomingOrderItem[];
  idempotencyKey?: string;
  autoConfirm?: boolean;
  publicOrder?: boolean;
  /** Delivery fields (public guest / online) */
  deliveryAddress?: string;
  deliveryPincode?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryZoneId?: string;
  deliveryFee?: number;
  metadata?: Record<string, unknown>;
  /** Guest / public checkout coupon */
  couponCode?: string;
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private ws: WebsocketGateway,
    @Optional()
    @Inject(forwardRef(() => LoyaltyService))
    private loyalty?: LoyaltyService,
    @Optional()
    @Inject(forwardRef(() => GuestPushService))
    private guestPush?: GuestPushService,
    @Optional()
    private recipes?: RecipesService,
    @Optional()
    private mail?: MailService,
    @Optional()
    private sms?: Msg91Service,
    @Optional()
    private feedback?: FeedbackService,
  ) {}

  private async computeTax(
    orgId: string,
    resolvedItems: ResolvedOrderItem[],
  ): Promise<TaxComputation> {
    const [groups, settingsRow] = await Promise.all([
      this.prisma.taxGroup.findMany({
        where: { organizationId: orgId },
        include: { rates: true },
      }),
      this.prisma.organizationSettings.findUnique({
        where: { organizationId: orgId },
        select: { settings: true },
      }),
    ]);
    const settings = (settingsRow?.settings ?? {}) as Record<string, unknown>;
    const configuredDefault =
      typeof settings.defaultTaxGroupId === "string" ? settings.defaultTaxGroupId : null;
    const defaultGroup = pickDefaultTaxGroup(groups, configuredDefault);

    const groupById = new Map(groups.map((g) => [g.id, g]));

    const inclusiveFlags: boolean[] = [];
    const taxable = resolvedItems.map((item) => {
      const group =
        (item.taxGroupId ? groupById.get(item.taxGroupId) : undefined) ??
        defaultGroup ??
        null;
      inclusiveFlags.push(Boolean(group?.isInclusive && group.rates.length));
      const rates: TaxLineInput[] = (group?.rates ?? []).map((r) => ({
        name: r.name,
        rate: Number(r.rate),
        type: r.type,
      }));
      return {
        amountPaise: toPaise(item.unitPrice * item.quantity),
        rates,
        isInclusive: group?.isInclusive ?? false,
      };
    });

    const result = calculateMixedGst(taxable, false);
    return {
      subtotal: result.subtotal,
      taxTotal: result.taxTotal,
      total: result.total,
      taxLines: result.taxLines,
      itemTaxes: result.itemTaxes,
      itemInclusive: inclusiveFlags,
    };
  }

  /**
   * Recompute every line's tax from its menu item's tax group, persist per-line tax/total,
   * and rewrite order totals + taxLines from the same engine result so they cannot drift.
   */
  private async recomputeOrderFromItems(orgId: string, orderId: string, event: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
    });
    if (!order) throw new NotFoundException("Order not found");

    const allItems = await this.prisma.orderItem.findMany({
      where: { orderId },
      include: { menuItem: { select: { taxGroupId: true } } },
      orderBy: { id: "asc" },
    });
    const tax = await this.computeTax(
      orgId,
      allItems.map((i) => ({
        menuItemId: i.menuItemId,
        variantId: i.variantId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        notes: i.notes,
        modifiers: null,
        taxGroupId: i.menuItem?.taxGroupId ?? null,
      })),
    );

    await this.prisma.$transaction(
      allItems.map((item, index) => {
        const taxAmount = tax.itemTaxes[index] ?? 0;
        return this.prisma.orderItem.update({
          where: { id: item.id },
          data: {
            taxAmount,
            total: orderLineTotal(
              Number(item.unitPrice) * item.quantity,
              taxAmount,
              tax.itemInclusive[index] ?? false,
            ),
          },
        });
      }),
    );

    const meta = (order.metadata ?? {}) as Record<string, unknown>;
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        subtotal: tax.subtotal,
        taxTotal: tax.taxTotal,
        total: orderGrandTotal({
          subtotal: tax.subtotal,
          taxTotal: tax.taxTotal,
          tipAmount: Number(order.tipAmount ?? 0),
          deliveryFee: Number(meta.deliveryFee ?? 0),
          discountTotal: Number(order.discountTotal ?? 0),
        }),
        timeline: { create: { event, metadata: {} } },
        taxLines: {
          deleteMany: {},
          create: tax.taxLines.map((t) => ({
            taxName: t.name,
            rate: t.rate,
            amount: t.amount,
          })),
        },
      },
      include: ORDER_CLIENT_INCLUDE,
    });

    const mapped = mapOrderToClient(updated);
    this.ws.emitToOutlet(order.outletId, "order.updated", mapped);
    return mapped;
  }

  async list(
    orgId: string,
    filters: {
      outletId?: string;
      tableId?: string;
      status?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(Math.max(1, filters.limit ?? 50), 100);
    const skip = (page - 1) * limit;

    const statusParts = [
      ...new Set(
        (filters.status ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => normalizeOrderStatusFilter(s)),
      ),
    ];
    const statusFilter =
      statusParts.length > 0
        ? statusParts.length === 1
          ? { status: statusParts[0] as never }
          : { status: { in: statusParts as never[] } }
        : {};

    const createdAt: { gte?: Date; lt?: Date } = {};
    if (filters.from) createdAt.gte = parseDateFilter(filters.from, "from");
    if (filters.to) createdAt.lt = parseDateFilter(filters.to, "to");

    const where = {
      organizationId: orgId,
      ...(filters.outletId ? { outletId: filters.outletId } : {}),
      ...(filters.tableId ? { tableId: filters.tableId } : {}),
      ...statusFilter,
      ...(createdAt.gte || createdAt.lt ? { createdAt } : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: ORDER_CLIENT_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => mapOrderToClient(order)),
      meta: { total, page, limit, hasMore: skip + orders.length < total },
    };
  }

  async get(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: ORDER_CLIENT_INCLUDE,
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
      { publicOrder: Boolean(dto.publicOrder) },
    );

    const count = await this.prisma.order.count({ where: { outletId: dto.outletId } });
    const orderNumber = String(count + 1).padStart(4, "0");
    const pickupCode = await this.allocatePickupCode(dto.outletId);

    const tipRupees = dto.tipAmount
      ? dto.tipAmount >= 100
        ? dto.tipAmount / 100
        : dto.tipAmount
      : 0;
    const taxResult = await this.computeTax(orgId, resolvedItems);
    const source = this.normalizeSource(dto.source);
    const type = this.normalizeType(dto.type, dto.source, dto.tableId);

    let deliveryFee = 0;
    let deliveryQuote: {
      inZone: boolean;
      fee: number;
      minOrder: number;
      estimatedMinutes: number | null;
      zoneId: string | null;
    } | null = null;

    if (type === "delivery") {
      if (!dto.deliveryAddress?.trim()) {
        throw new BadRequestException("deliveryAddress is required for delivery orders");
      }
      const zones = await this.prisma.deliveryZone.findMany({
        where: { outletId: dto.outletId },
        take: 100,
      });
      const pincode = dto.deliveryPincode?.trim();
      let matched = pincode
        ? zones.find((z) => {
            const poly = (z.polygon ?? {}) as Record<string, unknown>;
            return String(poly.pincode ?? "") === pincode;
          })
        : dto.deliveryZoneId
          ? zones.find((z) => z.id === dto.deliveryZoneId)
          : zones.length === 1
            ? zones[0]
            : undefined;
      if (!matched) {
        throw new BadRequestException("Address is outside delivery zones");
      }
      const poly = (matched.polygon ?? {}) as Record<string, unknown>;
      deliveryFee = Number(matched.deliveryFee);
      deliveryQuote = {
        inZone: true,
        fee: deliveryFee,
        minOrder: Number(matched.minOrder),
        estimatedMinutes:
          typeof poly.estimatedMinutes === "number"
            ? poly.estimatedMinutes
            : Number(poly.estimatedMinutes) || null,
        zoneId: matched.id,
      };
      const goodsTotal = taxResult.total + tipRupees;
      if (goodsTotal < deliveryQuote.minOrder) {
        throw new BadRequestException(
          `Minimum order for delivery is ₹${deliveryQuote.minOrder}`,
        );
      }
    }

    const totalWithTip = orderGrandTotal({
      subtotal: taxResult.subtotal,
      taxTotal: taxResult.taxTotal,
      tipAmount: tipRupees,
      deliveryFee,
    });
    const initialStatus = dto.autoConfirm ? "confirmed" : "draft";

    const order = await this.prisma.order.create({
      data: {
        organizationId: orgId,
        outletId: dto.outletId,
        orderNumber,
        pickupCode,
        type: type as never,
        source: source as never,
        status: initialStatus as never,
        tableId: dto.tableId,
        tableSessionId: dto.tableSessionId,
        customerId: dto.customerId,
        createdById: userId,
        guestCount: dto.guestCount,
        customerName: dto.customerName,
        scheduledPickupAt: dto.scheduledPickupAt
          ? new Date(dto.scheduledPickupAt)
          : undefined,
        notes: dto.notes,
        subtotal: taxResult.subtotal,
        taxTotal: taxResult.taxTotal,
        tipAmount: tipRupees,
        total: totalWithTip,
        idempotencyKey: dto.idempotencyKey,
        metadata: (() => {
          const merged = {
            ...(dto.metadata ?? {}),
            ...(type === "delivery"
              ? {
                  deliveryAddress: dto.deliveryAddress,
                  deliveryPincode: dto.deliveryPincode,
                  deliveryFee,
                  deliveryZoneId: deliveryQuote?.zoneId,
                }
              : {}),
          };
          return Object.keys(merged).length ? merged : undefined;
        })(),
        items: {
          create: resolvedItems.map((item, index) => {
            const lineSubtotal = item.unitPrice * item.quantity;
            const taxAmount = taxResult.itemTaxes[index] ?? 0;
            return {
              menuItemId: item.menuItemId,
              variantId: item.variantId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxAmount,
              total: orderLineTotal(
                lineSubtotal,
                taxAmount,
                taxResult.itemInclusive[index] ?? false,
              ),
              notes: item.notes,
              modifiers: item.modifiers ?? undefined,
            };
          }),
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
        ...(type === "delivery" && deliveryQuote
          ? {
              deliveryOrder: {
                create: {
                  address: dto.deliveryAddress!.trim(),
                  pincode: dto.deliveryPincode?.trim(),
                  zoneId: deliveryQuote.zoneId,
                  latitude: dto.deliveryLat,
                  longitude: dto.deliveryLng,
                  deliveryFee,
                  estimatedAt: deliveryQuote.estimatedMinutes
                    ? new Date(
                        Date.now() + deliveryQuote.estimatedMinutes * 60_000,
                      )
                    : undefined,
                },
              },
            }
          : {}),
      },
      include: {
        items: { include: { menuItem: { select: { hsnCode: true } } } },
        taxLines: true,
        deliveryOrder: true,
      },
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

    let mapped = mapOrderToClient(order);
    if (dto.couponCode?.trim()) {
      mapped = await this.applyDiscount(orgId, order.id, {
        couponCode: dto.couponCode.trim(),
      });
    }
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
        taxAmount: 0,
        total: item.unitPrice * item.quantity,
        notes: item.notes,
        modifiers: item.modifiers ?? undefined,
      })),
    });

    return this.recomputeOrderFromItems(orgId, orderId, "order.items_added");
  }

  async updateItem(
    orgId: string,
    orderId: string,
    itemId: string,
    body: { quantity?: number },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "draft") {
      throw new BadRequestException("Only draft orders can be edited");
    }

    const existing = order.items.find((i) => i.id === itemId);
    if (!existing) throw new NotFoundException("Order item not found");

    const quantity = body.quantity;
    if (quantity === undefined || !Number.isFinite(quantity) || quantity < 1) {
      throw new BadRequestException("quantity must be at least 1");
    }

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { quantity: Math.floor(quantity) },
    });

    return this.recomputeOrderFromItems(orgId, orderId, "order.item_updated");
  }

  async removeItem(orgId: string, orderId: string, itemId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status !== "draft") {
      throw new BadRequestException("Only draft orders can be edited");
    }

    const existing = order.items.find((i) => i.id === itemId);
    if (!existing) throw new NotFoundException("Order item not found");

    await this.prisma.orderItem.delete({ where: { id: itemId } });
    return this.recomputeOrderFromItems(orgId, orderId, "order.item_removed");
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
      include: ORDER_CLIENT_INCLUDE,
    });

    const kot = await this.createKot(updated);
    const mapped = mapOrderToClient(updated);
    this.ws.emitToOutlet(order.outletId, "order.updated", mapped);
    this.ws.emitToOutlet(order.outletId, "kot.created", { order: mapped, kot });
    return mapped;
  }

  async updateStatus(orgId: string, orderId: string, status: string) {
    const apiStatus = normalizeOrderStatusFilter(status ?? "");
    if (apiStatus === "cancelled") {
      return this.cancel(orgId, orderId);
    }
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      select: { status: true, readyAt: true, metadata: true },
    });
    if (!existing) throw new NotFoundException("Order not found");

    const order = await this.prisma.order.update({
      where: { id: orderId, organizationId: orgId },
      data: {
        status: apiStatus as never,
        ...(apiStatus === "ready" && existing.status !== "ready"
          ? { readyAt: new Date() }
          : {}),
        completedAt: apiStatus === "completed" ? new Date() : undefined,
        timeline: {
          create: { event: "order.status_changed", metadata: { status } },
        },
      },
      include: ORDER_CLIENT_INCLUDE,
    });

    if (apiStatus === "completed" || apiStatus === "served" || apiStatus === "voided") {
      await this.closeOpenKots(order.id, order.outletId, apiStatus === "voided" ? "cancelled" : "served");
    }

    const shouldDeductStock =
      (apiStatus === "completed" || apiStatus === "served") &&
      existing.status !== "completed" &&
      existing.status !== "served";
    if (shouldDeductStock && this.recipes) {
      await this.recipes.deductForOrder(orgId, order);
    }
    const mapped = mapOrderToClient(order);
    this.ws.emitToOutlet(order.outletId, "order.updated", mapped);
    if (apiStatus === "ready") {
      this.ws.emitToOutlet(order.outletId, "order.ready", mapped);
    }
    if (this.guestPush && order.customerId) {
      const titles: Record<string, string> = {
        confirmed: "Order confirmed",
        preparing: "Preparing your order",
        ready: "Order ready",
        completed: "Order completed",
        cancelled: "Order cancelled",
      };
      const title = titles[apiStatus];
      if (title) {
        void this.guestPush.notifyCustomerOrder(order.customerId, {
          title,
          body: `Order #${order.orderNumber}${
            order.pickupCode ? ` · code ${order.pickupCode}` : ""
          }`,
          data: {
            orderId: order.id,
            type: "order.status",
            status: apiStatus,
          },
        });
      }
    }
    if (apiStatus === "completed" && this.loyalty) {
      const total = Number(order.total ?? 0);
      await this.loyalty.earnForOrder(orgId, order.id, order.customerId, total);
    }
    return mapped;
  }

  /** Cancel order (refund stub — marks cancelled and appends notes). */
  async cancel(orgId: string, orderId: string, notes?: string) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Order not found");
    if (TERMINAL_ORDER_STATUSES.includes(existing.status)) {
      throw new BadRequestException(`Cannot cancel order in status ${existing.status}`);
    }

    const refundNote = notes?.trim() || "Cancelled / refund stub";
    const mergedNotes = [existing.notes, refundNote].filter(Boolean).join("\n");

    const order = await this.prisma.order.update({
      where: { id: orderId, organizationId: orgId },
      data: {
        status: "cancelled",
        notes: mergedNotes,
        timeline: {
          create: {
            event: "order.cancelled",
            metadata: { notes: refundNote },
          },
        },
      },
      include: ORDER_CLIENT_INCLUDE,
    });
    await this.closeOpenKots(order.id, order.outletId, "cancelled");
    const mapped = mapOrderToClient(order);
    this.ws.emitToOutlet(order.outletId, "order.updated", mapped);
    if (this.guestPush && order.customerId) {
      void this.guestPush.notifyCustomerOrder(order.customerId, {
        title: "Order cancelled",
        body: `Order #${order.orderNumber}`,
        data: { orderId: order.id, type: "order.status", status: "cancelled" },
      });
    }
    return mapped;
  }

  /** Move any still-open kitchen tickets for this order off the KDS (order is terminal). */
  private async closeOpenKots(
    orderId: string,
    outletId: string,
    target: "served" | "cancelled",
  ) {
    const open = await this.prisma.kOT.findMany({
      where: { orderId, status: { in: ["pending", "preparing", "ready"] } },
      select: { id: true },
    });
    if (open.length === 0) return;
    const kotIds = open.map((k) => k.id);
    await this.prisma.$transaction([
      this.prisma.kOTItem.updateMany({
        where: {
          kotId: { in: kotIds },
          status: { notIn: ["served", "cancelled"] },
        },
        data: { status: target },
      }),
      this.prisma.kOT.updateMany({
        where: { id: { in: kotIds } },
        data: { status: target },
      }),
    ]);
    for (const kotId of kotIds) {
      this.ws.emitToOutlet(outletId, "kot.updated", {
        kotId,
        orderId,
        status: target === "served" ? "SERVED" : "CANCELLED",
      });
    }
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

  private recalcOrderTotal(
    subtotal: number,
    taxTotal: number,
    tipAmount: number,
    discountTotal: number,
    deliveryFee = 0,
  ) {
    return Math.max(
      0,
      Math.round((subtotal + taxTotal + tipAmount + deliveryFee - discountTotal) * 100) / 100,
    );
  }

  async applyDiscount(
    orgId: string,
    orderId: string,
    input: { discountAmount?: number; reason?: string; couponCode?: string },
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: { discounts: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (["completed", "cancelled", "voided"].includes(order.status)) {
      throw new BadRequestException("Cannot discount a closed order");
    }

    let amount = Number(input.discountAmount ?? 0);
    let couponId: string | null = null;
    let type = "manual";
    let value = amount;

    if (input.couponCode?.trim()) {
      const code = input.couponCode.trim().toUpperCase();
      const coupon = await this.prisma.coupon.findFirst({
        where: { organizationId: orgId, code, isActive: true },
      });
      if (!coupon) throw new NotFoundException("Coupon not found");
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        throw new BadRequestException("Coupon expired");
      }
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        throw new BadRequestException("Coupon usage limit reached");
      }
      const base = Number(order.subtotal) + Number(order.taxTotal);
      if (coupon.minOrder && base < Number(coupon.minOrder)) {
        throw new BadRequestException(`Minimum order is ${coupon.minOrder}`);
      }
      amount =
        coupon.type === "percent"
          ? Math.round(base * (Number(coupon.value) / 100) * 100) / 100
          : Number(coupon.value);
      couponId = coupon.id;
      type = "coupon";
      value = Number(coupon.value);
    }

    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException("Invalid discount amount");
    }

    const discountTotal = Math.round((Number(order.discountTotal) + amount) * 100) / 100;
    const meta = (order.metadata ?? {}) as Record<string, unknown>;
    const deliveryFee = Number(meta.deliveryFee ?? 0);
    const total = this.recalcOrderTotal(
      Number(order.subtotal),
      Number(order.taxTotal),
      Number(order.tipAmount),
      discountTotal,
      deliveryFee,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderDiscount.create({
        data: {
          orderId: order.id,
          type,
          value,
          amount,
          couponId,
        },
      });
      if (couponId) {
        await tx.coupon.update({
          where: { id: couponId },
          data: { usedCount: { increment: 1 } },
        });
        await tx.couponUsage.create({
          data: {
            couponId,
            orderId: order.id,
            customerId: order.customerId,
          },
        });
      }
      return tx.order.update({
        where: { id: order.id },
        data: {
          discountTotal,
          total,
          notes: input.reason
            ? [order.notes, `Discount: ${input.reason}`].filter(Boolean).join(" | ")
            : order.notes,
          timeline: {
            create: {
              event: "order.discount",
              metadata: { amount, type, couponId, reason: input.reason },
            },
          },
        },
        include: { ...ORDER_CLIENT_INCLUDE, discounts: true },
      });
    });

    const mapped = mapOrderToClient(updated);
    this.ws.emitToOutlet(order.outletId, "order.updated", mapped);
    return mapped;
  }

  async splitOrder(orgId: string, orderId: string, itemIds: string[], userId?: string | null) {
    const ids = [...new Set(itemIds.filter(Boolean))];
    if (ids.length === 0) throw new BadRequestException("Select at least one item to split");

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (["completed", "cancelled", "voided"].includes(order.status)) {
      throw new BadRequestException("Cannot split a closed order");
    }

    const moveItems = order.items.filter((i) => ids.includes(i.id));
    if (moveItems.length === 0) throw new BadRequestException("No matching items on order");
    if (moveItems.length >= order.items.length) {
      throw new BadRequestException("Cannot move all items — leave at least one on the original bill");
    }

    const remaining = order.items.filter((i) => !ids.includes(i.id));
    const sumLine = (items: typeof order.items) =>
      items.reduce((s, i) => s + Number(i.total), 0);
    const sumTax = (items: typeof order.items) =>
      items.reduce((s, i) => s + Number(i.taxAmount), 0);
    const sumSub = (items: typeof order.items) =>
      items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);

    const childSub = sumSub(moveItems);
    const childTax = sumTax(moveItems);
    const childTotal = sumLine(moveItems);
    const parentSub = sumSub(remaining);
    const parentTax = sumTax(remaining);
    const parentTotal = sumLine(remaining);

    const count = await this.prisma.order.count({ where: { outletId: order.outletId } });
    const orderNumber = String(count + 1).padStart(4, "0");
    const pickupCode = await this.allocatePickupCode(order.outletId);

    const child = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          organizationId: orgId,
          outletId: order.outletId,
          orderNumber,
          pickupCode,
          type: order.type,
          source: order.source,
          status: order.status,
          tableId: order.tableId,
          customerId: order.customerId,
          createdById: userId ?? order.createdById,
          customerName: order.customerName,
          notes: `Split from ${order.orderNumber}`,
          subtotal: childSub,
          taxTotal: childTax,
          tipAmount: 0,
          discountTotal: 0,
          total: childTotal,
          timeline: {
            create: { event: "order.split_from", metadata: { parentOrderId: order.id } },
          },
        },
      });

      for (const item of moveItems) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: { orderId: created.id },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: parentSub,
          taxTotal: parentTax,
          total: parentTotal,
          timeline: {
            create: {
              event: "order.split",
              metadata: { childOrderId: created.id, itemIds: ids },
            },
          },
        },
      });

      return tx.order.findFirstOrThrow({
        where: { id: created.id },
        include: { items: true },
      });
    });

    const parent = await this.recomputeOrderFromItems(orgId, orderId, "order.totals_recomputed");
    const childMapped = await this.recomputeOrderFromItems(
      orgId,
      child.id,
      "order.totals_recomputed",
    );
    this.ws.emitToOutlet(order.outletId, "order.created", childMapped);
    return { original: parent, split: childMapped };
  }

  async findOutletBySlugs(orgSlug: string, outletSlug: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { slug: orgSlug, status: { in: ["active", "trial"] } },
      select: { id: true },
    });
    if (!organization) return null;
    return this.prisma.outlet.findFirst({
      where: {
        organizationId: organization.id,
        slug: outletSlug,
        status: "active",
      },
      select: { id: true, organizationId: true },
    });
  }

  async getPickupQueue(orgId: string, outletId: string) {
    const READY_TTL_MS = 10 * 60 * 1000;
    const cutoff = new Date(Date.now() - READY_TTL_MS);

    // Auto-advance Ready orders that have been on the board longer than 10 minutes.
    await this.prisma.order.updateMany({
      where: {
        organizationId: orgId,
        outletId,
        status: "ready",
        OR: [
          { readyAt: { lt: cutoff } },
          { readyAt: null, updatedAt: { lt: cutoff } },
        ],
      },
      data: { status: "served" },
    });

    const orders = await this.prisma.order.findMany({
      where: {
        organizationId: orgId,
        outletId,
        type: { in: ["takeaway", "qr", "online", "dine_in"] },
        OR: [
          { status: { in: ["confirmed", "preparing"] } },
          {
            status: "ready",
            OR: [
              { readyAt: { gte: cutoff } },
              { readyAt: null, updatedAt: { gte: cutoff } },
            ],
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: { items: true },
    });
    return orders.map((o) => mapOrderToClient(o));
  }

  async createKotForOrder(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: { items: true, kots: { include: { items: true } } },
    });
    if (!order) throw new NotFoundException("Order not found");

    const kotItemIds = new Set(
      order.kots.flatMap((k) => k.items.map((i) => i.orderItemId)),
    );
    const newItems = order.items.filter((i) => !kotItemIds.has(i.id));
    if (newItems.length === 0) {
      return mapOrderToClient(order);
    }

    const kot = await this.prisma.kOT.create({
      data: {
        orderId: order.id,
        kotNumber: `K${order.orderNumber}-${order.kots.length + 1}`,
        status: "pending",
        items: {
          create: newItems.map((item) => ({
            orderItemId: item.id,
            status: "pending",
          })),
        },
      },
      include: { items: true },
    });

    const mapped = mapOrderToClient(order);
    this.ws.emitToOutlet(order.outletId, "kot.created", { order: mapped, kot });
    return mapped;
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

  private async allocatePickupCode(outletId: string): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = generatePickupCode();
      const existing = await this.prisma.order.findFirst({
        where: { outletId, pickupCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }
    throw new BadRequestException("Could not allocate pickup code");
  }

  async sendEbill(orgId: string, orderId: string, channel: "email" | "sms") {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: {
        items: true,
        customer: { select: { email: true, phone: true, name: true } },
        outlet: { select: { name: true } },
      },
    });
    if (!order) throw new NotFoundException("Order not found");

    let feedbackUrl: string | null = null;
    if (this.feedback) {
      const row = await this.feedback.ensureSurveyToken(orgId, order.id);
      feedbackUrl = this.feedback.getSurveyLink(row.surveyToken);
    }

    const lines = order.items
      .map((i) => `${i.quantity}× ${i.name} — ₹${Number(i.total).toFixed(2)}`)
      .join("\n");
    const body = [
      `Bill for order #${order.orderNumber}`,
      order.outlet?.name ? `Outlet: ${order.outlet.name}` : null,
      "",
      lines,
      "",
      `Total: ₹${Number(order.total).toFixed(2)}`,
      feedbackUrl ? `Feedback: ${feedbackUrl}` : null,
    ]
      .filter((x) => x != null)
      .join("\n");

    if (channel === "email") {
      const to = order.customer?.email?.trim();
      if (!to) throw new BadRequestException("Order has no customer email");
      if (!this.mail) throw new BadRequestException("Mail service unavailable");
      const sent = await this.mail.sendMail({
        to,
        subject: `Your receipt · #${order.orderNumber}`,
        text: body,
        html: body
          .split("\n")
          .map((l) => (l.trim() ? `<p>${l}</p>` : "<br/>"))
          .join(""),
      });
      return { success: sent, channel: "email" as const };
    }

    const phone = order.customer?.phone?.trim();
    if (!phone) throw new BadRequestException("Order has no customer phone");
    if (!this.sms) throw new BadRequestException("SMS service unavailable");
    const result = await this.sms.sendCampaignSms(
      [phone],
      `Cullinos #${order.orderNumber} ₹${Number(order.total).toFixed(2)}${feedbackUrl ? ` Feedback: ${feedbackUrl}` : ""}`,
    );
    return {
      success: result.sent > 0,
      channel: "sms" as const,
      sent: result.sent,
      failed: result.failed,
    };
  }

  private normalizeSource(source?: string) {
    const map: Record<string, string> = {
      WAITER: "waiter",
      POS: "pos",
      QR: "customer",
      ONLINE: "customer",
      CUSTOMER: "customer",
      SWIGGY: "gateway",
      ZOMATO: "gateway",
      AGGREGATOR: "gateway",
      API: "api",
      DELIVERY: "delivery",
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

function parseDateFilter(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${field} date`);
  }
  return date;
}
