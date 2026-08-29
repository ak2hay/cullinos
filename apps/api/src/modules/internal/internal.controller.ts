import { Body, Controller, Get, Headers, Post, Patch, Param, UnauthorizedException } from "@nestjs/common";
import { hashPassword } from "@cullinos/auth";
import { Public } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";

class ProvisionDto {
  rkyvesClientId!: string;
  companyName!: string;
  planSlug!: string;
  adminEmail!: string;
  adminPassword!: string;
  outletName!: string;
  adminName?: string;
}

@Controller("internal")
export class InternalController {
  constructor(private prisma: PrismaService) {}

  private verifyKey(key: string | undefined) {
    const expected = process.env.INTERNAL_API_KEY || "change-me-internal-provision-key";
    if (key !== expected) throw new UnauthorizedException("Invalid internal API key");
  }

  @Public()
  @Post("provision")
  async provision(@Headers("x-internal-key") key: string, @Body() dto: ProvisionDto) {
    this.verifyKey(key);

    const plan = await this.prisma.plan.findUnique({ where: { slug: dto.planSlug } });
    if (!plan) throw new UnauthorizedException("Plan not found");

    const slug = dto.companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const passwordHash = await hashPassword(dto.adminPassword);

    const org = await this.prisma.organization.create({
      data: {
        name: dto.companyName,
        slug: `${slug}-${Date.now().toString(36)}`,
        rkyvesClientId: dto.rkyvesClientId,
        status: "trial",
        email: dto.adminEmail,
        settings: { create: { settings: {} } },
      },
    });

    const brand = await this.prisma.brand.create({
      data: {
        organizationId: org.id,
        name: dto.companyName,
        slug: "main",
        isDefault: true,
        settings: { create: { settings: {} } },
      },
    });

    const outlet = await this.prisma.outlet.create({
      data: {
        organizationId: org.id,
        brandId: brand.id,
        name: dto.outletName,
        slug: "main-outlet",
        isDefault: true,
        settings: { create: { settings: {} } },
      },
    });

    const admin = await this.prisma.user.create({
      data: {
        organizationId: org.id,
        email: dto.adminEmail,
        passwordHash,
        name: dto.adminName || "Admin",
        isSuperAdmin: false,
      },
    });

    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const subscription = await this.prisma.subscription.create({
      data: {
        organizationId: org.id,
        planId: plan.id,
        status: "trial",
        trialEndsAt: trialEnd,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnd,
        entitlements: {
          create: await this.prisma.planFeature.findMany({ where: { planId: plan.id } }).then((features) =>
            features.map((f) => ({ module: f.module, enabled: f.enabled, limits: f.limits ?? undefined }))
          ),
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: org.id,
        action: "tenant.provisioned",
        entityType: "organization",
        entityId: org.id,
        metadata: { rkyvesClientId: dto.rkyvesClientId, planSlug: dto.planSlug },
      },
    });

  // Notify Rkyves webhook if configured
    const webhookUrl = process.env.RKYVES_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": process.env.RKYVES_WEBHOOK_SECRET || "",
          },
          body: JSON.stringify({
            event: "tenant.ready",
            organizationId: org.id,
            rkyvesClientId: dto.rkyvesClientId,
            slug: org.slug,
            adminEmail: dto.adminEmail,
          }),
        });
      } catch {
        // non-blocking
      }
    }

    return {
      organizationId: org.id,
      outletId: outlet.id,
      adminUserId: admin.id,
      subscriptionId: subscription.id,
      slug: org.slug,
      adminUrl: `https://admin.cullinos.com`,
    };
  }

  @Public()
  @Patch("subscriptions/:orgId/entitlements")
  async updateEntitlements(
    @Headers("x-internal-key") key: string,
    @Param("orgId") orgId: string,
    @Body() body: { status?: string; planSlug?: string; graceUntil?: string }
  ) {
    this.verifyKey(key);

    if (body.status === "suspended") {
      await this.prisma.organization.update({ where: { id: orgId }, data: { status: "suspended" } });
      await this.prisma.subscription.updateMany({
        where: { organizationId: orgId },
        data: { status: "suspended" },
      });
    } else if (body.status === "active") {
      await this.prisma.organization.update({ where: { id: orgId }, data: { status: "active" } });
      await this.prisma.subscription.updateMany({
        where: { organizationId: orgId },
        data: { status: "active", graceUntil: null },
      });
    }

    if (body.planSlug) {
      const plan = await this.prisma.plan.findUnique({ where: { slug: body.planSlug } });
      if (plan) {
        await this.prisma.subscription.updateMany({
          where: { organizationId: orgId },
          data: { planId: plan.id },
        });
      }
    }

    if (body.graceUntil) {
      await this.prisma.subscription.updateMany({
        where: { organizationId: orgId },
        data: { graceUntil: new Date(body.graceUntil), status: "past_due" },
      });
    }

    return { ok: true };
  }

  @Public()
  @Get("organizations/:id/health")
  async health(@Headers("x-internal-key") key: string, @Param("id") id: string) {
    this.verifyKey(key);
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        subscriptions: { include: { plan: true } },
        devices: true,
        outlets: true,
      },
    });
    if (!org) return { status: "not_found" };

    const lastSync = await this.prisma.syncEvent.findFirst({
      where: { organizationId: id, status: "synced" },
      orderBy: { syncedAt: "desc" },
    });

    return {
      organizationId: org.id,
      status: org.status,
      plan: org.subscriptions[0]?.plan?.slug,
      outlets: org.outlets.length,
      terminals: org.devices.filter((d) => d.type === "pos").length,
      gatewayStatus: org.devices.some((d) => d.type === "gateway") ? "registered" : "none",
      lastSync: lastSync?.syncedAt,
      version: "0.1.0",
    };
  }
}
