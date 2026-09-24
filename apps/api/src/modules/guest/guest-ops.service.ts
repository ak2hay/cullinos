import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  DEFAULT_GUEST_THEME_KEY,
  GUEST_THEME_PRESET_LIST,
  isGuestThemePresetKey,
} from "@cullinos/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { MarketingUploadService, uploadMaxBytesFor } from "../marketing/marketing-upload.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import { GuestPushService } from "./guest-push.service";
import type { BannerInput } from "./guest-marketing.service";

const PUSH_AUDIENCES = [
  "all",
  "org_members",
  "city",
  "org",
  "marketing_opt_in",
] as const;
type PushAudience = (typeof PUSH_AUDIENCES)[number];

function parseBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
}

function parseIntParam(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return `****${digits}`;
  return `****${digits.slice(-4)}`;
}

function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 1) return "***@***";
  return `${email[0]}***${email.slice(at)}`;
}

@Injectable()
export class GuestOpsService {
  constructor(
    private prisma: PrismaService,
    private push: GuestPushService,
    private platformConfig: PlatformConfigService,
    private upload: MarketingUploadService,
  ) {}

  async overview() {
    const [
      listedOutlets,
      pendingModeration,
      visibleReviews,
      hiddenReviews,
      draftCampaigns,
      scheduledCampaigns,
      guestUsers,
    ] = await Promise.all([
      this.prisma.outlet.count({ where: { marketplaceListed: true } }),
      this.prisma.outlet.count({
        where: { marketplaceModerationStatus: "pending" },
      }),
      this.prisma.guestOutletReview.count({ where: { status: "visible" } }),
      this.prisma.guestOutletReview.count({
        where: { status: { in: ["hidden", "removed"] } },
      }),
      this.prisma.guestPushCampaign.count({ where: { status: "draft" } }),
      this.prisma.guestPushCampaign.count({ where: { status: "scheduled" } }),
      this.prisma.guestUser.count({ where: { anonymizedAt: null } }),
    ]);

    const maintenanceRaw =
      this.platformConfig.get("GUEST_APP_MAINTENANCE") || null;
    const maintenanceOn = Boolean(
      maintenanceRaw && maintenanceRaw.trim().length > 0,
    );

    return {
      listedOutlets,
      pendingModeration,
      reviews: { visible: visibleReviews, hidden: hiddenReviews },
      campaigns: { draft: draftCampaigns, scheduled: scheduledCampaigns },
      maintenanceOn,
      maintenanceMessage: maintenanceRaw,
      guestUsers,
    };
  }

  async listOutlets(query: {
    q?: string;
    listed?: string | boolean;
    featured?: string | boolean;
    moderationStatus?: string;
    city?: string;
    limit?: string | number;
    offset?: string | number;
  }) {
    const limit = Math.min(parseIntParam(query.limit, 50), 200);
    const offset = Math.max(parseIntParam(query.offset, 0), 0);
    const listed = parseBool(query.listed);
    const featured = parseBool(query.featured);

    const where: Prisma.OutletWhereInput = {
      ...(listed !== undefined ? { marketplaceListed: listed } : {}),
      ...(featured !== undefined ? { marketplaceFeatured: featured } : {}),
      ...(query.moderationStatus
        ? { marketplaceModerationStatus: query.moderationStatus }
        : {}),
      ...(query.city
        ? { city: { contains: query.city, mode: "insensitive" } }
        : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { slug: { contains: query.q, mode: "insensitive" } },
              { city: { contains: query.q, mode: "insensitive" } },
              { address: { contains: query.q, mode: "insensitive" } },
              {
                organization: {
                  name: { contains: query.q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.outlet.findMany({
        where,
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true } },
        },
        orderBy: [
          { marketplaceFeatured: "desc" },
          { marketplaceFeaturedRank: "asc" },
          { name: "asc" },
        ],
        take: limit,
        skip: offset,
      }),
      this.prisma.outlet.count({ where }),
    ]);

    return {
      total,
      limit,
      offset,
      items: items.map((o) => ({
        ...o,
        latitude: o.latitude != null ? Number(o.latitude) : null,
        longitude: o.longitude != null ? Number(o.longitude) : null,
      })),
    };
  }

  async updateOutlet(
    id: string,
    body: {
      marketplaceListed?: boolean;
      marketplaceFeatured?: boolean;
      marketplaceFeaturedRank?: number | null;
      marketplaceModerationStatus?: string;
      marketplaceUnlistedByPlatform?: boolean;
      latitude?: number | null;
      longitude?: number | null;
      cuisineTags?: string[];
      coverImageUrl?: string | null;
      averagePrepMinutes?: number | null;
      address?: string | null;
      city?: string | null;
      zone?: string | null;
      state?: string | null;
      pincode?: string | null;
    },
  ) {
    const existing = await this.prisma.outlet.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Outlet not found");

    const data: Prisma.OutletUpdateInput = {};

    if (body.marketplaceFeatured !== undefined) {
      data.marketplaceFeatured = body.marketplaceFeatured;
    }
    if (body.marketplaceFeaturedRank !== undefined) {
      data.marketplaceFeaturedRank = body.marketplaceFeaturedRank;
    }
    if (body.marketplaceModerationStatus !== undefined) {
      data.marketplaceModerationStatus = body.marketplaceModerationStatus;
    }
    if (body.cuisineTags !== undefined) {
      data.cuisineTags = body.cuisineTags;
    }
    if (body.coverImageUrl !== undefined) {
      data.coverImageUrl = body.coverImageUrl?.trim() || null;
    }
    if (body.averagePrepMinutes !== undefined) {
      data.averagePrepMinutes = body.averagePrepMinutes;
    }
    if (body.address !== undefined) data.address = body.address;
    if (body.city !== undefined) data.city = body.city;
    if (body.zone !== undefined) data.zone = body.zone;
    if (body.state !== undefined) data.state = body.state;
    if (body.pincode !== undefined) data.pincode = body.pincode;
    if (body.latitude !== undefined) {
      data.latitude =
        body.latitude == null ? null : new Prisma.Decimal(body.latitude);
    }
    if (body.longitude !== undefined) {
      data.longitude =
        body.longitude == null ? null : new Prisma.Decimal(body.longitude);
    }

    if (body.marketplaceUnlistedByPlatform === true) {
      data.marketplaceUnlistedByPlatform = true;
      data.marketplaceListed = false;
    } else if (body.marketplaceUnlistedByPlatform === false) {
      data.marketplaceUnlistedByPlatform = false;
      // Clearing platform unlist allows re-list; apply explicit listed if provided
      if (body.marketplaceListed !== undefined) {
        data.marketplaceListed = body.marketplaceListed;
      }
    } else if (body.marketplaceListed !== undefined) {
      // Block re-list while platform-unlisted unless clearing above
      if (
        body.marketplaceListed === true &&
        existing.marketplaceUnlistedByPlatform
      ) {
        throw new BadRequestException(
          "Outlet is unlisted by platform; clear marketplaceUnlistedByPlatform first",
        );
      }
      data.marketplaceListed = body.marketplaceListed;
    }

    const updated = await this.prisma.outlet.update({
      where: { id },
      data,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });

    return {
      ...updated,
      latitude: updated.latitude != null ? Number(updated.latitude) : null,
      longitude: updated.longitude != null ? Number(updated.longitude) : null,
    };
  }

  listBanners(scope?: "platform" | "organization" | "all") {
    const where: Prisma.GuestBannerWhereInput =
      !scope || scope === "all"
        ? {}
        : scope === "platform"
          ? { scope: "platform" }
          : { scope: "organization" };

    return this.prisma.guestBanner.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
  }

  createBanner(body: BannerInput & {
    scope?: "platform" | "organization";
    organizationId?: string | null;
  }) {
    if (!body.title?.trim()) throw new BadRequestException("title is required");
    const scope = body.scope === "organization" ? "organization" : "platform";
    if (scope === "organization" && !body.organizationId) {
      throw new BadRequestException("organizationId required for org banners");
    }
    return this.prisma.guestBanner.create({
      data: {
        scope,
        organizationId: scope === "organization" ? body.organizationId! : null,
        title: body.title.trim(),
        subtitle: body.subtitle?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        linkType: body.linkType || "none",
        linkPayload: (body.linkPayload ?? {}) as Prisma.InputJsonValue,
        sortOrder: body.sortOrder ?? 0,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        isActive: body.isActive ?? true,
      },
    });
  }

  async updateBanner(id: string, body: BannerInput) {
    const row = await this.prisma.guestBanner.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Banner not found");
    if (
      body.imageUrl !== undefined &&
      (body.imageUrl?.trim() || null) !== row.imageUrl
    ) {
      await this.upload.deleteManagedUrl(row.imageUrl);
    }
    return this.prisma.guestBanner.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.subtitle !== undefined
          ? { subtitle: body.subtitle?.trim() || null }
          : {}),
        ...(body.imageUrl !== undefined
          ? { imageUrl: body.imageUrl?.trim() || null }
          : {}),
        ...(body.linkType !== undefined ? { linkType: body.linkType } : {}),
        ...(body.linkPayload !== undefined
          ? { linkPayload: body.linkPayload as Prisma.InputJsonValue }
          : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.startsAt !== undefined
          ? { startsAt: body.startsAt ? new Date(body.startsAt) : null }
          : {}),
        ...(body.endsAt !== undefined
          ? { endsAt: body.endsAt ? new Date(body.endsAt) : null }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
  }

  async deleteBanner(id: string) {
    const row = await this.prisma.guestBanner.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Banner not found");
    await this.upload.deleteManagedUrl(row.imageUrl);
    await this.prisma.guestBanner.delete({ where: { id } });
    return { success: true };
  }

  listPushCampaigns(query?: { status?: string; limit?: string | number }) {
    const limit = Math.min(parseIntParam(query?.limit, 50), 200);
    return this.prisma.guestPushCampaign.findMany({
      where: query?.status ? { status: query.status } : undefined,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  createPushDraft(
    body: {
      title?: string;
      body?: string;
      scope?: string;
      organizationId?: string | null;
      audience?: string;
      audienceFilter?: Record<string, unknown>;
      deepLink?: string | null;
      data?: Record<string, unknown>;
      scheduledAt?: string | null;
      imageUrl?: string | null;
      stylePreset?: string | null;
      creative?: Record<string, unknown>;
    },
    createdByUserId?: string,
  ) {
    const title = body.title?.trim();
    const text = body.body?.trim();
    if (!title || !text) {
      throw new BadRequestException("title and body are required");
    }
    const audience = (body.audience || "all") as PushAudience;
    if (!PUSH_AUDIENCES.includes(audience)) {
      throw new BadRequestException(`Invalid audience: ${audience}`);
    }
    const scope =
      body.scope === "organization" || body.organizationId
        ? "organization"
        : "platform";
    if (scope === "organization" && !body.organizationId) {
      throw new BadRequestException("organizationId required for org scope");
    }
    const stylePreset = body.stylePreset?.trim() || null;
    if (
      stylePreset &&
      !["offer", "alert", "promo", "custom"].includes(stylePreset)
    ) {
      throw new BadRequestException(`Invalid stylePreset: ${stylePreset}`);
    }

    return this.prisma.guestPushCampaign.create({
      data: {
        scope,
        organizationId: scope === "organization" ? body.organizationId! : null,
        title,
        body: text,
        data: (body.data ?? {}) as Prisma.InputJsonValue,
        imageUrl: body.imageUrl?.trim() || null,
        stylePreset,
        creative: (body.creative ?? {}) as Prisma.InputJsonValue,
        audience,
        audienceFilter: (body.audienceFilter ?? {}) as Prisma.InputJsonValue,
        deepLink: body.deepLink?.trim() || null,
        status: "draft",
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        createdByUserId: createdByUserId ?? null,
      },
    });
  }

  async updatePushCampaign(
    id: string,
    body: {
      title?: string;
      body?: string;
      audience?: string;
      audienceFilter?: Record<string, unknown>;
      deepLink?: string | null;
      data?: Record<string, unknown>;
      organizationId?: string | null;
      scheduledAt?: string | null;
      imageUrl?: string | null;
      stylePreset?: string | null;
      creative?: Record<string, unknown>;
    },
  ) {
    const row = await this.prisma.guestPushCampaign.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException("Campaign not found");
    if (row.status === "sent" || row.status === "sending") {
      throw new BadRequestException("Cannot edit a sent/sending campaign");
    }
    if (body.audience && !PUSH_AUDIENCES.includes(body.audience as PushAudience)) {
      throw new BadRequestException(`Invalid audience: ${body.audience}`);
    }
    if (
      body.stylePreset !== undefined &&
      body.stylePreset !== null &&
      body.stylePreset.trim() &&
      !["offer", "alert", "promo", "custom"].includes(body.stylePreset.trim())
    ) {
      throw new BadRequestException(`Invalid stylePreset: ${body.stylePreset}`);
    }

    if (
      body.imageUrl !== undefined &&
      (body.imageUrl?.trim() || null) !== row.imageUrl
    ) {
      await this.upload.deleteManagedUrl(row.imageUrl);
    }

    return this.prisma.guestPushCampaign.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.body !== undefined ? { body: body.body.trim() } : {}),
        ...(body.audience !== undefined ? { audience: body.audience } : {}),
        ...(body.audienceFilter !== undefined
          ? {
              audienceFilter: body.audienceFilter as Prisma.InputJsonValue,
            }
          : {}),
        ...(body.deepLink !== undefined
          ? { deepLink: body.deepLink?.trim() || null }
          : {}),
        ...(body.data !== undefined
          ? { data: body.data as Prisma.InputJsonValue }
          : {}),
        ...(body.organizationId !== undefined
          ? { organizationId: body.organizationId }
          : {}),
        ...(body.scheduledAt !== undefined
          ? {
              scheduledAt: body.scheduledAt
                ? new Date(body.scheduledAt)
                : null,
            }
          : {}),
        ...(body.imageUrl !== undefined
          ? { imageUrl: body.imageUrl?.trim() || null }
          : {}),
        ...(body.stylePreset !== undefined
          ? { stylePreset: body.stylePreset?.trim() || null }
          : {}),
        ...(body.creative !== undefined
          ? { creative: body.creative as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async schedulePush(id: string, scheduledAt?: string) {
    const row = await this.prisma.guestPushCampaign.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException("Campaign not found");
    if (row.status === "sent" || row.status === "cancelled") {
      throw new BadRequestException(`Cannot schedule a ${row.status} campaign`);
    }
    const when = scheduledAt
      ? new Date(scheduledAt)
      : row.scheduledAt ?? new Date();
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException("Invalid scheduledAt");
    }
    return this.prisma.guestPushCampaign.update({
      where: { id },
      data: { status: "scheduled", scheduledAt: when },
    });
  }

  async cancelPush(id: string) {
    const row = await this.prisma.guestPushCampaign.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException("Campaign not found");
    if (row.status === "sent") {
      throw new BadRequestException("Cannot cancel a sent campaign");
    }
    return this.prisma.guestPushCampaign.update({
      where: { id },
      data: { status: "cancelled" },
    });
  }

  async deletePushCampaign(id: string) {
    const row = await this.prisma.guestPushCampaign.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException("Campaign not found");
    if (row.status === "sending") {
      throw new BadRequestException("Cannot delete a campaign while it is sending");
    }
    await this.upload.deleteManagedUrl(row.imageUrl);
    await this.prisma.guestPushCampaign.delete({ where: { id } });
    return { success: true };
  }

  async uploadPushImage(file: Express.Multer.File, actor?: { isSuperAdmin?: boolean }) {
    if (!file?.buffer) {
      throw new BadRequestException("No file uploaded.");
    }
    const result = await this.upload.saveUploadedFile(
      file,
      `push-${Date.now()}`,
      "notification",
      uploadMaxBytesFor(actor),
    );
    return { imageUrl: result.url };
  }

  private async resolveAudienceGuestIds(campaign: {
    audience: string;
    organizationId: string | null;
    audienceFilter: unknown;
  }): Promise<string[]> {
    const filter =
      campaign.audienceFilter &&
      typeof campaign.audienceFilter === "object" &&
      !Array.isArray(campaign.audienceFilter)
        ? (campaign.audienceFilter as Record<string, unknown>)
        : {};
    const orgId =
      (typeof filter.organizationId === "string"
        ? filter.organizationId
        : null) || campaign.organizationId;
    const city =
      typeof filter.city === "string" ? filter.city.trim() : undefined;

    switch (campaign.audience as PushAudience) {
      case "all": {
        const guests = await this.prisma.guestUser.findMany({
          where: { anonymizedAt: null },
          select: { id: true },
          take: 10000,
        });
        return guests.map((g) => g.id);
      }
      case "marketing_opt_in": {
        const prefs = await this.prisma.guestNotificationPreference.findMany({
          where: {
            marketingEnabled: true,
            guestUser: { anonymizedAt: null },
          },
          select: { guestUserId: true },
          take: 10000,
        });
        return [...new Set(prefs.map((p) => p.guestUserId))];
      }
      case "org":
      case "org_members": {
        if (!orgId) {
          throw new BadRequestException(
            "organizationId required for org / org_members audience",
          );
        }
        const memberships = await this.prisma.guestOrgMembership.findMany({
          where: {
            organizationId: orgId,
            guestUser: { anonymizedAt: null },
          },
          select: { guestUserId: true },
          take: 10000,
        });
        return [...new Set(memberships.map((m) => m.guestUserId))];
      }
      case "city": {
        if (!city) {
          throw new BadRequestException("audienceFilter.city required");
        }
        const byAddress = await this.prisma.guestAddress.findMany({
          where: {
            city: { equals: city, mode: "insensitive" },
            guestUser: { anonymizedAt: null },
          },
          select: { guestUserId: true },
          take: 10000,
        });
        const outletsInCity = await this.prisma.outlet.findMany({
          where: { city: { equals: city, mode: "insensitive" } },
          select: { organizationId: true },
          take: 500,
        });
        const orgIds = [
          ...new Set(outletsInCity.map((o) => o.organizationId)),
        ];
        const byMembership =
          orgIds.length === 0
            ? []
            : await this.prisma.guestOrgMembership.findMany({
                where: {
                  organizationId: { in: orgIds },
                  guestUser: { anonymizedAt: null },
                },
                select: { guestUserId: true },
                take: 10000,
              });
        return [
          ...new Set([
            ...byAddress.map((a) => a.guestUserId),
            ...byMembership.map((m) => m.guestUserId),
          ]),
        ];
      }
      default:
        throw new BadRequestException(
          `Unsupported audience: ${campaign.audience}`,
        );
    }
  }

  async sendPushCampaign(id: string) {
    const campaign = await this.prisma.guestPushCampaign.findUnique({
      where: { id },
    });
    if (!campaign) throw new NotFoundException("Campaign not found");
    if (campaign.status === "cancelled") {
      throw new BadRequestException("Campaign is cancelled");
    }
    if (campaign.status === "sent") {
      throw new BadRequestException("Campaign already sent");
    }

    await this.prisma.guestPushCampaign.update({
      where: { id },
      data: { status: "sending" },
    });

    try {
      const guestIds = await this.resolveAudienceGuestIds(campaign);
      let sentCount = 0;
      let failedCount = 0;
      const dataPayload: Record<string, string> = {
        type: "marketing_campaign",
        campaignId: campaign.id,
      };
      if (campaign.deepLink) dataPayload.deepLink = campaign.deepLink;
      if (campaign.imageUrl) dataPayload.imageUrl = campaign.imageUrl;
      if (campaign.stylePreset) dataPayload.stylePreset = campaign.stylePreset;
      const creative =
        campaign.creative &&
        typeof campaign.creative === "object" &&
        !Array.isArray(campaign.creative)
          ? (campaign.creative as Record<string, unknown>)
          : {};
      if (Object.keys(creative).length > 0) {
        dataPayload.creative = JSON.stringify(creative);
        for (const [k, v] of Object.entries(creative)) {
          if (v != null && typeof v !== "object") {
            dataPayload[`creative_${k}`] = String(v);
          }
        }
      }
      const existingData =
        campaign.data &&
        typeof campaign.data === "object" &&
        !Array.isArray(campaign.data)
          ? (campaign.data as Record<string, unknown>)
          : {};
      for (const [k, v] of Object.entries(existingData)) {
        if (v != null) dataPayload[k] = String(v);
      }

      for (const guestUserId of guestIds) {
        try {
          const result = await this.push.notifyGuestUser(guestUserId, {
            title: campaign.title,
            body: campaign.body,
            imageUrl: campaign.imageUrl,
            data: dataPayload,
          });
          if (result.sent > 0) sentCount += 1;
          else failedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      return this.prisma.guestPushCampaign.update({
        where: { id },
        data: {
          status: "sent",
          sentCount,
          failedCount,
          sentAt: new Date(),
        },
      });
    } catch (err) {
      await this.prisma.guestPushCampaign.update({
        where: { id },
        data: { status: "draft" },
      });
      throw err;
    }
  }

  listDiscoverSections() {
    return this.prisma.guestDiscoverSection.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
  }

  createDiscoverSection(body: {
    title?: string;
    subtitle?: string | null;
    type?: string;
    payload?: Record<string, unknown>;
    sortOrder?: number;
    startsAt?: string | null;
    endsAt?: string | null;
    isActive?: boolean;
  }) {
    if (!body.title?.trim()) throw new BadRequestException("title is required");
    if (!body.type?.trim()) throw new BadRequestException("type is required");
    return this.prisma.guestDiscoverSection.create({
      data: {
        title: body.title.trim(),
        subtitle: body.subtitle?.trim() || null,
        type: body.type.trim(),
        payload: (body.payload ?? {}) as Prisma.InputJsonValue,
        sortOrder: body.sortOrder ?? 0,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        isActive: body.isActive ?? true,
      },
    });
  }

  async updateDiscoverSection(
    id: string,
    body: {
      title?: string;
      subtitle?: string | null;
      type?: string;
      payload?: Record<string, unknown>;
      sortOrder?: number;
      startsAt?: string | null;
      endsAt?: string | null;
      isActive?: boolean;
    },
  ) {
    const row = await this.prisma.guestDiscoverSection.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException("Discover section not found");
    return this.prisma.guestDiscoverSection.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.subtitle !== undefined
          ? { subtitle: body.subtitle?.trim() || null }
          : {}),
        ...(body.type !== undefined ? { type: body.type.trim() } : {}),
        ...(body.payload !== undefined
          ? { payload: body.payload as Prisma.InputJsonValue }
          : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.startsAt !== undefined
          ? { startsAt: body.startsAt ? new Date(body.startsAt) : null }
          : {}),
        ...(body.endsAt !== undefined
          ? { endsAt: body.endsAt ? new Date(body.endsAt) : null }
          : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
  }

  async deleteDiscoverSection(id: string) {
    const row = await this.prisma.guestDiscoverSection.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException("Discover section not found");
    await this.prisma.guestDiscoverSection.delete({ where: { id } });
    return { success: true };
  }

  async listReviews(query: {
    status?: string;
    outletId?: string;
    q?: string;
    limit?: string | number;
  }) {
    const limit = Math.min(parseIntParam(query.limit, 50), 200);
    const where: Prisma.GuestOutletReviewWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.outletId ? { outletId: query.outletId } : {}),
      ...(query.q
        ? {
            OR: [
              { comment: { contains: query.q, mode: "insensitive" } },
              {
                outlet: {
                  name: { contains: query.q, mode: "insensitive" },
                },
              },
              {
                guestUser: {
                  name: { contains: query.q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };

    const items = await this.prisma.guestOutletReview.findMany({
      where,
      include: {
        outlet: {
          select: {
            id: true,
            name: true,
            city: true,
            organizationId: true,
          },
        },
        guestUser: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return items.map((r) => ({
      ...r,
      guestUser: r.guestUser
        ? {
            id: r.guestUser.id,
            name: r.guestUser.name,
            phone: maskPhone(r.guestUser.phone),
            email: maskEmail(r.guestUser.email),
          }
        : null,
    }));
  }

  async moderateReview(
    id: string,
    body: { status: "hidden" | "removed" | "visible"; note?: string },
    actorUserId?: string,
  ) {
    if (!["hidden", "removed", "visible"].includes(body.status)) {
      throw new BadRequestException("status must be hidden|removed|visible");
    }
    const row = await this.prisma.guestOutletReview.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException("Review not found");

    return this.prisma.guestOutletReview.update({
      where: { id },
      data: {
        status: body.status,
        moderatedAt: new Date(),
        moderatedByUserId: actorUserId ?? null,
        moderationNote: body.note?.trim() || null,
      },
    });
  }

  async searchGuestUsers(query: { q?: string; limit?: string | number }) {
    const limit = Math.min(parseIntParam(query.limit, 30), 100);
    const q = query.q?.trim();
    const digits = q ? q.replace(/\D/g, "") : "";
    const where: Prisma.GuestUserWhereInput = {
      anonymizedAt: null,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              ...(digits.length >= 6 ? [{ phone: { contains: digits } }] : []),
              { email: { contains: q, mode: "insensitive" } },
              { id: q },
            ],
          }
        : {}),
    };

    const users = await this.prisma.guestUser.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: {
          select: { memberships: true, devices: true, reviews: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      phone: maskPhone(u.phone),
      email: maskEmail(u.email),
      createdAt: u.createdAt,
      counts: u._count,
    }));
  }

  async getGuestUser(id: string) {
    const user = await this.prisma.guestUser.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            organization: { select: { id: true, name: true, slug: true } },
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                loyaltyPoints: true,
              },
            },
          },
        },
        devices: { orderBy: { lastSeenAt: "desc" }, take: 20 },
        notificationPreference: true,
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            outlet: { select: { id: true, name: true, city: true } },
          },
        },
        notifications: { orderBy: { createdAt: "desc" }, take: 20 },
        addresses: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!user) throw new NotFoundException("Guest user not found");
    return user;
  }

  async analyticsSummary() {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [
      listedByCity,
      reviewVolume,
      campaignsSent,
      guestUserTotals,
      featuredOutlets,
    ] = await Promise.all([
      this.prisma.outlet.groupBy({
        by: ["city"],
        where: { marketplaceListed: true },
        _count: { _all: true },
        orderBy: { _count: { city: "desc" } },
        take: 50,
      }),
      this.prisma.guestOutletReview.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      this.prisma.guestPushCampaign.aggregate({
        where: { status: "sent", sentAt: { gte: since } },
        _count: { _all: true },
        _sum: { sentCount: true, failedCount: true },
      }),
      Promise.all([
        this.prisma.guestUser.count(),
        this.prisma.guestUser.count({ where: { anonymizedAt: null } }),
        this.prisma.guestUser.count({
          where: { anonymizedAt: null, createdAt: { gte: since } },
        }),
      ]),
      this.prisma.outlet.count({
        where: { marketplaceFeatured: true, marketplaceListed: true },
      }),
    ]);

    const [totalGuests, activeGuests, newGuests30d] = guestUserTotals;

    return {
      listedByCity: listedByCity.map((r) => ({
        city: r.city || "Unknown",
        count: r._count._all,
      })),
      reviewVolume: reviewVolume.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      campaignsLast30d: {
        count: campaignsSent._count._all,
        sentCount: campaignsSent._sum.sentCount ?? 0,
        failedCount: campaignsSent._sum.failedCount ?? 0,
      },
      guestUsers: {
        total: totalGuests,
        active: activeGuests,
        newLast30d: newGuests30d,
      },
      featuredOutlets,
    };
  }

  runtimePreview() {
    const featureFlagsRaw =
      this.platformConfig.get("GUEST_APP_FEATURE_FLAGS") || "";
    let featureFlags: Record<string, unknown> = {};
    if (featureFlagsRaw.trim()) {
      try {
        featureFlags = JSON.parse(featureFlagsRaw) as Record<string, unknown>;
      } catch {
        featureFlags = { _raw: featureFlagsRaw };
      }
    }

    const fcmKey =
      this.platformConfig.get("FCM_SERVER_KEY") || process.env.FCM_SERVER_KEY;

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
      playStoreUrl: this.platformConfig.get("GUEST_APP_PLAY_STORE_URL") || null,
      supportUrl: this.platformConfig.get("GUEST_APP_SUPPORT_URL") || null,
      privacyUrl: this.platformConfig.get("GUEST_APP_PRIVACY_URL") || null,
      termsUrl: this.platformConfig.get("GUEST_APP_TERMS_URL") || null,
      featureFlags,
      phoneMenuQrEnabled:
        String(this.platformConfig.get("GUEST_APP_PHONE_MENU_QR_ENABLED") || "")
          .toLowerCase() === "true",
      fcmConfigured: Boolean(fcmKey && fcmKey.trim()),
      platformDefaultGuestThemeKey: (() => {
        const raw =
          this.platformConfig.get("PLATFORM_DEFAULT_GUEST_THEME_KEY") ||
          DEFAULT_GUEST_THEME_KEY;
        return isGuestThemePresetKey(raw) ? raw : DEFAULT_GUEST_THEME_KEY;
      })(),
      guestThemePresets: GUEST_THEME_PRESET_LIST,
    };
  }

  /** Persist guest_app platform settings via PlatformConfigService.upsertGroup. */
  updateRuntime(
    partial: Record<string, string | null | undefined>,
    updatedBy?: string,
  ) {
    return this.platformConfig.upsertGroup("guest_app", partial, updatedBy);
  }
}
