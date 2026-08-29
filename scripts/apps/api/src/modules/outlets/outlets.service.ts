import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OutletsService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.outlet.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
