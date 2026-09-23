import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { MenuService } from "../menu/menu.service";

@Injectable()
export class StorefrontService {
  constructor(
    private prisma: PrismaService,
    private menuService: MenuService,
  ) {}

  async resolveActiveOutlet(orgSlug: string, outletSlug: string) {
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
      include: {
        brand: { include: { settings: true } },
        photos: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { url: true },
        },
      },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    return { organization, outlet };
  }

  async bootstrap(orgSlug: string, outletSlug: string) {
    const { organization, outlet } = await this.resolveActiveOutlet(orgSlug, outletSlug);
    const menu = await this.menuService.getOutletMenu(organization.id, outlet.id);

    const brandSettings =
      outlet.brand.settings?.settings &&
      typeof outlet.brand.settings.settings === "object" &&
      !Array.isArray(outlet.brand.settings.settings)
        ? (outlet.brand.settings.settings as Record<string, unknown>)
        : {};
    const accentRaw = brandSettings.accentColor ?? brandSettings.primaryColor;
    const accentColor =
      typeof accentRaw === "string" && /^#[0-9A-Fa-f]{6}$/.test(accentRaw)
        ? accentRaw
        : null;

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      outletId: outlet.id,
      outletName: outlet.name,
      outletSlug: outlet.slug,
      brandName: outlet.brand.name,
      logoUrl: outlet.brand.logoUrl ?? organization.logoUrl ?? null,
      coverImageUrl: outlet.coverImageUrl ?? null,
      photoUrls: (outlet.photos ?? []).map((p) => p.url),
      accentColor,
      orderModes: ["dine-in", "online"],
      menu,
    };
  }
}
