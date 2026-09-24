import { Injectable, NotFoundException } from "@nestjs/common";
import {
  DEFAULT_GUEST_THEME_KEY,
  isGuestThemePresetKey,
  resolveGuestThemePreset,
} from "@cullinos/shared";
import { computeOpenNow } from "../../common/opening-hours.util";
import { toPaise } from "../../common/money.util";
import { normalizePublicAssetUrl } from "../../common/public-asset-url.util";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private platformConfig: PlatformConfigService,
  ) {}

  appConfig() {
    let featureFlags: Record<string, unknown> = {};
    const rawFlags = this.platformConfig.get("GUEST_APP_FEATURE_FLAGS") || "";
    if (rawFlags.trim()) {
      try {
        featureFlags = JSON.parse(rawFlags) as Record<string, unknown>;
      } catch {
        featureFlags = {};
      }
    }
    return {
      minVersionCode: Number(
        this.platformConfig.get("GUEST_APP_MIN_VERSION") || "1",
      ),
      forceUpdate:
        String(this.platformConfig.get("GUEST_APP_FORCE_UPDATE") || "")
          .toLowerCase() === "true",
      softUpdateMessage:
        this.platformConfig.get("GUEST_APP_SOFT_UPDATE_MESSAGE") || null,
      maintenanceMessage:
        this.platformConfig.get("GUEST_APP_MAINTENANCE") || null,
      playStoreUrl:
        this.platformConfig.get("GUEST_APP_PLAY_STORE_URL") || null,
      waiterPlayStoreUrl:
        this.platformConfig.get("WAITER_APP_PLAY_STORE_URL") || null,
      supportUrl: this.platformConfig.get("GUEST_APP_SUPPORT_URL") || null,
      privacyUrl: this.platformConfig.get("GUEST_APP_PRIVACY_URL") || null,
      termsUrl: this.platformConfig.get("GUEST_APP_TERMS_URL") || null,
      featureFlags,
      platformDefaultGuestThemeKey: (() => {
        const raw =
          this.platformConfig.get("PLATFORM_DEFAULT_GUEST_THEME_KEY") ||
          DEFAULT_GUEST_THEME_KEY;
        return isGuestThemePresetKey(raw) ? raw : DEFAULT_GUEST_THEME_KEY;
      })(),
    };
  }

  async nearby(query: {
    lat?: number;
    lng?: number;
    radiusKm?: number;
    q?: string;
    cuisine?: string;
    openNow?: boolean;
    city?: string;
    limit?: number;
    dineIn?: boolean;
    takeaway?: boolean;
    delivery?: boolean;
    veg?: boolean;
    offersOnly?: boolean;
  }) {
    const limit = Math.min(query.limit ?? 50, 100);
    const radiusKm = query.radiusKm ?? 15;
    const hasGeo =
      query.lat != null &&
      query.lng != null &&
      Number.isFinite(query.lat) &&
      Number.isFinite(query.lng);

    const outlets = await this.prisma.outlet.findMany({
      where: {
        marketplaceListed: true,
        marketplaceUnlistedByPlatform: false,
        marketplaceModerationStatus: "approved",
        status: "active",
        organization: { status: { in: ["active", "trial"] } },
        ...(query.city
          ? { city: { equals: query.city, mode: "insensitive" } }
          : {}),
        ...(query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { address: { contains: query.q, mode: "insensitive" } },
                { city: { contains: query.q, mode: "insensitive" } },
                {
                  organization: {
                    name: { contains: query.q, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
        ...(query.cuisine
          ? { cuisineTags: { has: query.cuisine.toLowerCase() } }
          : {}),
        ...(query.veg
          ? {
              AND: [
                {
                  organization: {
                    menuItems: { some: { isActive: true, isVeg: true } },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            businessType: true,
            timezone: true,
            settings: true,
          },
        },
        brand: { select: { id: true, name: true, logoUrl: true } },
        settings: true,
        _count: {
          select: {
            guestReviews: { where: { status: "visible" } },
          },
        },
        guestReviews: {
          where: { status: "visible" },
          select: { rating: true },
          take: 200,
        },
      },
      take: 500,
      orderBy: { name: "asc" },
    });

    let offerOrgIds: Set<string> | null = null;
    if (query.offersOnly) {
      const coupons = await this.prisma.coupon.findMany({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { organizationId: true },
        take: 500,
      });
      offerOrgIds = new Set(coupons.map((c) => c.organizationId));
    }

    const mapped = outlets
      .map((o) => {
        const lat = o.latitude != null ? Number(o.latitude) : null;
        const lng = o.longitude != null ? Number(o.longitude) : null;
        const distanceKm =
          hasGeo && lat != null && lng != null
            ? haversineKm(query.lat!, query.lng!, lat, lng)
            : null;
        const orgSettings = (o.organization.settings?.settings ?? {}) as Record<
          string,
          unknown
        >;
        const enabledOrderTypes = Array.isArray(orgSettings.enabledOrderTypes)
          ? (orgSettings.enabledOrderTypes as string[])
          : ["dine_in", "takeaway", "delivery"];
        const orderModes = {
          dineIn:
            enabledOrderTypes.includes("dine_in") ||
            enabledOrderTypes.includes("qr"),
          takeaway:
            enabledOrderTypes.includes("takeaway") ||
            enabledOrderTypes.includes("online"),
          delivery: enabledOrderTypes.includes("delivery"),
        };
        const ratings = o.guestReviews.map((r) => r.rating);
        const averageRating =
          ratings.length === 0
            ? null
            : Math.round(
                (ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10,
              ) / 10;
        const outletSettings = (o.settings?.settings ?? {}) as Record<
          string,
          unknown
        >;
        const openingHours = outletSettings.openingHours ?? null;
        const tz =
          typeof o.organization.timezone === "string" && o.organization.timezone
            ? o.organization.timezone
            : "Asia/Kolkata";
        const openNow = computeOpenNow(openingHours, new Date(), tz);
        return {
          id: o.id,
          name: o.name,
          slug: o.slug,
          address: o.address,
          city: o.city,
          state: o.state,
          pincode: o.pincode,
          phone: o.phone,
          latitude: lat,
          longitude: lng,
          cuisineTags: o.cuisineTags,
          coverImageUrl: normalizePublicAssetUrl(o.coverImageUrl),

          averagePrepMinutes: o.averagePrepMinutes,
          marketplaceFeatured: o.marketplaceFeatured,
          marketplaceFeaturedRank: o.marketplaceFeaturedRank,
          distanceKm,
          averageRating,
          reviewCount: o._count.guestReviews,
          openingHours,
          openNow,
          organization: {
            id: o.organization.id,
            name: o.organization.name,
            slug: o.organization.slug,
            logoUrl: o.organization.logoUrl,
            businessType: o.organization.businessType,
          },
          brand: o.brand,
          orderModes,
        };
      })
      .filter((o) => {
        if (query.dineIn && !o.orderModes.dineIn) return false;
        if (query.takeaway && !o.orderModes.takeaway) return false;
        if (query.delivery && !o.orderModes.delivery) return false;
        if (offerOrgIds && !offerOrgIds.has(o.organization.id)) return false;
        if (query.openNow === true && o.openNow !== true) return false;
        if (!hasGeo) return true;
        if (o.distanceKm == null) return true;
        return o.distanceKm <= radiusKm;
      })
      .sort((a, b) => {
        if (a.marketplaceFeatured !== b.marketplaceFeatured) {
          return a.marketplaceFeatured ? -1 : 1;
        }
        if (a.marketplaceFeatured && b.marketplaceFeatured) {
          const ar = a.marketplaceFeaturedRank ?? Number.MAX_SAFE_INTEGER;
          const br = b.marketplaceFeaturedRank ?? Number.MAX_SAFE_INTEGER;
          if (ar !== br) return ar - br;
        }
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      })
      .slice(0, limit);

    return { outlets: mapped, count: mapped.length };
  }

  async outletProfile(orgSlug: string, outletSlug: string) {
    const org = await this.prisma.organization.findFirst({
      where: { slug: orgSlug, status: { in: ["active", "trial"] } },
      include: { settings: true },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const outlet = await this.prisma.outlet.findFirst({
      where: { organizationId: org.id, slug: outletSlug, status: "active" },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            settings: true,
          },
        },
        settings: true,
        photos: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, url: true, caption: true, sortOrder: true },
        },
      },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const orgSettings = (org.settings?.settings ?? {}) as Record<string, unknown>;
    const enabledOrderTypes = Array.isArray(orgSettings.enabledOrderTypes)
      ? (orgSettings.enabledOrderTypes as string[])
      : ["dine_in", "takeaway", "delivery"];
    const outletSettings = (outlet.settings?.settings ?? {}) as Record<
      string,
      unknown
    >;
    const brandSettings = (outlet.brand?.settings?.settings ?? {}) as Record<
      string,
      unknown
    >;

    const platformDefaultRaw =
      this.platformConfig.get("PLATFORM_DEFAULT_GUEST_THEME_KEY") ||
      DEFAULT_GUEST_THEME_KEY;
    const platformDefaultGuestThemeKey = isGuestThemePresetKey(platformDefaultRaw)
      ? platformDefaultRaw
      : DEFAULT_GUEST_THEME_KEY;

    const guestThemeKeyRaw =
      (typeof outletSettings.guestThemeKey === "string"
        ? outletSettings.guestThemeKey
        : null) ??
      (typeof brandSettings.guestThemeKey === "string"
        ? brandSettings.guestThemeKey
        : null) ??
      platformDefaultGuestThemeKey;
      const guestThemeKey = isGuestThemePresetKey(guestThemeKeyRaw)
      ? guestThemeKeyRaw
      : platformDefaultGuestThemeKey;
    const preset = resolveGuestThemePreset(guestThemeKey);

    const primaryColor =
      (typeof outletSettings.primaryColor === "string" &&
      outletSettings.primaryColor.trim()
        ? outletSettings.primaryColor.trim()
        : null) ??
      (typeof brandSettings.primaryColor === "string" &&
      brandSettings.primaryColor.trim()
        ? brandSettings.primaryColor.trim()
        : null) ??
      preset.primary;
    const accentColor =
      (typeof outletSettings.accentColor === "string" &&
      outletSettings.accentColor.trim()
        ? outletSettings.accentColor.trim()
        : null) ??
      (typeof brandSettings.accentColor === "string" &&
      brandSettings.accentColor.trim()
        ? brandSettings.accentColor.trim()
        : null) ??
      preset.bright;

    const openingHours = outletSettings.openingHours ?? null;
    const tz =
      typeof org.timezone === "string" && org.timezone
        ? org.timezone
        : "Asia/Kolkata";
    const openNow = computeOpenNow(openingHours, new Date(), tz);

    const coupons = await this.prisma.coupon.findMany({
      where: {
        organizationId: org.id,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ marketplaceFeatured: "desc" }, { code: "asc" }],
      take: 20,
    });

    return {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        businessType: org.businessType,
      },
      outlet: {
        id: outlet.id,
        name: outlet.name,
        slug: outlet.slug,
        address: outlet.address,
        city: outlet.city,
        state: outlet.state,
        pincode: outlet.pincode,
        phone: outlet.phone,
        latitude: outlet.latitude != null ? Number(outlet.latitude) : null,
        longitude: outlet.longitude != null ? Number(outlet.longitude) : null,
        cuisineTags: outlet.cuisineTags,
        coverImageUrl: normalizePublicAssetUrl(outlet.coverImageUrl),

        photoUrls: (outlet.photos ?? []).map((p) => p.url),
        photos: (outlet.photos ?? []).map((p) => ({
          id: p.id,
          url: p.url,
          caption: p.caption,
          sortOrder: p.sortOrder,
        })),
        averagePrepMinutes: outlet.averagePrepMinutes,
        marketplaceListed: outlet.marketplaceListed,
        openingHours,
        openNow,
        guestThemeKey,
        primaryColor,
        accentColor,
        settings: {
          guestThemeKey,
          primaryColor,
          accentColor,
          openingHours,
        },
      },
      brand: outlet.brand
        ? {
            id: outlet.brand.id,
            name: outlet.brand.name,
            logoUrl: outlet.brand.logoUrl,
            description: null,
            settings: {
              guestThemeKey:
                typeof brandSettings.guestThemeKey === "string"
                  ? brandSettings.guestThemeKey
                  : null,
              primaryColor:
                typeof brandSettings.primaryColor === "string"
                  ? brandSettings.primaryColor
                  : null,
              accentColor:
                typeof brandSettings.accentColor === "string"
                  ? brandSettings.accentColor
                  : null,
            },
          }
        : null,
      theme: {
        guestThemeKey,
        primaryColor,
        accentColor,
        platformDefaultGuestThemeKey,
      },
      orderModes: {
        dineIn:
          enabledOrderTypes.includes("dine_in") ||
          enabledOrderTypes.includes("qr"),
        takeaway:
          enabledOrderTypes.includes("takeaway") ||
          enabledOrderTypes.includes("online"),
        delivery: enabledOrderTypes.includes("delivery"),
      },
      offers: coupons.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
        description: c.description,
        imageUrl: normalizePublicAssetUrl(c.imageUrl),

        type: c.type,
        value: Number(c.value),
        minOrder: c.minOrder != null ? Number(c.minOrder) : null,
        expiresAt: c.expiresAt,
        marketplaceFeatured: c.marketplaceFeatured,
      })),
    };
  }

  async offers(query: { lat?: number; lng?: number; limit?: number }) {
    const nearby = await this.nearby({
      lat: query.lat,
      lng: query.lng,
      radiusKm: 25,
      limit: 80,
    });
    const orgIds = [
      ...new Set(nearby.outlets.map((o) => o.organization.id)),
    ];
    if (orgIds.length === 0) return { offers: [] };

    const coupons = await this.prisma.coupon.findMany({
      where: {
        organizationId: { in: orgIds },
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      take: query.limit ?? 40,
      orderBy: [{ marketplaceFeatured: "desc" }, { code: "asc" }],
    });

    const orgById = new Map(
      nearby.outlets.map((o) => [o.organization.id, o]),
    );

    return {
      offers: coupons.map((c) => {
        const sample = orgById.get(c.organizationId);
        return {
          id: c.id,
          code: c.code,
          title: c.title,
          description: c.description,
          imageUrl: normalizePublicAssetUrl(c.imageUrl),

          type: c.type,
          value: Number(c.value),
          minOrder: c.minOrder != null ? Number(c.minOrder) : null,
          expiresAt: c.expiresAt,
          marketplaceFeatured: c.marketplaceFeatured,
          organizationId: c.organizationId,
          organizationName: sample?.organization.name,
          outletId: sample?.id,
          outletName: sample?.name,
          orgSlug: sample?.organization.slug,
          outletSlug: sample?.slug,
        };
      }),
    };
  }

  async specials(query: { lat?: number; lng?: number; limit?: number }) {
    const nearby = await this.nearby({
      lat: query.lat,
      lng: query.lng,
      radiusKm: 25,
      limit: 80,
    });
    const orgIds = [
      ...new Set(nearby.outlets.map((o) => o.organization.id)),
    ];
    if (orgIds.length === 0) return { specials: [] };

    const items = await this.prisma.menuItem.findMany({
      where: {
        organizationId: { in: orgIds },
        isActive: true,
        onlineAvailable: true,
        isSpecial: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: query.limit ?? 30,
    });

    const outletByOrg = new Map(
      nearby.outlets.map((o) => [o.organization.id, o]),
    );

    return {
      specials: items.map((item) => {
        const sample = outletByOrg.get(item.organizationId);
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          imageUrl: normalizePublicAssetUrl(item.imageUrl),
          price: toPaise(Number(item.basePrice)),
          isVeg: item.isVeg,
          isSpecial: true,
          organizationId: item.organizationId,
          organizationName: sample?.organization.name ?? null,
          orgSlug: sample?.organization.slug ?? null,
          outletId: sample?.id ?? null,
          outletName: sample?.name ?? null,
          outletSlug: sample?.slug ?? null,
          coverImageUrl: normalizePublicAssetUrl(sample?.coverImageUrl ?? null),

        };
      }),
    };
  }

  async discoverSections() {
    const now = new Date();
    const rows = await this.prisma.guestDiscoverSection.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 20,
    });
    return {
      sections: rows.map((s) => ({
        id: s.id,
        title: s.title,
        subtitle: s.subtitle,
        type: s.type,
        payload: s.payload,
        sortOrder: s.sortOrder,
      })),
    };
  }

  async banners(query: {
    orgIds?: string[];
    lat?: number;
    lng?: number;
  }) {
    let orgIds = query.orgIds ?? [];
    if (orgIds.length === 0 && query.lat != null && query.lng != null) {
      const nearby = await this.nearby({
        lat: query.lat,
        lng: query.lng,
        radiusKm: 25,
        limit: 40,
      });
      orgIds = [...new Set(nearby.outlets.map((o) => o.organization.id))];
    }
    const now = new Date();
    const rows = await this.prisma.guestBanner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
        OR: [
          { scope: "platform" },
          ...(orgIds.length
            ? [{ scope: "organization", organizationId: { in: orgIds } }]
            : []),
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 30,
    });
    return {
      banners: rows.map((b) => ({
        id: b.id,
        scope: b.scope,
        organizationId: b.organizationId,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: normalizePublicAssetUrl(b.imageUrl),

        linkType: b.linkType,
        linkPayload: b.linkPayload,
        sortOrder: b.sortOrder,
      })),
    };
  }
}
