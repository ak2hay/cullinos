import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateTierInput {
  name: string;
  minPoints?: number;
  discountPct?: number;
  sortOrder?: number;
}

export interface UpdateTierInput {
  name?: string;
  minPoints?: number;
  discountPct?: number;
  sortOrder?: number;
}

export interface PointsTransactionInput {
  accountId: string;
  points: number;
  orderId?: string;
  notes?: string;
}

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Tiers ---

  async findAllTiers(organizationId: string) {
    return this.prisma.client.loyaltyTier.findMany({
      where: { organizationId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createTier(
    organizationId: string,
    userId: string,
    input: CreateTierInput,
  ) {
    const tier = await this.prisma.client.loyaltyTier.create({
      data: { organizationId, ...input },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'LOYALTY_TIER_CREATED',
      entityType: 'LoyaltyTier',
      entityId: tier.id,
    });

    return tier;
  }

  async updateTier(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateTierInput,
  ) {
    const tier = await this.prisma.client.loyaltyTier.findFirst({
      where: { id, organizationId },
    });
    if (!tier) throw new NotFoundException('Loyalty tier not found');

    const updated = await this.prisma.client.loyaltyTier.update({
      where: { id },
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'LOYALTY_TIER_UPDATED',
      entityType: 'LoyaltyTier',
      entityId: id,
    });

    return updated;
  }

  async deleteTier(id: string, organizationId: string, userId: string) {
    const tier = await this.prisma.client.loyaltyTier.findFirst({
      where: { id, organizationId },
    });
    if (!tier) throw new NotFoundException('Loyalty tier not found');

    await this.prisma.client.loyaltyTier.delete({ where: { id } });

    await this.audit.log({
      organizationId,
      userId,
      action: 'LOYALTY_TIER_DELETED',
      entityType: 'LoyaltyTier',
      entityId: id,
    });

    return { success: true };
  }

  // --- Accounts ---

  async getOrCreateAccount(customerId: string, organizationId: string) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: customerId, organizationId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    let account = await this.prisma.client.loyaltyAccount.findUnique({
      where: { customerId },
      include: { tier: true, customer: true },
    });

    if (!account) {
      account = await this.prisma.client.loyaltyAccount.create({
        data: { customerId },
        include: { tier: true, customer: true },
      });
    }

    return account;
  }

  async findAccount(id: string, organizationId: string) {
    const account = await this.prisma.client.loyaltyAccount.findFirst({
      where: { id, customer: { organizationId } },
      include: {
        tier: true,
        customer: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!account) throw new NotFoundException('Loyalty account not found');
    return account;
  }

  private async resolveTier(organizationId: string, points: number) {
    const tiers = await this.prisma.client.loyaltyTier.findMany({
      where: { organizationId },
      orderBy: { minPoints: 'desc' },
    });
    return tiers.find((t) => points >= t.minPoints) ?? null;
  }

  async addPoints(
    organizationId: string,
    userId: string,
    input: PointsTransactionInput,
  ) {
    if (input.points <= 0) {
      throw new BadRequestException('Points must be positive');
    }

    const account = await this.findAccount(input.accountId, organizationId);
    const newPoints = account.points + input.points;
    const tier = await this.resolveTier(organizationId, newPoints);

    const result = await this.prisma.client.$transaction(async (tx) => {
      const transaction = await tx.loyaltyTransaction.create({
        data: {
          accountId: input.accountId,
          type: 'EARN',
          points: input.points,
          orderId: input.orderId,
          notes: input.notes,
        },
      });

      const updated = await tx.loyaltyAccount.update({
        where: { id: input.accountId },
        data: { points: newPoints, tierId: tier?.id ?? account.tierId },
        include: { tier: true },
      });

      return { account: updated, transaction };
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'LOYALTY_POINTS_ADDED',
      entityType: 'LoyaltyAccount',
      entityId: input.accountId,
      newValue: { points: input.points },
    });

    return result;
  }

  async deductPoints(
    organizationId: string,
    userId: string,
    input: PointsTransactionInput,
  ) {
    if (input.points <= 0) {
      throw new BadRequestException('Points must be positive');
    }

    const account = await this.findAccount(input.accountId, organizationId);
    if (account.points < input.points) {
      throw new BadRequestException('Insufficient loyalty points');
    }

    const newPoints = account.points - input.points;
    const tier = await this.resolveTier(organizationId, newPoints);

    const result = await this.prisma.client.$transaction(async (tx) => {
      const transaction = await tx.loyaltyTransaction.create({
        data: {
          accountId: input.accountId,
          type: 'REDEEM',
          points: -input.points,
          orderId: input.orderId,
          notes: input.notes,
        },
      });

      const updated = await tx.loyaltyAccount.update({
        where: { id: input.accountId },
        data: { points: newPoints, tierId: tier?.id ?? null },
        include: { tier: true },
      });

      return { account: updated, transaction };
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'LOYALTY_POINTS_DEDUCTED',
      entityType: 'LoyaltyAccount',
      entityId: input.accountId,
      newValue: { points: input.points },
    });

    return result;
  }
}
