import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OutletsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, brandId?: string) {
    return this.prisma.outlet
      .findMany({
        where: {
          organizationId: orgId,
          ...(brandId ? { brandId } : {}),
        },
        orderBy: { name: "asc" },
        take: 200,
      })
      .then((outlets) =>
        outlets.map((outlet) => ({
          id: outlet.id,
          name: outlet.name,
          code: outlet.code,
          city: outlet.city,
          brandId: outlet.brandId,
          operatingMode: outlet.operatingMode,
          isActive: outlet.status === "active",
        })),
      );
  }

  async update(orgId: string, id: string, data: Record<string, unknown>) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const allowed: Record<string, unknown> = {};
    if (data.operatingMode) allowed.operatingMode = data.operatingMode;
    if (data.name) allowed.name = data.name;
    if (data.phone !== undefined) allowed.phone = data.phone;

    return this.prisma.outlet.update({
      where: { id },
      data: allowed as never,
    });
  }
}
