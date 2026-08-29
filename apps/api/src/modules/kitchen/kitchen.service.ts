import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class KitchenService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.kOT.findMany({
      where: { order: { organizationId: orgId }, status: { in: ["pending", "preparing"] } },
      include: { items: true, order: true },
      take: 200,
    });
  }
}
