import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Body,
  Query,
  UseGuards,
} from "@nestjs/common";
import { isAlcoholProductType, orgServesAlcohol } from "@cullinos/shared";
import { Public } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { CouponsService } from "../coupons/coupons.service";
import { mapOrderToClient } from "../../common/order-items.util";
import {
  CurrentGuest,
  GuestAuth,
  GuestAuthGuard,
  type GuestJwtPayload,
} from "./guest-auth.util";
import { GuestService } from "./guest.service";
import { GuestPushService } from "./guest-push.service";

@Controller("public/guest")
@UseGuards(GuestAuthGuard)
export class GuestOrdersController {
  constructor(
    private prisma: PrismaService,
    private guest: GuestService,
    private payments: PaymentsService,
    private coupons: CouponsService,
    private push: GuestPushService,
  ) {}

  @Public()
  @GuestAuth()
  @Get("orders")
  async listOrders(
    @CurrentGuest() guest: GuestJwtPayload,
    @Query("limit") limitRaw?: string,
  ) {
    const customerIds = await this.guest.customerIdsForGuest(guest.sub);
    if (customerIds.length === 0) return [];
    const limit = Math.min(Number(limitRaw) || 50, 100);
    const orders = await this.prisma.order.findMany({
      where: { customerId: { in: customerIds } },
      include: {
        items: true,
        outlet: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImageUrl: true,
            organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
          },
        },
        deliveryOrder: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return orders.map((o) => ({
      ...mapOrderToClient(o),
      outlet: o.outlet,
      delivery: o.deliveryOrder,
    }));
  }

  @Public()
  @GuestAuth()
  @Get("orders/:id")
  async getOrder(
    @CurrentGuest() guest: GuestJwtPayload,
    @Param("id") id: string,
  ) {
    const customerIds = await this.guest.customerIdsForGuest(guest.sub);
    const order = await this.prisma.order.findFirst({
      where: { id, customerId: { in: customerIds } },
      include: {
        items: true,
        taxLines: true,
        outlet: {
          select: {
            id: true,
            name: true,
            slug: true,
            address: true,
            phone: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
        deliveryOrder: true,
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    return {
      ...mapOrderToClient(order),
      outlet: order.outlet,
      delivery: order.deliveryOrder,
    };
  }

  @Public()
  @GuestAuth()
  @Post("payments/intent")
  async paymentIntent(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body() body: { orderId?: string; provider?: string },
  ) {
    if (!body.orderId) throw new BadRequestException("orderId is required");
    const order = await this.requireOwnedOrder(guest.sub, body.orderId);
    return this.payments.createOnlineIntent(
      order.organizationId,
      order.id,
      undefined,
      body.provider,
    );
  }

  @Public()
  @GuestAuth()
  @Post("payments/verify")
  async paymentVerify(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body()
    body: {
      orderId?: string;
      provider?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
      cashfreeOrderId?: string;
    },
  ) {
    if (!body.orderId) throw new BadRequestException("orderId is required");
    const order = await this.requireOwnedOrder(guest.sub, body.orderId);
    const result = await this.payments.verifyOnlinePayment(
      order.organizationId,
      {
        provider: body.provider,
        razorpayOrderId: body.razorpayOrderId,
        razorpayPaymentId: body.razorpayPaymentId,
        razorpaySignature: body.razorpaySignature,
        cashfreeOrderId: body.cashfreeOrderId,
      },
      { expectedOrderId: order.id },
    );
    if (!result.success || result.orderId !== order.id) {
      return { ...result, coinsAwarded: 0 };
    }
    if (!("alreadyPaid" in result && result.alreadyPaid)) {
      await this.push.notifyCustomerOrder(order.customerId, {
        title: "Payment received",
        body: `Order #${order.orderNumber} payment confirmed`,
        data: { orderId: order.id, type: "payment.confirmed" },
      });
    }
    let coinsAwarded = 0;
    try {
      const paid = await this.prisma.payment.aggregate({
        where: { orderId: order.id, status: "completed" },
        _sum: { amount: true },
      });
      if (Number(paid._sum.amount ?? 0) + 0.005 >= Number(order.total)) {
        const award = await this.guest.awardCoinsForPaidOrder(guest.sub, order);
        coinsAwarded = award.awarded ?? 0;
      }
    } catch {
      // Payment already succeeded — never fail verify on coin ledger errors.
    }
    return { ...result, coinsAwarded };
  }

  @Public()
  @GuestAuth()
  @Post("coupons/validate")
  async validateCoupon(
    @CurrentGuest() guest: GuestJwtPayload,
    @Body() body: { orgId?: string; code?: string; orderTotal?: number },
  ) {
    if (!body.orgId || !body.code) {
      throw new BadRequestException("orgId and code are required");
    }
    await this.guest.requireMembershipCustomer(guest.sub, body.orgId);
    return this.coupons.validate(
      body.orgId,
      body.code,
      Number(body.orderTotal) || 0,
    );
  }

  @Public()
  @GuestAuth()
  @Post("orders/:id/reorder-preview")
  async reorderPreview(
    @CurrentGuest() guest: GuestJwtPayload,
    @Param("id") id: string,
  ) {
    const customerIds = await this.guest.customerIdsForGuest(guest.sub);
    const order = await this.prisma.order.findFirst({
      where: { id, customerId: { in: customerIds } },
      include: {
        items: true,
        outlet: {
          select: {
            id: true,
            name: true,
            slug: true,
            organization: { select: { id: true, slug: true, name: true } },
          },
        },
        organization: {
          select: { businessType: true, settings: { select: { settings: true } } },
        },
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    const servesAlcohol = orgServesAlcohol(
      order.organization.businessType,
      order.organization.settings?.settings,
    );

    const available: Array<{
      menuItemId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      variantId: string | null;
      modifiers: unknown;
      isAlcohol: boolean;
    }> = [];
    const unavailable: Array<{ name: string; reason: string }> = [];

    for (const item of order.items) {
      if (!item.menuItemId) {
        unavailable.push({ name: item.name, reason: "Item no longer linked" });
        continue;
      }
      const menuItem = await this.prisma.menuItem.findFirst({
        where: { id: item.menuItemId, organizationId: order.organizationId, isActive: true },
        include: {
          outletPrices: {
            where: { outletId: order.outletId, priceType: "retail" },
            take: 1,
          },
        },
      });
      if (!menuItem) {
        unavailable.push({ name: item.name, reason: "Unavailable" });
        continue;
      }
      const isAlcohol = isAlcoholProductType(menuItem.productType);
      if (isAlcohol && !servesAlcohol) {
        unavailable.push({ name: item.name, reason: "Drinks not served" });
        continue;
      }
      const outletPrice = menuItem.outletPrices[0];
      if (outletPrice && !outletPrice.isAvailable) {
        unavailable.push({ name: item.name, reason: "Unavailable at outlet" });
        continue;
      }
      const priceRupees = outletPrice
        ? Number(outletPrice.price)
        : Number(menuItem.basePrice);
      available.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        quantity: item.quantity,
        unitPrice: priceRupees,
        variantId: item.variantId,
        modifiers: item.modifiers,
        isAlcohol,
      });
    }

    return {
      orderId: order.id,
      outlet: order.outlet,
      organizationId: order.organizationId,
      outletId: order.outletId,
      available,
      unavailable,
      unavailableCount: unavailable.length,
    };
  }

  private async requireOwnedOrder(guestUserId: string, orderId: string) {
    const customerIds = await this.guest.customerIdsForGuest(guestUserId);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: { in: customerIds } },
    });
    if (!order) throw new ForbiddenException("Order not found");
    return order;
  }
}
