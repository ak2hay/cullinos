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

  /**
   * Match delivery zone by outlet + pincode (primary) or nearest listed zone.
   * Admin stores pincode / estimatedMinutes on zone.polygon JSON.
   */
  async quote(input: {
    outletId?: string;
    address?: string;
    pincode?: string;
    lat?: number;
    lng?: number;
  }) {
    if (!input.outletId) {
      throw new BadRequestException("outletId is required");
    }
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: input.outletId, status: "active" },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const zones = await this.prisma.deliveryZone.findMany({
      where: { outletId: outlet.id },
      take: 100,
    });
    if (zones.length === 0) {
      return {
        inZone: false,
        fee: 0,
        minOrder: 0,
        estimatedMinutes: null,
        zoneId: null,
        reason: "No delivery zones configured",
      };
    }

    const pincode = input.pincode?.trim();
    let matched =
      pincode != null
        ? zones.find((z) => {
            const poly = (z.polygon ?? {}) as Record<string, unknown>;
            return String(poly.pincode ?? "") === pincode;
          })
        : undefined;

    if (!matched && zones.length === 1 && !pincode) {
      matched = zones[0];
    }

    if (!matched) {
      return {
        inZone: false,
        fee: 0,
        minOrder: 0,
        estimatedMinutes: null,
        zoneId: null,
        reason: pincode
          ? "Address pincode is outside delivery zones"
          : "Provide pincode to check delivery",
      };
    }

    const poly = (matched.polygon ?? {}) as Record<string, unknown>;
    const estimatedMinutes =
      typeof poly.estimatedMinutes === "number"
        ? poly.estimatedMinutes
        : Number(poly.estimatedMinutes) || null;

    return {
      inZone: true,
      fee: Number(matched.deliveryFee),
      minOrder: Number(matched.minOrder),
      estimatedMinutes,
      zoneId: matched.id,
      zoneName: matched.name,
      outletId: outlet.id,
      organizationId: outlet.organizationId,
    };
  }
}
