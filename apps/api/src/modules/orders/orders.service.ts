import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
  Logger,
  forwardRef,
  Optional,
} from "@nestjs/common";
import { calculateMixedGst, type TaxLineInput } from "@cullinos/tax-engine";
import {
  ALCOHOL_CUSTOMER_ORDER_TYPES,
  type BusinessType,
  getOrderTypeViolation,
  isAlcoholProductType,
  orgServesAlcohol,
} from "@cullinos/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";
import {
  IncomingOrderItem,
  mapOrderToClient,
  resolveOrderItems,
  type ResolvedOrderItem,
} from "../../common/order-items.util";
import { generatePickupCode } from "../../common/pickup-code.util";
import { loadActiveHappyHourRules } from "../../common/happy-hour.util";
import { normalizeOrderStatusFilter } from "../../common/status.util";
import { toPaise } from "../../common/money.util";
import { orderGrandTotal, orderLineTotal, pickDefaultTaxGroup } from "./order-tax.util";
import { matchDeliveryZone } from "../delivery/delivery-zone.util";
import { groupItemsByStation, kotNumberFor, stationCodeFor } from "./kot-routing.util";
import {
  isOrderNumberCollision,
  nextOrderNumberCandidate,
  ORDER_NUMBER_MAX_ATTEMPTS,
} from "./order-number.util";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { GuestPushService } from "../guest/guest-push.service";
import { RecipesService } from "../recipes/recipes.service";
import { splitStockMetadata } from "../../common/recipe-stock.util";
import { stockDeductionTrigger } from "../../common/stock-deduction.util";
import {
  canTransitionOrder,
  reverseOrderIncentives,
  TERMINAL_STATUSES,
} from "./order-reversal.util";
import { releaseMergedTables } from "../tables/table-merge.util";
import { MailService } from "../mail/mail.service";
import { buildReceiptEmail } from "../mail/templates";
import { Msg91Service } from "../sms/msg91.service";
import { WhatsappService } from "../sms/whatsapp.service";
import { FeedbackService } from "../feedback/feedback.service";
import { WalletService, smsSegments } from "../wallet/wallet.service";
import { smsEbill } from "../sms/sms-templates";

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
const KITCHEN_ACTIVE_STATUSES = ["confirmed", "preparing", "ready", "served"];

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
  /** Placed by a guest (app or table QR session): drink orders need dine-in and age confirmation. Implied by publicOrder. */
  customerOrder?: boolean;
  /** Guest confirmed legal drinking age (required when a customer order contains alcohol). */
  ageConfirmed?: boolean;
};

/** Server-side callers only (never populated from a request body). */
type CreateOrderInternalOptions = {
  /** Per-line unit price in rupees that replaces the menu price (aggregator-billed orders). */
  priceOverrides?: Array<number | undefined>;
  /** The order total was collected by a third party; record it as a completed payment. */
  prepaid?: { methodCode: string; methodName: string; reference?: string; tender?: string };
};

type AddItemsOptions = {
  customerOrder?: boolean;
  ageConfirmed?: boolean;
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

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
    private whatsapp?: WhatsappService,
    @Optional()
    private feedback?: FeedbackService,
    @Optional()
    private wallet?: WalletService,
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
      const group = item.isTaxExempt
        ? null
        : ((item.taxGroupId ? groupById.get(item.taxGroupId) : undefined) ??
          defaultGroup ??
          null);
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
      include: { menuItem: { select: { taxGroupId: true, isTaxExempt: true } } },
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
        isTaxExempt: i.menuItem?.isTaxExempt ?? false,
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

  /** Client-supplied foreign keys must belong to this tenant (and outlet, for tables). */
  private async assertOrderReferences(
    orgId: string,
    outletId: string,
    dto: Pick<CreateOrderDto, "tableId" | "tableSessionId" | "customerId">,
  ) {
    if (dto.tableId) {
      const table = await this.prisma.table.findFirst({
        where: { id: dto.tableId, section: { floor: { outletId, outlet: { organizationId: orgId } } } },
        select: { id: true },
      });
      if (!table) throw new BadRequestException("Invalid table");
    }
    if (dto.tableSessionId) {
      const session = await this.prisma.tableSession.findFirst({
        where: {
          id: dto.tableSessionId,
          ...(dto.tableId ? { tableId: dto.tableId } : {}),
          table: { section: { floor: { outletId, outlet: { organizationId: orgId } } } },
        },
        select: { id: true },
      });
      if (!session) throw new BadRequestException("Invalid table session");
    }
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId: orgId },
        select: { id: true },
      });
      if (!customer) throw new BadRequestException("Invalid customer");
    }
  }

  async get(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: ORDER_CLIENT_INCLUDE,
    });
    if (!order) throw new NotFoundException("Order not found");
    return mapOrderToClient(order);
  }

  async create(
    orgId: string,
    userId: string | null,
    dto: CreateOrderDto,
    internal: CreateOrderInternalOptions = {},
  ) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true },
      });
      if (existing) {
        if (existing.organizationId !== orgId) {
          throw new ConflictException("Idempotency key already used");
        }
        return mapOrderToClient(existing);
      }
    }

    const outlet = await this.prisma.outlet.findFirst({
      where: { id: dto.outletId, organizationId: orgId },
      include: {
        organization: {
          select: { businessType: true, settings: { select: { settings: true } } },
        },
      },
    });
    if (!outlet) throw new BadRequestException("Invalid outlet");

    const typeViolation = getOrderTypeViolation(outlet.organization?.businessType ?? null, {
      type: this.normalizeType(dto.type, dto.source, dto.tableId),
      hasTable: Boolean(dto.tableId),
    });
    if (typeViolation) throw new BadRequestException(typeViolation);

    await this.assertOrderReferences(orgId, dto.outletId, dto);

    const resolvedItems = await resolveOrderItems(
      this.prisma,
      orgId,
      dto.outletId,
      dto.items ?? [],
      {
        publicOrder: Boolean(dto.publicOrder || dto.customerOrder),
        happyHourRules: await loadActiveHappyHourRules(this.prisma, orgId, dto.outletId),
      },
    );
    internal.priceOverrides?.forEach((price, index) => {
      if (resolvedItems[index] && typeof price === "number" && Number.isFinite(price) && price >= 0) {
        resolvedItems[index].unitPrice = price;
      }
    });

    const hasAlcohol = assertAlcoholRules(resolvedItems, outlet.organization, {
      customerOrder: Boolean(dto.publicOrder || dto.customerOrder),
      orderType: this.normalizeType(dto.type, dto.source, dto.tableId),
      ageConfirmed: dto.ageConfirmed === true,
    });

    // tipAmount is always rupees (POS tip field); never infer paise from magnitude.
    const tipRupees = dto.tipAmount ?? 0;
    if (!Number.isFinite(tipRupees) || tipRupees < 0) {
      throw new BadRequestException("tipAmount must be a non-negative amount in rupees");
    }
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
      const match = matchDeliveryZone(zones, {
        pincode: dto.deliveryPincode,
        lat: dto.deliveryLat,
        lng: dto.deliveryLng,
      });
      if (!match.ok) {
        throw new BadRequestException(
          match.reason === "location_required"
            ? "deliveryPincode or delivery coordinates are required"
            : match.reason === "no_zones"
              ? "Delivery is not available from this outlet"
              : "Address is outside delivery zones",
        );
      }
      deliveryFee = match.fee;
      deliveryQuote = {
        inZone: true,
        fee: deliveryFee,
        minOrder: match.minOrder,
        estimatedMinutes: match.estimatedMinutes,
        zoneId: match.zone.id,
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

    const order = await this.withOrderNumber(dto.outletId, ({ orderNumber, pickupCode }) =>
      this.prisma.order.create({
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
              ...(hasAlcohol && dto.ageConfirmed === true ? { alcoholAgeConfirmed: true } : {}),
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
      }),
    );

    if (dto.tableId) {
      await this.prisma.table.update({
        where: { id: dto.tableId },
        data: { status: "occupied" },
      });
    }

    if (internal.prepaid && Number(order.total) > 0) {
      const method = await this.prisma.paymentMethod.upsert({
        where: { code: internal.prepaid.methodCode },
        update: { isActive: true },
        create: { code: internal.prepaid.methodCode, name: internal.prepaid.methodName },
      });
      await this.prisma.payment.create({
        data: {
          organizationId: orgId,
          orderId: order.id,
          paymentMethodId: method.id,
          amount: order.total,
          status: "completed",
          processedAt: new Date(),
          reference: internal.prepaid.reference,
          metadata: { kind: "prepaid", tender: internal.prepaid.tender ?? internal.prepaid.methodCode },
        },
      });
    }

    const kots = initialStatus === "confirmed" ? await this.createKot(order) : [];

    let mapped = mapOrderToClient(order);
    if (dto.couponCode?.trim()) {
      mapped = await this.applyDiscount(orgId, order.id, {
        couponCode: dto.couponCode.trim(),
      });
    }
    if (internal.prepaid) {
      await this.loyalty?.earnIfOrderSettled(order.id, { organizationId: orgId });
    }
    this.ws.emitToOutlet(dto.outletId, "order.updated", mapped);
    for (const kot of kots) {
      this.ws.emitToOutlet(dto.outletId, "kot.created", { order: mapped, kot });
    }
    return mapped;
  }

  async addItems(
    orgId: string,
    orderId: string,
    items: IncomingOrderItem[],
    options: AddItemsOptions = {},
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: {
        items: true,
        organization: {
          select: { businessType: true, settings: { select: { settings: true } } },
        },
      },
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
      {
        publicOrder: Boolean(options.customerOrder),
        happyHourRules: await loadActiveHappyHourRules(this.prisma, orgId, order.outletId),
      },
    );
    const hasAlcohol = assertAlcoholRules(resolvedItems, order.organization, {
      customerOrder: Boolean(options.customerOrder),
      orderType: order.type,
      ageConfirmed: options.ageConfirmed === true,
    });
    if (hasAlcohol && options.customerOrder) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          metadata: {
            ...((order.metadata ?? {}) as Record<string, unknown>),
            alcoholAgeConfirmed: true,
          } as never,
        },
      });
    }

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
    if (this.recipes) {
      await this.recipes.deductNewOrderItems(orgId, order.id);
    }

    const mapped = await this.recomputeOrderFromItems(orgId, orderId, "order.items_added");
    // Staff adds on an order already in the kitchen go straight to a new KOT; guest QR adds wait for submit.
    if (!options.customerOrder && KITCHEN_ACTIVE_STATUSES.includes(order.status)) {
      await this.createKotForOrder(orgId, order.id);
    }
    return mapped;
  }

  /**
   * Table merge: move the source order's lines onto the target as-is (no re-pricing, no new KOT,
   * stock stays deducted) and cancel the emptied source.
   */
  async absorbOrder(orgId: string, sourceOrderId: string, targetOrderId: string) {
    if (sourceOrderId === targetOrderId) return;
    const [source, target] = await Promise.all([
      this.prisma.order.findFirst({ where: { id: sourceOrderId, organizationId: orgId } }),
      this.prisma.order.findFirst({ where: { id: targetOrderId, organizationId: orgId } }),
    ]);
    if (!source || !target) throw new NotFoundException("Order not found");
    if (TERMINAL_ORDER_STATUSES.includes(source.status) || TERMINAL_ORDER_STATUSES.includes(target.status)) {
      throw new BadRequestException("Cannot merge closed orders");
    }
    const paid = await this.prisma.payment.aggregate({
      where: { orderId: source.id, status: "completed" },
      _sum: { amount: true },
    });
    if (Number(paid._sum.amount ?? 0) > 0) {
      throw new BadRequestException(
        `Order ${source.orderNumber} already has payments — settle it before merging`,
      );
    }

    // Stock movements are keyed to the order, so hand the source's deductions back and let the
    // target re-deduct the moved lines under its own reference.
    await this.releaseStock(orgId, source.id);
    await this.prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { orderId: source.id },
        data: { orderId: target.id },
      });
      // Tickets already in the kitchen follow their lines so the KDS keeps cooking them.
      await tx.kOT.updateMany({
        where: { orderId: source.id },
        data: { orderId: target.id },
      });
      await tx.order.update({
        where: { id: source.id },
        data: {
          status: "cancelled",
          notes: [source.notes, `Merged into ${target.orderNumber}`].filter(Boolean).join("\n"),
          tableSessionId: null,
          timeline: {
            create: { event: "order.merged_into", metadata: { targetOrderId: target.id } },
          },
        },
      });
      await reverseOrderIncentives(tx, source.id);
    });
    if (this.recipes) {
      await this.recipes.deductNewOrderItems(orgId, target.id);
    }
    return this.recomputeOrderFromItems(orgId, target.id, "order.merged");
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

    const kots = await this.createKot(updated);
    const mapped = mapOrderToClient(updated);
    this.ws.emitToOutlet(order.outletId, "order.updated", mapped);
    for (const kot of kots) {
      this.ws.emitToOutlet(order.outletId, "kot.created", { order: mapped, kot });
    }
    return mapped;
  }

  async updateStatus(
    orgId: string,
    orderId: string,
    status: string,
    opts: { allowUnpaidComplete?: boolean } = {},
  ) {
    const apiStatus = normalizeOrderStatusFilter(status ?? "");
    if (apiStatus === "cancelled") {
      return this.cancel(orgId, orderId);
    }
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      select: { status: true, readyAt: true, metadata: true, total: true },
    });
    if (!existing) throw new NotFoundException("Order not found");
    if (!canTransitionOrder(existing.status, apiStatus)) {
      throw new BadRequestException(
        `Cannot move order from ${existing.status} to ${apiStatus}`,
      );
    }
    if (existing.status === apiStatus) {
      const same = await this.prisma.order.findFirstOrThrow({
        where: { id: orderId, organizationId: orgId },
        include: ORDER_CLIENT_INCLUDE,
      });
      return mapOrderToClient(same);
    }
    const paid = await this.completedPaymentsTotal(orderId);
    if (apiStatus === "completed" && !opts.allowUnpaidComplete) {
      const outstanding = Math.round((Number(existing.total) - paid) * 100) / 100;
      if (outstanding > 0) {
        throw new BadRequestException(
          `Order has ₹${outstanding.toFixed(2)} outstanding — take payment before completing`,
        );
      }
    }
    if (apiStatus === "voided" && paid > 0) {
      throw new BadRequestException("Order has payments — refund them before voiding");
    }

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
      await this.recipes.deductForOrder(orgId, order.id);
    }
    if (apiStatus === "voided" && existing.status !== "voided") {
      if (this.recipes) await this.recipes.restoreForOrder(orgId, order.id);
      await this.prisma.$transaction((tx) => reverseOrderIncentives(tx, order.id));
    }
    if (apiStatus === "completed" || apiStatus === "voided") {
      await this.releaseTableIfIdle(order);
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
    if (apiStatus === "completed") {
      await this.loyalty?.earnIfOrderSettled(order.id, { organizationId: orgId, force: true });
    }
    return mapped;
  }

  /** Cancel order (refund stub — marks cancelled and appends notes). */
  async cancel(orgId: string, orderId: string, notes?: string) {
    const existing = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Order not found");
    if (!canTransitionOrder(existing.status, "cancelled")) {
      throw new BadRequestException(`Cannot cancel order in status ${existing.status}`);
    }
    if ((await this.completedPaymentsTotal(orderId)) > 0) {
      throw new BadRequestException("Order has payments — refund them before cancelling");
    }

    const refundNote = notes?.trim() || "Cancelled";
    const mergedNotes = [existing.notes, refundNote].filter(Boolean).join("\n");

    const order = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, organizationId: orgId, status: existing.status },
        data: { status: "cancelled", notes: mergedNotes },
      });
      if (claimed.count !== 1) {
        throw new ConflictException("Order changed while cancelling — refresh and retry");
      }
      await reverseOrderIncentives(tx, orderId);
      return tx.order.update({
        where: { id: orderId },
        data: {
          timeline: {
            create: {
              event: "order.cancelled",
              metadata: { notes: refundNote },
            },
          },
        },
        include: ORDER_CLIENT_INCLUDE,
      });
    });
    await this.closeOpenKots(order.id, order.outletId, "cancelled");
    await this.releaseStock(orgId, order.id);
    await this.releaseTableIfIdle(order);
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

  /** Free the table (and end its session) once the last open order on it closes. */
  private async releaseTableIfIdle(order: { id: string; tableId: string | null; outletId: string }) {
    if (!order.tableId) return;
    const tableId = order.tableId;
    const stillOpen = await this.prisma.order.count({
      where: {
        tableId,
        id: { not: order.id },
        status: { notIn: [...TERMINAL_STATUSES] as never },
      },
    });
    if (stillOpen > 0) return;
    const released = await this.prisma.$transaction(async (tx) => {
      await tx.tableSession.updateMany({
        where: { tableId, status: "active" },
        data: { status: "closed", endedAt: new Date() },
      });
      await tx.table.updateMany({
        where: { id: tableId, status: "occupied" },
        data: { status: "available" },
      });
      return releaseMergedTables(tx, tableId, "available");
    });
    for (const id of [tableId, ...released]) {
      this.ws.emitToOutlet(order.outletId, "table.updated", {
        id,
        outletId: order.outletId,
        status: "AVAILABLE",
      });
    }
  }

  /** Return recipe stock already deducted for an order that will not be fulfilled. */
  async releaseStock(orgId: string, orderId: string): Promise<boolean> {
    if (!this.recipes) return false;
    return this.recipes.restoreForOrder(orgId, orderId);
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

  private async completedPaymentsTotal(orderId: string): Promise<number> {
    const paid = await this.prisma.payment.aggregate({
      where: { orderId, status: "completed" },
      _sum: { amount: true },
    });
    return Number(paid._sum.amount ?? 0);
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
    const updated = await this.prisma.$transaction(async (tx) => {
      // Serialize discounts per order so concurrent requests can't double-apply or lose totals.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND organization_id = ${orgId} FOR UPDATE`;
      const order = await tx.order.findFirst({
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
        const coupon = await tx.coupon.findFirst({
          where: { organizationId: orgId, code, isActive: true },
        });
        if (!coupon) throw new NotFoundException("Coupon not found");
        const now = new Date();
        if (coupon.startsAt && coupon.startsAt > now) {
          throw new BadRequestException("Coupon not active yet");
        }
        if (coupon.expiresAt && coupon.expiresAt < now) {
          throw new BadRequestException("Coupon expired");
        }
        if (order.discounts.some((d) => d.couponId === coupon.id)) {
          throw new BadRequestException("Coupon already applied to this order");
        }
        const base = Number(order.subtotal) + Number(order.taxTotal);
        if (coupon.minOrder && base < Number(coupon.minOrder)) {
          throw new BadRequestException(`Minimum order is ${coupon.minOrder}`);
        }
        const claimed = await tx.coupon.updateMany({
          where: {
            id: coupon.id,
            isActive: true,
            ...(coupon.maxUses ? { usedCount: { lt: coupon.maxUses } } : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count === 0) {
          throw new BadRequestException("Coupon usage limit reached");
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

      const meta = (order.metadata ?? {}) as Record<string, unknown>;
      const deliveryFee = Number(meta.deliveryFee ?? 0);
      const billBeforeDiscounts =
        Number(order.subtotal) + Number(order.taxTotal) + Number(order.tipAmount) + deliveryFee;
      const headroom = Math.max(0, billBeforeDiscounts - Number(order.discountTotal));
      if (type === "manual" && amount > headroom + 0.005) {
        throw new BadRequestException("Discount cannot exceed the bill total");
      }
      amount = Math.round(Math.min(amount, headroom) * 100) / 100;
      if (type === "manual") value = amount;

      const discountTotal = Math.round((Number(order.discountTotal) + amount) * 100) / 100;
      const total = this.recalcOrderTotal(
        Number(order.subtotal),
        Number(order.taxTotal),
        Number(order.tipAmount),
        discountTotal,
        deliveryFee,
      );

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
    this.ws.emitToOutlet(updated.outletId, "order.updated", mapped);
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
    if ((await this.completedPaymentsTotal(order.id)) > 0) {
      throw new BadRequestException("Cannot split an order that already has payments");
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

    const childStockMetadata = splitStockMetadata(order.metadata, moveItems.map((i) => i.id));

    const child = await this.withOrderNumber(order.outletId, ({ orderNumber, pickupCode }) =>
      this.prisma.$transaction(async (tx) => {
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
            ...(childStockMetadata ? { metadata: childStockMetadata } : {}),
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
      }),
    );

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
    const stale = await this.prisma.order.findMany({
      where: {
        organizationId: orgId,
        outletId,
        status: "ready",
        OR: [
          { readyAt: { lt: cutoff } },
          { readyAt: null, updatedAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
    });
    if (stale.length) {
      const staleIds = stale.map((o) => o.id);
      await this.prisma.order.updateMany({
        where: { id: { in: staleIds }, organizationId: orgId, status: "ready" },
        data: { status: "served" },
      });
      if (this.recipes) {
        for (const id of staleIds) {
          try {
            await this.recipes.deductForOrder(orgId, id);
          } catch (err) {
            this.logger.error(`Stock deduction failed for auto-served order ${id}`, err as Error);
          }
        }
      }
    }

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

    const kots = await this.createStationKots(
      order,
      newItems.map((i) => i.id),
      `K${order.orderNumber}-${order.kots.length + 1}`,
    );

    const mapped = mapOrderToClient(order);
    for (const kot of kots) {
      this.ws.emitToOutlet(order.outletId, "kot.created", { order: mapped, kot });
    }
    return mapped;
  }

  /** KOT only the lines not already on a ticket, so hold → resume never re-sends to the kitchen. */
  private async createKot(order: {
    id: string;
    orderNumber: string;
    outletId: string;
    items: { id: string }[];
  }) {
    const [sent, kotCount] = await Promise.all([
      this.prisma.kOTItem.findMany({
        where: { orderItemId: { in: order.items.map((i) => i.id) } },
        select: { orderItemId: true },
      }),
      this.prisma.kOT.count({ where: { orderId: order.id } }),
    ]);
    const sentIds = new Set(sent.map((s) => s.orderItemId));
    return this.createStationKots(
      order,
      order.items.map((i) => i.id).filter((id) => !sentIds.has(id)),
      kotCount ? `K${order.orderNumber}-${kotCount + 1}` : `K${order.orderNumber}`,
    );
  }

  /** One KOT per kitchen station (category `kitchenStationCode`, else BAR for alcohol); unrouted items share the default ticket. */
  private async createStationKots(
    order: { id: string; outletId: string },
    orderItemIds: string[],
    baseNumber: string,
  ) {
    if (orderItemIds.length === 0) return [];
    const [rows, stations] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { id: { in: orderItemIds }, orderId: order.id },
        select: {
          id: true,
          menuItem: {
            select: {
              productType: true,
              kitchenStationCode: true,
              category: { select: { kitchenStationCode: true } },
            },
          },
        },
      }),
      this.prisma.kitchenStation.findMany({
        where: { outletId: order.outletId, isActive: true },
        select: { id: true, code: true },
      }),
    ]);
    const codeById = new Map(
      rows.map((r) => [
        r.id,
        stationCodeFor(
          r.menuItem?.category?.kitchenStationCode,
          r.menuItem?.productType,
          r.menuItem?.kitchenStationCode,
        ),
      ]),
    );
    const groups = groupItemsByStation(
      orderItemIds.map((id) => ({ id, stationCode: codeById.get(id) ?? null })),
      stations,
    );

    const kots = [];
    for (const group of groups) {
      kots.push(
        await this.prisma.kOT.create({
          data: {
            orderId: order.id,
            kitchenStationId: group.stationId,
            kotNumber: kotNumberFor(baseNumber, group),
            status: "pending",
            items: {
              create: group.itemIds.map((orderItemId) => ({
                orderItemId,
                status: "pending",
              })),
            },
          },
          include: { items: true },
        }),
      );
    }
    if (kots.length) await this.deductStockOnKotIfConfigured(order.id);
    return kots;
  }

  private async deductStockOnKotIfConfigured(orderId: string) {
    if (!this.recipes) return;
    const row = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        organizationId: true,
        organization: { select: { settings: { select: { settings: true } } } },
      },
    });
    if (!row || stockDeductionTrigger(row.organization?.settings?.settings) !== "kot") return;
    const started = await this.recipes.deductForOrder(row.organizationId, orderId);
    if (!started) await this.recipes.deductNewOrderItems(row.organizationId, orderId);
  }

  /** Runs `create` with a fresh order number / pickup code, retrying on unique collisions. */
  private async withOrderNumber<T>(
    outletId: string,
    create: (numbers: { orderNumber: string; pickupCode: string }) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const [count, latest] = await Promise.all([
        this.prisma.order.count({ where: { outletId } }),
        this.prisma.order.findFirst({
          where: { outletId },
          orderBy: { createdAt: "desc" },
          select: { orderNumber: true },
        }),
      ]);
      const orderNumber = nextOrderNumberCandidate(count, latest?.orderNumber, attempt);
      const pickupCode = await this.allocatePickupCode(outletId);
      try {
        return await create({ orderNumber, pickupCode });
      } catch (err) {
        if (attempt + 1 >= ORDER_NUMBER_MAX_ATTEMPTS || !isOrderNumberCollision(err)) throw err;
      }
    }
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

  async sendEbill(orgId: string, orderId: string, channel: "email" | "sms" | "whatsapp") {
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
      const tpl = buildReceiptEmail({
        orderNumber: order.orderNumber,
        bodyText: body,
      });
      const sent = await this.mail.sendMail({
        to,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });
      return { success: sent, channel: "email" as const };
    }

    if (channel === "whatsapp") {
      const phone = order.customer?.phone?.trim();
      if (!phone) throw new BadRequestException("Order has no customer phone");
      if (!this.whatsapp) throw new BadRequestException("WhatsApp service unavailable");

      const settingsRow = await this.prisma.organizationSettings.findUnique({
        where: { organizationId: orgId },
        select: { settings: true },
      });
      const orgSettings = (settingsRow?.settings ?? {}) as Record<string, unknown>;
      if (orgSettings.whatsappReceiptsEnabled !== true) {
        throw new BadRequestException(
          "WhatsApp receipts are disabled. Enable them under Settings, and ensure your portal wallet has balance.",
        );
      }
      if (!this.wallet) throw new BadRequestException("Wallet service unavailable");
      if (!this.whatsapp.isReceiptTemplateConfigured()) {
        throw new BadRequestException(
          "WhatsApp e-bills need an approved template. Ask platform support to configure it.",
        );
      }
      const wallet = this.wallet;
      const whatsapp = this.whatsapp;
      const reservation = await wallet.reserveCharge(orgId, "whatsapp", 1, {
        referenceType: "ebill",
        referenceId: order.id,
        note: `WhatsApp e-bill order #${order.orderNumber}`,
      });
      let result: { sent: boolean; messageId?: string } = { sent: false };
      let chargedPaise = reservation?.amountPaise ?? 0;
      try {
        result = await whatsapp.sendReceiptAndThankYou({
          phone,
          orderNumber: order.orderNumber,
          total: Number(order.total),
          outletName: order.outlet?.name,
          feedbackUrl,
        });
      } finally {
        chargedPaise = await wallet.settleReservation(orgId, reservation, 1, result.sent ? 1 : 0);
      }
      return {
        success: result.sent,
        channel: "whatsapp" as const,
        messageId: result.messageId,
        chargedPaise,
      };
    }

    const phone = order.customer?.phone?.trim();
    if (!phone) throw new BadRequestException("Order has no customer phone");
    if (!this.sms) throw new BadRequestException("SMS service unavailable");
    if (!this.wallet) throw new BadRequestException("Wallet service unavailable");
    const message = smsEbill({
      orderNumber: order.orderNumber,
      total: Number(order.total),
      feedbackUrl,
    });
    const units = smsSegments(message);
    const reservation = await this.wallet.reserveCharge(orgId, "sms", units, {
      referenceType: "ebill",
      referenceId: order.id,
      note: `SMS e-bill order #${order.orderNumber}`,
    });
    let result = { sent: 0, failed: 1 };
    let chargedPaise = reservation?.amountPaise ?? 0;
    try {
      result = await this.sms.sendCampaignSms([phone], message);
    } finally {
      chargedPaise = await this.wallet.settleReservation(
        orgId,
        reservation,
        units,
        result.sent > 0 ? units : 0,
      );
    }
    return {
      success: result.sent > 0,
      channel: "sms" as const,
      sent: result.sent,
      failed: result.failed,
      chargedPaise,
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

type AlcoholOrg =
  | { businessType: BusinessType | null; settings?: { settings: unknown } | null }
  | null
  | undefined;

/**
 * Drinks need an org that serves alcohol (POS too). Customer orders must also be
 * dine-in / table QR and carry an age confirmation. Returns whether any line is alcohol.
 */
function assertAlcoholRules(
  items: Array<{ productType?: string | null }>,
  org: AlcoholOrg,
  opts: { customerOrder: boolean; orderType: string; ageConfirmed: boolean },
): boolean {
  if (!items.some((i) => isAlcoholProductType(i.productType))) return false;
  if (!orgServesAlcohol(org?.businessType ?? null, org?.settings?.settings)) {
    throw new BadRequestException("This restaurant does not serve alcohol");
  }
  if (opts.customerOrder) {
    if (!(ALCOHOL_CUSTOMER_ORDER_TYPES as readonly string[]).includes(opts.orderType)) {
      throw new BadRequestException("Drinks can only be ordered for dine-in");
    }
    if (!opts.ageConfirmed) {
      throw new BadRequestException("Please confirm you are of legal drinking age to order drinks");
    }
  }
  return true;
}

function parseDateFilter(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${field} date`);
  }
  return date;
}
