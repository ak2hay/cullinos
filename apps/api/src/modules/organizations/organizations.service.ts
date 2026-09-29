import { Injectable } from "@nestjs/common";
import { BUSINESS_TYPES } from "@cullinos/shared";
import { ensureBarStationsIfServingAlcohol } from "../../common/kitchen-stations.util";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private platformConfig: PlatformConfigService,
  ) {}

  list(orgId: string) {
    return this.prisma.organization.findMany({ where: { id: orgId } });
  }

  async get(orgId: string) {
    // Lean DTO only — nested Plan.Decimal fields break/hang JSON serialization in Nest.
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        businessType: true,
        restaurantSize: true,
        gstin: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        timezone: true,
        currency: true,
        logoUrl: true,
        settings: { select: { settings: true } },
      },
    });
    if (!org) return org;
    const json = this.settingsJson(org.settings?.settings);

    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId },
      include: {
        plan: { select: { slug: true, name: true } },
        entitlements: { where: { enabled: true }, select: { module: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const now = Date.now();
    const trialExpired =
      subscription?.status === "trial" &&
      subscription.trialEndsAt != null &&
      subscription.trialEndsAt.getTime() <= now;
    const subscriptionActive =
      subscription?.status === "active" ||
      (subscription?.status === "trial" && !trialExpired);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      businessType: org.businessType,
      restaurantSize: org.restaurantSize,
      gstin: org.gstin,
      phone: org.phone,
      email: org.email,
      address: org.address,
      city: org.city,
      timezone: org.timezone,
      currency: org.currency,
      logoUrl: org.logoUrl,
      setupCompleted: json.setupCompleted === true,
      loyaltySettings: json.loyaltySettings ?? null,
      language: typeof json.language === "string" ? json.language : null,
      subscriptionStatus: subscription?.status ?? null,
      trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
      trialExpired,
      subscriptionActive: Boolean(subscriptionActive),
      planSlug: subscription?.plan?.slug ?? null,
      planName: subscription?.plan?.name ?? null,
      enabledModules: subscriptionActive
        ? (subscription?.entitlements.map((e) => e.module) ?? [])
        : null,
    };
  }

  async getSettings(orgId: string) {
    const row = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
    const phoneMenuQrEnabled =
      String(this.platformConfig.get("GUEST_APP_PHONE_MENU_QR_ENABLED") || "")
        .toLowerCase() === "true";
    return {
      ...(row ?? { organizationId: orgId, settings: {} }),
      platformCapabilities: { phoneMenuQrEnabled },
    };
  }

  async updateSettings(orgId: string, body: Record<string, unknown>) {
    const incoming = (body.settings as Record<string, unknown>) ?? body;
    const existing = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
    const settings = { ...this.settingsJson(existing?.settings), ...incoming };
    if ("servesAlcohol" in incoming) settings.servesAlcohol = incoming.servesAlcohol === true;
    const saved = await this.prisma.organizationSettings.upsert({
      where: { organizationId: orgId },
      update: { settings: settings as never },
      create: { organizationId: orgId, settings: settings as never },
    });
    if (settings.servesAlcohol === true) {
      await ensureBarStationsIfServingAlcohol(this.prisma, orgId);
    }
    return saved;
  }

  async update(orgId: string, data: Record<string, unknown>) {
    const allowed: Record<string, unknown> = {};
    if (typeof data.name === "string") allowed.name = data.name;
    if (
      typeof data.businessType === "string" &&
      (BUSINESS_TYPES as readonly string[]).includes(data.businessType)
    ) {
      allowed.businessType = data.businessType;
    }
    if (data.restaurantSize === null) allowed.restaurantSize = null;
    else if (typeof data.restaurantSize === "string") allowed.restaurantSize = data.restaurantSize;
    if (data.gstin !== undefined) allowed.gstin = data.gstin;
    if (data.phone !== undefined) allowed.phone = data.phone;
    if (data.email !== undefined) allowed.email = data.email;
    if (data.address !== undefined) allowed.address = data.address;
    if (data.city !== undefined) allowed.city = data.city;
    if (typeof data.timezone === "string") allowed.timezone = data.timezone;
    if (typeof data.currency === "string") allowed.currency = data.currency;
    if (data.logoUrl !== undefined) allowed.logoUrl = data.logoUrl;
    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: allowed as never,
    });
    await ensureBarStationsIfServingAlcohol(this.prisma, orgId);
    return updated;
  }

  private settingsJson(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
