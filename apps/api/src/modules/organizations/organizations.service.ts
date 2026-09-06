import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

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
        settings: { select: { settings: true } },
      },
    });
    if (!org) return org;
    const json = this.settingsJson(org.settings?.settings);
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
      setupCompleted: json.setupCompleted === true,
      loyaltySettings: json.loyaltySettings ?? null,
    };
  }

  getSettings(orgId: string) {
    return this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
  }

  async updateSettings(orgId: string, body: Record<string, unknown>) {
    const incoming = (body.settings as Record<string, unknown>) ?? body;
    const existing = await this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
    const settings = { ...this.settingsJson(existing?.settings), ...incoming };
    return this.prisma.organizationSettings.upsert({
      where: { organizationId: orgId },
      update: { settings: settings as never },
      create: { organizationId: orgId, settings: settings as never },
    });
  }

  update(orgId: string, data: Record<string, unknown>) {
    const allowed: Record<string, unknown> = {};
    if (typeof data.name === "string") allowed.name = data.name;
    if (typeof data.businessType === "string") allowed.businessType = data.businessType;
    if (data.restaurantSize === null) allowed.restaurantSize = null;
    else if (typeof data.restaurantSize === "string") allowed.restaurantSize = data.restaurantSize;
    if (data.gstin !== undefined) allowed.gstin = data.gstin;
    if (data.phone !== undefined) allowed.phone = data.phone;
    if (data.email !== undefined) allowed.email = data.email;
    if (data.address !== undefined) allowed.address = data.address;
    if (data.city !== undefined) allowed.city = data.city;
    if (typeof data.timezone === "string") allowed.timezone = data.timezone;
    if (typeof data.currency === "string") allowed.currency = data.currency;
    return this.prisma.organization.update({
      where: { id: orgId },
      data: allowed as never,
    });
  }

  private settingsJson(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
