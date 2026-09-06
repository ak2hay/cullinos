import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

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

@Injectable()
export class LoyaltyService {
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
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
    });
    if (!customer) throw new NotFoundException("Customer not found");

    const newCount = customer.stampCount + 1;
    const rewardEarned = newCount >= 10;

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        stampCount: rewardEarned ? 0 : newCount,
        loyaltyPoints: rewardEarned
          ? customer.loyaltyPoints + 100
          : customer.loyaltyPoints,
      },
    });

    await this.prisma.loyaltyTransaction.create({
      data: {
        customerId,
        points: rewardEarned ? 100 : 1,
        type: rewardEarned ? "stamp_reward" : "stamp",
        reference: `stamp:${newCount}`,
      },
    });

    return {
      customer: updated,
      stampCount: rewardEarned ? 0 : newCount,
      rewardEarned,
    };
  }

  async redeemStamps(orgId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    if (customer.stampCount < 10) {
      throw new BadRequestException("Need 10 stamps to redeem");
    }
    return this.prisma.customer.update({
      where: { id: customerId },
      data: { stampCount: 0, loyaltyPoints: customer.loyaltyPoints + 100 },
    });
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

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { increment: points } },
    });

    const tx = await this.prisma.loyaltyTransaction.create({
      data: {
        customerId,
        points,
        type: "earn",
        reference: `order:${orderId}`,
      },
    });

    if (settings.stampCardEnabled) {
      const newCount = updated.stampCount + 1;
      const rewardEarned = newCount >= 10;
      await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          stampCount: rewardEarned ? 0 : newCount,
          ...(rewardEarned ? { loyaltyPoints: { increment: 100 } } : {}),
        },
      });
      if (rewardEarned) {
        await this.prisma.loyaltyTransaction.create({
          data: {
            customerId,
            points: 100,
            type: "stamp_reward",
            reference: `stamp_reward:${orderId}`,
          },
        });
      }
    }

    return { transaction: tx, customer: updated, pointsEarned: points };
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
  ) {
    if (!Number.isFinite(points) || points <= 0) {
      throw new BadRequestException("points must be a positive number");
    }

    const settings = await this.getSettings(orgId);
    if (points < settings.minRedeem) {
      throw new BadRequestException(
        `Minimum ${settings.minRedeem} points required to redeem`,
      );
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    if (customer.loyaltyPoints < points) {
      throw new BadRequestException("Insufficient points");
    }

    const discountAmount = points * settings.redemptionValue;

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { decrement: points } },
    });

    await this.prisma.loyaltyTransaction.create({
      data: {
        customerId,
        points: -points,
        type: "redeem",
        reference: orderId ? `redeem:${orderId}` : `redeem:${Date.now()}`,
      },
    });

    if (orderId) {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, organizationId: orgId },
      });
      if (order) {
        const newTotal = Math.max(0, Number(order.total) - discountAmount);
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            total: newTotal,
            notes: order.notes
              ? `${order.notes} · Loyalty −₹${discountAmount.toFixed(2)} (${points} pts)`
              : `Loyalty −₹${discountAmount.toFixed(2)} (${points} pts)`,
          },
        });
      }
    }

    return {
      customer: updated,
      pointsRedeemed: points,
      discountAmount,
      remainingPoints: updated.loyaltyPoints,
    };
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

  createReward(
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
    if (customer.loyaltyPoints < reward.pointsCost) {
      throw new BadRequestException("Insufficient points");
    }

    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { decrement: reward.pointsCost } },
    });

    await this.prisma.loyaltyTransaction.create({
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
      const unitPrice = 0;
      await this.prisma.orderItem.create({
        data: {
          orderId,
          menuItemId: reward.menuItemId,
          name: `${reward.menuItem.name} (reward)`,
          quantity: 1,
          unitPrice,
          taxAmount: 0,
          total: 0,
          notes: `Loyalty reward: ${reward.name}`,
        },
      });
    }

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
