import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.organization.findMany({ where: { id: orgId } });
  }

  get(orgId: string) {
    return this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { brands: true, outlets: true, subscriptions: { include: { plan: true } } },
    });
  }

  getSettings(orgId: string) {
    return this.prisma.organizationSettings.findUnique({
      where: { organizationId: orgId },
    });
  }

  async updateSettings(orgId: string, body: Record<string, unknown>) {
    const settings = (body.settings as Record<string, unknown>) ?? body;
    return this.prisma.organizationSettings.upsert({
      where: { organizationId: orgId },
      update: { settings: settings as never },
      create: { organizationId: orgId, settings: settings as never },
    });
  }

  update(orgId: string, data: Record<string, unknown>) {
    const allowed: Record<string, unknown> = {};
    if (data.name) allowed.name = data.name;
    if (data.businessType) allowed.businessType = data.businessType;
    if (data.gstin !== undefined) allowed.gstin = data.gstin;
    if (data.phone !== undefined) allowed.phone = data.phone;
    if (data.email !== undefined) allowed.email = data.email;
    if (data.address !== undefined) allowed.address = data.address;
    return this.prisma.organization.update({
      where: { id: orgId },
      data: allowed as never,
    });
  }
}
