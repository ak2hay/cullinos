import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.brand.findMany({
      where: { organizationId: orgId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: { _count: { select: { outlets: true } } },
    });
  }

  async get(orgId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, organizationId: orgId },
      include: { _count: { select: { outlets: true } } },
    });
    if (!brand) throw new NotFoundException("Brand not found");
    return brand;
  }

  async create(
    orgId: string,
    data: {
      name: string;
      code?: string;
      description?: string;
      logoUrl?: string;
      isDefault?: boolean;
    },
  ) {
    if (!data.name?.trim()) {
      throw new BadRequestException("name is required");
    }

    const baseSlug = slugify(data.code?.trim() || data.name);
    let slug = baseSlug || "brand";
    let attempt = 0;
    while (
      await this.prisma.brand.findFirst({
        where: { organizationId: orgId, slug },
      })
    ) {
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const existingCount = await this.prisma.brand.count({
      where: { organizationId: orgId },
    });
    const isDefault = data.isDefault === true || existingCount === 0;

    if (isDefault) {
      await this.prisma.brand.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const brand = await this.prisma.brand.create({
      data: {
        organizationId: orgId,
        name: data.name.trim(),
        slug,
        logoUrl: data.logoUrl,
        isDefault,
        settings: {
          create: {
            settings: data.description ? { description: data.description } : {},
          },
        },
      },
      include: { _count: { select: { outlets: true } } },
    });

    return brand;
  }
}
