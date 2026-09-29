import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InsightsService {
  constructor(private prisma: PrismaService) {}

  async list(orgId: string) {
    const outlets = await this.prisma.outlet.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    if (outlets.length === 0) return [];
    return this.prisma.insightsSnapshot.findMany({
      where: { outletId: { in: outlets.map((o) => o.id) } },
      orderBy: { date: "desc" },
      take: 200,
    });
  }
}
