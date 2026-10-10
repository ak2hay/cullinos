import { Injectable, NotFoundException } from "@nestjs/common";
import {
  computeOpenNow,
  normalizeOpeningHours,
  OPENING_HOUR_DAYS,
  type DayHours,
} from "../../common/opening-hours.util";
import { PrismaService } from "../../prisma/prisma.service";
import { MenuService } from "../menu/menu.service";

const POPULAR_WINDOW_DAYS = 30;
const POPULAR_LIMIT = 6;

/** Today's opening window in the org timezone (null when hours are not configured). */
export function todayHours(
  openingHours: unknown,
  now: Date = new Date(),
  timeZone = "Asia/Kolkata",
): DayHours | null {
  const hours = normalizeOpeningHours(openingHours);
  if (!hours) return null;
  let weekday: string;
  try {
    weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" })
      .format(now)
      .toLowerCase()
      .slice(0, 3);
  } catch {
    weekday = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][now.getUTCDay()]!;
  }
  const day = OPENING_HOUR_DAYS.find((d) => d === weekday);
  return day ? (hours[day] ?? null) : null;
}

/** Best sellers first; specials fill the gap when there is little order history. */
export function pickPopularItemIds(
  rankedIds: string[],
  menuItems: Array<{ id: string; isSpecial?: boolean | null }>,
  limit = POPULAR_LIMIT,
): string[] {
  const onMenu = new Set(menuItems.map((i) => i.id));
  const out = rankedIds.filter((id) => onMenu.has(id)).slice(0, limit);
  for (const item of menuItems) {
    if (out.length >= limit) break;
    if (item.isSpecial && !out.includes(item.id)) out.push(item.id);
  }
  return out;
}

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
        settings: true,
        photos: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { url: true },
        },
      },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    return { organization, outlet };
  }

  private async rankedItemIds(orgId: string, outletId: string): Promise<string[]> {
    const since = new Date(Date.now() - POPULAR_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        menuItemId: { not: null },
        order: {
          organizationId: orgId,
          outletId,
          createdAt: { gte: since },
          status: { notIn: ["draft", "cancelled", "voided"] },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: POPULAR_LIMIT * 3,
    });
    return rows.map((r) => r.menuItemId).filter((id): id is string => Boolean(id));
  }

  async bootstrap(orgSlug: string, outletSlug: string) {
    const { organization, outlet } = await this.resolveActiveOutlet(orgSlug, outletSlug);
    const [menu, ranked] = await Promise.all([
      this.menuService.getOutletMenu(organization.id, outlet.id),
      this.rankedItemIds(organization.id, outlet.id).catch(() => [] as string[]),
    ]);

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

    const outletSettings =
      outlet.settings?.settings &&
      typeof outlet.settings.settings === "object" &&
      !Array.isArray(outlet.settings.settings)
        ? (outlet.settings.settings as Record<string, unknown>)
        : {};
    const timeZone =
      typeof organization.timezone === "string" && organization.timezone
        ? organization.timezone
        : "Asia/Kolkata";
    const now = new Date();

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
      openNow: computeOpenNow(outletSettings.openingHours, now, timeZone),
      todayHours: todayHours(outletSettings.openingHours, now, timeZone),
      popularItemIds: pickPopularItemIds(ranked, menu.items),
      orderModes: ["dine-in", "online"],
      menu,
    };
  }
}
