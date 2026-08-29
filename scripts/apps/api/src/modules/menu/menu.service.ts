import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.menuItem.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
