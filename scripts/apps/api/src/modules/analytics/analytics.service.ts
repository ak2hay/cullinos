import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.analyticsSnapshot.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
