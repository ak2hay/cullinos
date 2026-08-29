import { Injectable } from "@nestjs/common";
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
}
