import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const DEVICE_TYPES = ["pos", "kds", "printer", "gateway", "scanner", "other"] as const;

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.device.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      take: 200,
    });
  }

  async create(
    orgId: string,
    data: {
      name: string;
      type: string;
      outletId?: string;
      identifier?: string;
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("name is required");
    const type = (data.type || "printer").toLowerCase();
    if (!(DEVICE_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException(
        `type must be one of: ${DEVICE_TYPES.join(", ")}`,
      );
    }

    if (data.outletId) {
      const outlet = await this.prisma.outlet.findFirst({
        where: { id: data.outletId, organizationId: orgId },
      });
      if (!outlet) throw new NotFoundException("Outlet not found");
    }

    return this.prisma.device.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        type: type as never,
        outletId: data.outletId || null,
        identifier: data.identifier?.trim() || null,
      },
    });
  }
}
