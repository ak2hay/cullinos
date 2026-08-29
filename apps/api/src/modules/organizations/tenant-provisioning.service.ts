import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { hashPassword } from "@cullinos/auth";
import { PrismaService } from "../../prisma/prisma.service";
import { OrgRolesService } from "./org-roles.service";

export type ProvisionTenantInput = {
  companyName: string;
  planSlug: string;
  adminEmail: string;
  adminPassword: string;
  adminName?: string;
  outletName?: string;
  rkyvesClientId?: string;
  status?: "trial" | "active";
};

@Injectable()
export class TenantProvisioningService {
  constructor(
    private prisma: PrismaService,
    private orgRoles: OrgRolesService,
  ) {}

  async provisionTenant(input: ProvisionTenantInput) {
    const plan = await this.prisma.plan.findUnique({ where: { slug: input.planSlug } });
    if (!plan) throw new NotFoundException("Plan not found");

    const baseSlug = input.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const slug = `${baseSlug}-${Date.now().toString(36)}`;
    const passwordHash = await hashPassword(input.adminPassword);
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const orgStatus = input.status ?? "trial";

    const org = await this.prisma.organization.create({
      data: {
        name: input.companyName,
        slug,
        rkyvesClientId: input.rkyvesClientId,
        status: orgStatus,
        email: input.adminEmail,
        settings: { create: { settings: {} } },
      },
    });

    await this.orgRoles.ensureSystemRoles(org.id);

    const brand = await this.prisma.brand.create({
      data: {
        organizationId: org.id,
        name: input.companyName,
        slug: "main",
        isDefault: true,
        settings: { create: { settings: {} } },
      },
    });

    const outlet = await this.prisma.outlet.create({
      data: {
        organizationId: org.id,
        brandId: brand.id,
        name: input.outletName ?? "Main Outlet",
        slug: "main-outlet",
        isDefault: true,
        settings: { create: { settings: {} } },
      },
    });

    const owner = await this.prisma.user.create({
      data: {
        organizationId: org.id,
        email: input.adminEmail,
        passwordHash,
        name: input.adminName ?? "Owner",
        isSuperAdmin: false,
      },
    });

    await this.orgRoles.assignRole(owner.id, org.id, "owner");
    await this.orgRoles.assignOutlets(owner.id, [outlet.id]);

    const planFeatures = await this.prisma.planFeature.findMany({
      where: { planId: plan.id },
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: orgStatus === "active" ? "active" : "trial",
        trialEndsAt: orgStatus === "trial" ? trialEnd : null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnd,
        entitlements: {
          create: planFeatures.map((f) => ({
            module: f.module,
            enabled: f.enabled,
            limits: f.limits ?? undefined,
          })),
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: org.id,
        action: "tenant.provisioned",
        entityType: "organization",
        entityId: org.id,
        metadata: {
          adminEmail: input.adminEmail,
          planSlug: input.planSlug,
          rkyvesClientId: input.rkyvesClientId,
        },
      },
    });

    return {
      organizationId: org.id,
      organizationSlug: org.slug,
      outletId: outlet.id,
      ownerUserId: owner.id,
      ownerEmail: owner.email,
      subscriptionId: subscription.id,
      adminUrl: "https://admin.cullinos.com",
    };
  }
}
