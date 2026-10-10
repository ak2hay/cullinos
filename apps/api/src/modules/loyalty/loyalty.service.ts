import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const STAMPS_PER_CARD = 10;
const earnTransactionId = (orderId: string) => `earn_${orderId}`;

export type LoyaltySettings = {
  pointsPerCurrency: number;
  redemptionValue: number;
  minRedeem: number;
  stampCardEnabled: boolean;
};

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  pointsPerCurrency: 1,
  redemptionValue: 0.25,
  minRedeem: 100,
  stampCardEnabled: true,
};

const CLOSED_ORDER_STATUSES = ["completed", "cancelled", "voided"];

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Never discount more than is still owed; only charge the points needed to cover it. */
export function capRedemption(
  points: number,
  redemptionValue: number,
  outstanding: number,
): { pointsUsed: number; discountAmount: number } {
  const full = roundMoney(points * redemptionValue);
  if (full <= outstanding || redemptionValue <= 0) {
    return { pointsUsed: points, discountAmount: full };
  }
  return {
    pointsUsed: Math.min(points, Math.ceil(outstanding / redemptionValue - 1e-9)),
    discountAmount: outstanding,
  };
}

const NON_EARNING_ORDER_STATUSES = ["draft", "cancelled", "voided"];

@Injectable()
export class LoyaltyService {
  private readonly logger = new Logger(LoyaltyService.name);

  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.loyaltyTier.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }

  createTier(
    orgId: string,
    data: { name: string; minPoints?: number; multiplier?: number },
  ) {
    return this.prisma.loyaltyTier.create({
      data: {
        organizationId: orgId,
        name: data.name,
        minPoints: data.minPoints ?? 0,
        multiplier: data.multiplier ?? 1,
      },
    });
  }

  async deleteTier(orgId: string, tierId: string) {
    const existing = await this.prisma.loyaltyTier.findFirst({
      where: { id: tierId, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Tier not found");

    await this.prisma.$transaction([
      this.prisma.customer.updateMany({
        where: { organizationId: orgId, loyaltyTierId: tierId },
        data: { loyaltyTierId: null },
      }),
      this.prisma.loyaltyTier.delete({ where: { id: tierId } }),
    ]);

    return { ok: true };
  }

  private settingsJson(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  async getSettings(orgId: string): Promise<LoyaltySettings> {
    const row = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
    const json = this.settingsJson(row?.settings);
    const raw = (json.loyaltySettings as Partial<LoyaltySettings>) ?? {};
    return {
      pointsPerCurrency:
        typeof raw.pointsPerCurrency === "number"
          ? raw.pointsPerCurrency
          : DEFAULT_LOYALTY_SETTINGS.pointsPerCurrency,
      redemptionValue:
        typeof raw.redemptionValue === "number"
          ? raw.redemptionValue
          : DEFAULT_LOYALTY_SETTINGS.redemptionValue,
      minRedeem:
        typeof raw.minRedeem === "number"
          ? raw.minRedeem
          : DEFAULT_LOYALTY_SETTINGS.minRedeem,
      stampCardEnabled:
        typeof raw.stampCardEnabled === "boolean"
          ? raw.stampCardEnabled
          : DEFAULT_LOYALTY_SETTINGS.stampCardEnabled,
    };
  }

  async updateSettings(orgId: string, patch: Partial<LoyaltySettings>) {
    const existing = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
    const current = this.settingsJson(existing?.settings);
    const loyaltySettings = {
      ...(await this.getSettings(orgId)),
      ...patch,
    };
    const settings = { ...current, loyaltySettings };
    await this.prisma.organizationSettings.upsert({
      where: { organizationId: orgId },
      update: { settings: settings as never },
      create: { organizationId: orgId, settings: settings as never },
    });
    return loyaltySettings;
  }

  async addStamp(orgId: string, customerId: string) {
    const settings = await this.getSettings(orgId);
    if (!settings.stampCardEnabled) {
      throw new BadRequestException("Stamp card is disabled");
    }
    return this.prisma.$transaction(async (tx) => {
      const { customer, rewardEarned } = await this.bumpStampTx(tx, orgId, customerId);
      await tx.loyaltyTransaction.create({
        data: {
          customerId,
          points: rewardEarned ? 100 : 1,
          type: rewardEarned ? "stamp_reward" : "stamp",
          reference: `stamp:${rewardEarned ? STAMPS_PER_CARD : customer.stampCount}`,
        },
      });
      return { customer, stampCount: customer.stampCount, rewardEarned };
    });
  }

  /**
   * Atomic +1 stamp; a full card converts to 100 points. Increments are done in SQL so
   * concurrent stamps/orders can't overwrite each other.
   */
  private async bumpStampTx(tx: Prisma.TransactionClient, orgId: string, customerId: string) {
    const bumped = await tx.customer.updateMany({
      where: { id: customerId, organizationId: orgId },
      data: { stampCount: { increment: 1 } },
    });
    if (bumped.count === 0) throw new NotFoundException("Customer not found");
    const rewarded = await tx.customer.updateMany({
      where: { id: customerId, organizationId: orgId, stampCount: { gte: STAMPS_PER_CARD } },
      data: { stampCount: { decrement: STAMPS_PER_CARD }, loyaltyPoints: { increment: 100 } },
    });
    const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
    return { customer, rewardEarned: rewarded.count > 0 };
  }

  async redeemStamps(orgId: string, customerId: string) {
    const redeemed = await this.prisma.customer.updateMany({
      where: { id: customerId, organizationId: orgId, stampCount: { gte: STAMPS_PER_CARD } },
      data: { stampCount: 0, loyaltyPoints: { increment: 100 } },
    });
    if (redeemed.count === 0) {
      const exists = await this.prisma.customer.count({
        where: { id: customerId, organizationId: orgId },
      });
      if (!exists) throw new NotFoundException("Customer not found");
      throw new BadRequestException("Need 10 stamps to redeem");
    }
    return this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  }

  /** Earn points from a paid/completed order (idempotent). */
  async earnForOrder(
    orgId: string,
    orderId: string,
    customerId: string | null | undefined,
    orderTotal: number,
  ) {
    if (!customerId || orderTotal <= 0) return null;

    const existing = await this.prisma.loyaltyTransaction.findFirst({
      where: { customerId, reference: `order:${orderId}`, type: "earn" },
    });
    if (existing) return existing;

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
    });
    if (!customer) return null;

    const settings = await this.getSettings(orgId);
    const points = Math.floor(orderTotal * settings.pointsPerCurrency);
    if (points <= 0) return null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Deterministic id: a concurrent second completion hits the primary key and earns nothing.
        const transaction = await tx.loyaltyTransaction.create({
          data: {
            id: earnTransactionId(orderId),
            customerId,
            points,
            type: "earn",
            reference: `order:${orderId}`,
          },
        });
        let updated = await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: { increment: points } },
        });

        if (settings.stampCardEnabled) {
          const stamp = await this.bumpStampTx(tx, orgId, customerId);
          updated = stamp.customer;
          if (stamp.rewardEarned) {
            await tx.loyaltyTransaction.create({
              data: {
                customerId,
                points: 100,
                type: "stamp_reward",
                reference: `stamp_reward:${orderId}`,
              },
            });
          }
        }

        return { transaction, customer: updated, pointsEarned: points };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return this.prisma.loyaltyTransaction.findUnique({
          where: { id: earnTransactionId(orderId) },
        });
      }
      throw err;
    }
  }

  /**
   * Earn for an order once it is fully paid (or explicitly completed). Never throws:
   * a loyalty failure must not fail the payment or status change that triggered it.
   */
  async earnIfOrderSettled(
    orderId: string | null | undefined,
    opts: { organizationId?: string; force?: boolean } = {},
  ) {
    if (!orderId) return null;
    try {
      const order = await this.prisma.order.findFirst({
        where: {
          id: orderId,
          ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
        },
        select: { id: true, organizationId: true, customerId: true, status: true, total: true },
      });
      if (!order?.customerId) return null;
      if (NON_EARNING_ORDER_STATUSES.includes(order.status)) return null;

      const total = Number(order.total ?? 0);
      if (!opts.force && order.status !== "completed") {
        const paid = await this.prisma.payment.aggregate({
          where: { orderId: order.id, status: "completed" },
          _sum: { amount: true },
        });
        if (roundMoney(Number(paid._sum.amount ?? 0)) < roundMoney(total)) return null;
      }

      return await this.earnForOrder(order.organizationId, order.id, order.customerId, total);
    } catch (err) {
      this.logger.warn(
        `Loyalty earn failed for order ${orderId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * Redeem points for a discount amount (currency).
   * Returns discount amount in same units as order total.
   */
  async redeemPoints(
    orgId: string,
    customerId: string,
    points: number,
    orderId?: string,
    opts: { requireOwnedOrder?: boolean } = {},
  ) {
    if (!Number.isInteger(points) || points <= 0) {
      throw new BadRequestException("points must be a positive whole number");
    }

    const settings = await this.getSettings(orgId);
    if (points < settings.minRedeem) {
      throw new BadRequestException(
        `Minimum ${settings.minRedeem} points required to redeem`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, organizationId: orgId },
        select: { id: true, loyaltyPoints: true },
      });
      if (!customer) throw new NotFoundException("Customer not found");
      if (customer.loyaltyPoints < points) {
        throw new BadRequestException("Insufficient points");
      }

      let redemption = {
        pointsUsed: points,
        discountAmount: roundMoney(points * settings.redemptionValue),
      };

      if (orderId) {
        // Serialize redemptions on the same order so the outstanding cap can't be exceeded.
        await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      }
      const order = orderId
        ? await tx.order.findFirst({ where: { id: orderId, organizationId: orgId } })
        : null;
      if (orderId) {
        if (!order) throw new NotFoundException("Order not found");
        if (CLOSED_ORDER_STATUSES.includes(order.status)) {
          throw new BadRequestException("Cannot redeem points on a closed order");
        }
        if (
          (order.customerId && order.customerId !== customerId) ||
          (opts.requireOwnedOrder && order.customerId !== customerId)
        ) {
          throw new BadRequestException("Order belongs to a different customer");
        }
        const paid = await tx.payment.aggregate({
          where: { orderId: order.id, status: "completed" },
          _sum: { amount: true },
        });
        const outstanding = Math.max(
          0,
          roundMoney(Number(order.total) - Number(paid._sum.amount ?? 0)),
        );
        if (outstanding <= 0) {
          throw new BadRequestException("Order is already fully paid");
        }
        redemption = capRedemption(points, settings.redemptionValue, outstanding);
      }

      const { pointsUsed, discountAmount } = redemption;

      // Conditional decrement so concurrent redemptions cannot overspend the balance.
      const deducted = await tx.customer.updateMany({
        where: { id: customerId, organizationId: orgId, loyaltyPoints: { gte: pointsUsed } },
        data: { loyaltyPoints: { decrement: pointsUsed } },
      });
      if (deducted.count === 0) {
        throw new BadRequestException("Insufficient points");
      }

      await tx.loyaltyTransaction.create({
        data: {
          customerId,
          points: -pointsUsed,
          type: "redeem",
          reference: orderId ? `redeem:${orderId}` : `redeem:${Date.now()}`,
        },
      });

      if (order) {
        const note = `Loyalty −₹${discountAmount.toFixed(2)} (${pointsUsed} pts)`;
        await tx.orderDiscount.create({
          data: {
            orderId: order.id,
            type: "loyalty",
            value: pointsUsed,
            amount: discountAmount,
          },
        });
        await tx.order.update({
          where: { id: order.id },
          data: {
            customerId: order.customerId ?? customerId,
            discountTotal: roundMoney(Number(order.discountTotal) + discountAmount),
            total: Math.max(0, roundMoney(Number(order.total) - discountAmount)),
            notes: order.notes ? `${order.notes} · ${note}` : note,
            timeline: {
              create: {
                event: "order.discount",
                metadata: { amount: discountAmount, type: "loyalty", points: pointsUsed },
              },
            },
          },
        });
      }

      const updated = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
      return {
        customer: updated,
        pointsRedeemed: pointsUsed,
        discountAmount,
        remainingPoints: updated.loyaltyPoints,
      };
    });
  }

  listRewards(orgId: string, activeOnly = false) {
    return this.prisma.loyaltyReward.findMany({
      where: {
        organizationId: orgId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      include: { menuItem: { select: { id: true, name: true, basePrice: true } } },
      orderBy: { pointsCost: "asc" },
      take: 200,
    });
  }

  private async assertOwnedRewardMenuItem(orgId: string, menuItemId: unknown) {
    if (menuItemId == null || menuItemId === "") return;
    if (typeof menuItemId !== "string") throw new BadRequestException("Invalid menuItemId");
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, organizationId: orgId },
      select: { id: true },
    });
    if (!item) throw new BadRequestException("Invalid menuItemId");
  }

  async createReward(
    orgId: string,
    data: {
      name: string;
      pointsCost: number;
      menuItemId?: string | null;
      isActive?: boolean;
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("name is required");
    if (!Number.isFinite(data.pointsCost) || data.pointsCost <= 0) {
      throw new BadRequestException("pointsCost must be a positive number");
    }
    await this.assertOwnedRewardMenuItem(orgId, data.menuItemId);
    return this.prisma.loyaltyReward.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        pointsCost: Math.floor(data.pointsCost),
        menuItemId: data.menuItemId || null,
        isActive: data.isActive !== false,
      },
      include: { menuItem: { select: { id: true, name: true, basePrice: true } } },
    });
  }

  async updateReward(
    orgId: string,
    rewardId: string,
    patch: {
      name?: string;
      pointsCost?: number;
      menuItemId?: string | null;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.loyaltyReward.findFirst({
      where: { id: rewardId, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Reward not found");
    if (
      patch.pointsCost !== undefined &&
      (!Number.isFinite(patch.pointsCost) || patch.pointsCost <= 0)
    ) {
      throw new BadRequestException("pointsCost must be a positive number");
    }
    if (patch.menuItemId !== undefined) {
      await this.assertOwnedRewardMenuItem(orgId, patch.menuItemId);
    }
    return this.prisma.loyaltyReward.update({
      where: { id: rewardId },
      data: {
        ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
        ...(patch.pointsCost !== undefined
          ? { pointsCost: Math.floor(patch.pointsCost) }
          : {}),
        ...(patch.menuItemId !== undefined ? { menuItemId: patch.menuItemId } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      },
      include: { menuItem: { select: { id: true, name: true, basePrice: true } } },
    });
  }

  async deleteReward(orgId: string, rewardId: string) {
    const existing = await this.prisma.loyaltyReward.findFirst({
      where: { id: rewardId, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Reward not found");
    await this.prisma.loyaltyReward.delete({ where: { id: rewardId } });
    return { ok: true };
  }

  /**
   * Redeem a catalog reward (e.g. free cold drink for 100 pts).
   * Returns free menu item details for POS/customer to attach at ₹0.
   */
  async redeemReward(
    orgId: string,
    customerId: string,
    rewardId: string,
    orderId?: string,
    opts: { requireOwnedOrder?: boolean } = {},
  ) {
    const reward = await this.prisma.loyaltyReward.findFirst({
      where: { id: rewardId, organizationId: orgId, isActive: true },
      include: { menuItem: true },
    });
    if (!reward) throw new NotFoundException("Reward not found");

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    if (orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, organizationId: orgId },
        select: { status: true, customerId: true },
      });
      if (!order) throw new NotFoundException("Order not found");
      if (CLOSED_ORDER_STATUSES.includes(order.status)) {
        throw new BadRequestException("Cannot add a reward to a closed order");
      }
      if (
        (order.customerId && order.customerId !== customerId) ||
        (opts.requireOwnedOrder && order.customerId !== customerId)
      ) {
        throw new BadRequestException("Order belongs to another customer");
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const deducted = await tx.customer.updateMany({
        where: {
          id: customerId,
          organizationId: orgId,
          loyaltyPoints: { gte: reward.pointsCost },
        },
        data: { loyaltyPoints: { decrement: reward.pointsCost } },
      });
      if (deducted.count === 0) {
        throw new BadRequestException("Insufficient points");
      }

      await tx.loyaltyTransaction.create({
        data: {
          customerId,
          points: -reward.pointsCost,
          type: "redeem_reward",
          reference: orderId
            ? `reward:${reward.id}:order:${orderId}`
            : `reward:${reward.id}:${Date.now()}`,
        },
      });

      if (orderId && reward.menuItemId && reward.menuItem) {
        await tx.orderItem.create({
          data: {
            orderId,
            menuItemId: reward.menuItemId,
            name: `${reward.menuItem.name} (reward)`,
            quantity: 1,
            unitPrice: 0,
            taxAmount: 0,
            total: 0,
            notes: `Loyalty reward: ${reward.name}`,
          },
        });
      }

      return tx.customer.findUniqueOrThrow({ where: { id: customerId } });
    });

    return {
      customer: updated,
      reward: {
        id: reward.id,
        name: reward.name,
        pointsCost: reward.pointsCost,
        menuItemId: reward.menuItemId,
        menuItemName: reward.menuItem?.name ?? null,
      },
      pointsRedeemed: reward.pointsCost,
      remainingPoints: updated.loyaltyPoints,
      freeMenuItem: reward.menuItem
        ? {
            id: reward.menuItem.id,
            name: reward.menuItem.name,
            unitPrice: 0,
          }
        : null,
    };
  }

  quoteRedeem(settings: LoyaltySettings, points: number) {
    return {
      points,
      discountAmount: points * settings.redemptionValue,
      minRedeem: settings.minRedeem,
    };
  }

  /** Customer portal: balance, settings, and recent transactions. */
  async getCustomerPortal(orgId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
      select: {
        id: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
        stampCount: true,
      },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const [settings, recentTransactions] = await Promise.all([
      this.getSettings(orgId),
      this.prisma.loyaltyTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          points: true,
          type: true,
          reference: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      loyaltyPoints: customer.loyaltyPoints,
      stampCount: customer.stampCount,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      },
      settings,
      recentTransactions,
    };
  }
}
