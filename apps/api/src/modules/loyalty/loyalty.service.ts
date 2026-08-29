import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

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

  async addStamp(orgId: string, customerId: string) {
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
        loyaltyPoints: rewardEarned ? customer.loyaltyPoints + 100 : customer.loyaltyPoints,
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
}
