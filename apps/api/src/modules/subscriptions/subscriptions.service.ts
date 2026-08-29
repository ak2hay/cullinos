import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.subscription.findMany({
      where: { organizationId: orgId },
      orderBy: { id: "desc" },
      take: 200,
    });
  }
}
