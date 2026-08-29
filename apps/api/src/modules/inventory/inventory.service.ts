import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }
}
