import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DeliveryService {
  constructor(private prisma: PrismaService) {}
  list(orgId: string) {
    return this.prisma.deliveryZone.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }
}
