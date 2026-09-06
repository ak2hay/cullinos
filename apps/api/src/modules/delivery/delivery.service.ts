import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class DeliveryService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.deliveryZone.findMany({
      where: { organizationId: orgId },
      take: 200,
      orderBy: { name: "asc" },
    });
  }

  async createZone(
    orgId: string,
    data: {
      name: string;
      outletId?: string;
      pincode?: string;
      minOrder?: number;
      fee?: number;
      estimatedMinutes?: number;
    },
  ) {
    if (!data.name?.trim()) {
      throw new BadRequestException("name is required");
    }

    let outletId = data.outletId;
    if (outletId) {
      const outlet = await this.prisma.outlet.findFirst({
        where: { id: outletId, organizationId: orgId },
      });
      if (!outlet) throw new BadRequestException("Invalid outlet");
    } else {
      const outlet = await this.prisma.outlet.findFirst({
        where: { organizationId: orgId },
        orderBy: { createdAt: "asc" },
      });
      if (!outlet) throw new BadRequestException("No outlet found — create an outlet first");
      outletId = outlet.id;
    }

    const polygon: Record<string, unknown> = {};
    if (data.pincode) polygon.pincode = data.pincode;
    if (data.estimatedMinutes != null) polygon.estimatedMinutes = data.estimatedMinutes;

    return this.prisma.deliveryZone.create({
      data: {
        organizationId: orgId,
        outletId,
        name: data.name.trim(),
        deliveryFee: data.fee ?? 0,
        minOrder: data.minOrder ?? 0,
        polygon: Object.keys(polygon).length > 0 ? (polygon as never) : undefined,
      },
    });
  }

  async getZone(orgId: string, id: string) {
    const zone = await this.prisma.deliveryZone.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!zone) throw new NotFoundException("Delivery zone not found");
    return zone;
  }
}
