import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { MarketingUploadService } from "../marketing/marketing-upload.service";
import { GuestPushService } from "./guest-push.service";

export type BannerInput = {
  title?: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  linkType?: string;
  linkPayload?: Record<string, unknown>;
  sortOrder?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
};

@Injectable()
export class GuestMarketingService {
  constructor(
    private prisma: PrismaService,
    private push: GuestPushService,
    private upload: MarketingUploadService,
  ) {}

  private activeWindowFilter() {
    const now = new Date();
    return {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    };
  }

  async publicBanners(orgIds: string[] = []) {
    const rows = await this.prisma.guestBanner.findMany({
      where: {
        ...this.activeWindowFilter(),
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
        imageUrl: b.imageUrl,
        linkType: b.linkType,
        linkPayload: b.linkPayload,
        sortOrder: b.sortOrder,
      })),
    };
  }

  listOrgBanners(orgId: string) {
    return this.prisma.guestBanner.findMany({
      where: { scope: "organization", organizationId: orgId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
  }

  listPlatformBanners() {
    return this.prisma.guestBanner.findMany({
      where: { scope: "platform" },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
  }

  createBanner(
    scope: "platform" | "organization",
    orgId: string | null,
    body: BannerInput,
  ) {
    if (!body.title?.trim()) throw new BadRequestException("title is required");
    if (scope === "organization" && !orgId) {
      throw new BadRequestException("organizationId required");
    }
    return this.prisma.guestBanner.create({
      data: {
        scope,
        organizationId: scope === "organization" ? orgId! : null,
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

  async updateBanner(
    id: string,
    body: BannerInput,
    opts: { orgId?: string; platformOnly?: boolean },
  ) {
    const row = await this.prisma.guestBanner.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Banner not found");
    if (opts.platformOnly && row.scope !== "platform") {
      throw new ForbiddenException("Not a platform banner");
    }
    if (opts.orgId && row.organizationId !== opts.orgId) {
      throw new ForbiddenException("Banner belongs to another organization");
    }
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

  async deleteBanner(
    id: string,
    opts: { orgId?: string; platformOnly?: boolean },
  ) {
    const row = await this.prisma.guestBanner.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Banner not found");
    if (opts.platformOnly && row.scope !== "platform") {
      throw new ForbiddenException("Not a platform banner");
    }
    if (opts.orgId && row.organizationId !== opts.orgId) {
      throw new ForbiddenException("Banner belongs to another organization");
    }
    await this.upload.deleteManagedUrl(row.imageUrl);
    await this.prisma.guestBanner.delete({ where: { id } });
    return { success: true };
  }

  listOrgCampaigns(orgId: string) {
    return this.prisma.guestPushCampaign.findMany({
      where: { scope: "organization", organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  listPlatformCampaigns() {
    return this.prisma.guestPushCampaign.findMany({
      where: { scope: "platform" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async sendOrgCampaign(
    orgId: string,
    body: { title?: string; body?: string; data?: Record<string, string> },
    createdByUserId?: string,
  ) {
    const title = body.title?.trim();
    const text = body.body?.trim();
    if (!title || !text) {
      throw new BadRequestException("title and body are required");
    }

    const memberships = await this.prisma.guestOrgMembership.findMany({
      where: { organizationId: orgId },
      select: { guestUserId: true },
      take: 5000,
    });
    const guestIds = [...new Set(memberships.map((m) => m.guestUserId))];

    let sent = 0;
    for (const guestUserId of guestIds) {
      const result = await this.push.notifyGuestUser(guestUserId, {
        title,
        body: text,
        data: {
          type: "marketing_org",
          organizationId: orgId,
          ...(body.data ?? {}),
        },
      });
      sent += result.sent;
    }

    return this.prisma.guestPushCampaign.create({
      data: {
        scope: "organization",
        organizationId: orgId,
        title,
        body: text,
        data: { type: "marketing_org", ...(body.data ?? {}) },
        audience: "org_members",
        status: "sent",
        sentCount: sent,
        sentAt: new Date(),
        createdByUserId: createdByUserId ?? null,
      },
    });
  }

  async sendPlatformCampaign(
    body: { title?: string; body?: string; data?: Record<string, string> },
    createdByUserId?: string,
  ) {
    const title = body.title?.trim();
    const text = body.body?.trim();
    if (!title || !text) {
      throw new BadRequestException("title and body are required");
    }

    const guests = await this.prisma.guestUser.findMany({
      where: { anonymizedAt: null },
      select: { id: true },
      take: 10000,
    });

    let sent = 0;
    for (const g of guests) {
      const result = await this.push.notifyGuestUser(g.id, {
        title,
        body: text,
        data: { type: "marketing_platform", ...(body.data ?? {}) },
      });
      sent += result.sent;
    }

    return this.prisma.guestPushCampaign.create({
      data: {
        scope: "platform",
        title,
        body: text,
        data: { type: "marketing_platform", ...(body.data ?? {}) },
        audience: "all",
        status: "sent",
        sentCount: sent,
        sentAt: new Date(),
        createdByUserId: createdByUserId ?? null,
      },
    });
  }

  async listAllCoupons(limit = 200) {
    const rows = await this.prisma.coupon.findMany({
      take: Math.min(limit, 500),
      orderBy: { usedCount: "desc" },
    });
    const orgIds = [...new Set(rows.map((r) => r.organizationId))];
    const orgs = await this.prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true, slug: true },
    });
    const byId = new Map(orgs.map((o) => [o.id, o]));
    return rows.map((c) => ({
      ...c,
      value: Number(c.value),
      minOrder: c.minOrder != null ? Number(c.minOrder) : null,
      organization: byId.get(c.organizationId) ?? null,
    }));
  }

  private serializeCoupon(
    c: {
      id: string;
      organizationId: string;
      code: string;
      title: string | null;
      description: string | null;
      imageUrl: string | null;
      type: string;
      value: Prisma.Decimal | number;
      minOrder: Prisma.Decimal | number | null;
      maxUses: number | null;
      usedCount: number;
      startsAt: Date | null;
      expiresAt: Date | null;
      isActive: boolean;
      marketplaceFeatured?: boolean;
    },
    organization?: { id: string; name: string; slug: string } | null,
  ) {
    return {
      ...c,
      value: Number(c.value),
      minOrder: c.minOrder != null ? Number(c.minOrder) : null,
      marketplaceFeatured: Boolean(
        (c as { marketplaceFeatured?: boolean }).marketplaceFeatured,
      ),
      organization: organization ?? null,
    };
  }

  private async orgOrThrow(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  async createCouponPlatform(
    organizationId: string,
    data: {
      code?: string;
      type?: string;
      value?: number;
      title?: string;
      description?: string;
      imageUrl?: string;
      minOrder?: number;
      maxUses?: number;
      startsAt?: string;
      expiresAt?: string;
      isActive?: boolean;
      marketplaceFeatured?: boolean;
    },
  ) {
    if (!organizationId?.trim()) {
      throw new BadRequestException("organizationId is required");
    }
    if (!data.code?.trim()) throw new BadRequestException("code is required");
    if (!data.type?.trim()) throw new BadRequestException("type is required");
    if (data.value == null || Number.isNaN(Number(data.value))) {
      throw new BadRequestException("value is required");
    }
    const org = await this.orgOrThrow(organizationId);
    const row = await this.prisma.coupon.create({
      data: {
        organizationId: org.id,
        code: data.code.trim().toUpperCase(),
        type: data.type,
        value: Number(data.value),
        title: data.title?.trim() || null,
        description: data.description?.trim() || null,
        imageUrl: data.imageUrl?.trim() || null,
        minOrder: data.minOrder,
        maxUses: data.maxUses,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        isActive: data.isActive ?? true,
        marketplaceFeatured: data.marketplaceFeatured ?? false,
      },
    });
    return this.serializeCoupon(row, org);
  }

  async updateCouponPlatform(
    id: string,
    data: {
      code?: string;
      type?: string;
      value?: number;
      title?: string | null;
      description?: string | null;
      imageUrl?: string | null;
      minOrder?: number | null;
      maxUses?: number | null;
      startsAt?: string | null;
      expiresAt?: string | null;
      isActive?: boolean;
      organizationId?: string;
      marketplaceFeatured?: boolean;
    },
  ) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Coupon not found");
    if (data.organizationId && data.organizationId !== existing.organizationId) {
      throw new BadRequestException("Cannot move a coupon to another organization");
    }
    const org = await this.orgOrThrow(existing.organizationId);
    if (
      data.imageUrl !== undefined &&
      (data.imageUrl?.trim() || null) !== existing.imageUrl
    ) {
      await this.upload.deleteManagedUrl(existing.imageUrl);
    }
    const row = await this.prisma.coupon.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.value !== undefined ? { value: data.value } : {}),
        ...(data.title !== undefined ? { title: data.title?.trim() || null } : {}),
        ...(data.description !== undefined
          ? { description: data.description?.trim() || null }
          : {}),
        ...(data.imageUrl !== undefined
          ? { imageUrl: data.imageUrl?.trim() || null }
          : {}),
        ...(data.minOrder !== undefined ? { minOrder: data.minOrder } : {}),
        ...(data.maxUses !== undefined ? { maxUses: data.maxUses } : {}),
        ...(data.startsAt !== undefined
          ? { startsAt: data.startsAt ? new Date(data.startsAt) : null }
          : {}),
        ...(data.expiresAt !== undefined
          ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.marketplaceFeatured !== undefined
          ? { marketplaceFeatured: data.marketplaceFeatured }
          : {}),
      },
    });
    return this.serializeCoupon(row, org);
  }

  async deactivateCouponPlatform(id: string) {
    const row = await this.prisma.coupon.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Coupon not found");
    const org = await this.orgOrThrow(row.organizationId);
    const updated = await this.prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });
    return this.serializeCoupon(updated, org);
  }

  async deleteCouponPlatform(id: string) {
    const row = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { usages: true } } },
    });
    if (!row) throw new NotFoundException("Coupon not found");
    if (row._count.usages > 0) {
      throw new BadRequestException(
        "Coupon has been used and cannot be deleted. Deactivate it instead.",
      );
    }
    await this.upload.deleteManagedUrl(row.imageUrl);
    await this.prisma.coupon.delete({ where: { id } });
    return { success: true, id };
  }
}
