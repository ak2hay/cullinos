import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

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
          slug: outlet.slug,
          code: outlet.code,
          city: outlet.city,
          brandId: outlet.brandId,
          operatingMode: outlet.operatingMode,
          isActive: outlet.status === "active",
        })),
      );
  }

  async create(
    orgId: string,
    data: {
      name: string;
      city?: string;
      phone?: string;
      operatingMode?: string;
    },
  ) {
    // Find the default brand for this org
    const brand = await this.prisma.brand.findFirst({
      where: { organizationId: orgId, isDefault: true },
    });
    if (!brand) {
      // fallback to any brand
      const anyBrand = await this.prisma.brand.findFirst({
        where: { organizationId: orgId },
      });
      if (!anyBrand) throw new NotFoundException("No brand found for organisation");
    }
    const brandId = (brand ?? (await this.prisma.brand.findFirst({ where: { organizationId: orgId } })))!.id;

    const baseSlug = slugify(data.name);
    // Ensure slug is unique within org
    let slug = baseSlug;
    let attempt = 0;
    while (await this.prisma.outlet.findFirst({ where: { organizationId: orgId, slug } })) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const outlet = await this.prisma.outlet.create({
      data: {
        organizationId: orgId,
        brandId,
        name: data.name,
        slug,
        city: data.city,
        phone: data.phone,
        operatingMode: (data.operatingMode as never) ?? "full_service",
        settings: { create: { settings: {} } },
      },
    });

    return {
      id: outlet.id,
      name: outlet.name,
      slug: outlet.slug,
      city: outlet.city,
      operatingMode: outlet.operatingMode,
      isActive: outlet.status === "active",
    };
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
