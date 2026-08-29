import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MenuService } from "../menu/menu.service";

@Injectable()
export class StorefrontService {
  constructor(
    private prisma: PrismaService,
    private menuService: MenuService,
  ) {}

  async bootstrap(orgSlug: string, outletSlug: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { slug: orgSlug, status: { in: ["active", "trial"] } },
    });
    if (!organization) throw new NotFoundException("Organization not found");

    const outlet = await this.prisma.outlet.findFirst({
      where: {
        organizationId: organization.id,
        slug: outletSlug,
        status: "active",
      },
      include: { brand: true },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const menu = await this.menuService.getOutletMenu(organization.id, outlet.id);

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      outletId: outlet.id,
      outletName: outlet.name,
      outletSlug: outlet.slug,
      brandName: outlet.brand.name,
      orderModes: ["dine-in", "online"],
      menu,
    };
  }
}
