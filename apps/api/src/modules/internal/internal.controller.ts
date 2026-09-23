import { timingSafeEqual } from "crypto";
import { Body, Controller, Get, Headers, Param, Patch, Post, UnauthorizedException } from "@nestjs/common";
import { Public } from "../../common/decorators";
import { generateTemporaryPassword } from "../../common/generate-password";
import { TenantProvisioningService } from "../organizations/tenant-provisioning.service";
import { MailService } from "../mail/mail.service";
import { PlatformConfigService } from "../platform-config/platform-config.service";
import { PrismaService } from "../../prisma/prisma.service";

class ProvisionDto {
  rkyvesClientId!: string;
  companyName!: string;
  planSlug!: string;
  adminEmail!: string;
  adminPassword?: string;
  outletName!: string;
  adminName?: string;
}

@Controller("internal")
export class InternalController {
  constructor(
    private provisioning: TenantProvisioningService,
    private prisma: PrismaService,
    private mail: MailService,
    private config: PlatformConfigService,
  ) {}

  private verifyKey(key: string | undefined) {
    const expected = (this.config.get("INTERNAL_API_KEY") ?? "").trim();
    if (!expected) {
      throw new UnauthorizedException("Internal API key is not configured");
    }
    const provided = (key ?? "").trim();
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException("Invalid internal API key");
    }
  }

  /** Rkyves / platform ops onboards a restaurant and issues owner credentials. */
  @Public()
  @Post("provision")
  async provision(@Headers("x-internal-key") key: string, @Body() dto: ProvisionDto) {
    this.verifyKey(key);

    const temporaryPassword = dto.adminPassword?.trim() || generateTemporaryPassword();
    const mustChangePassword = !dto.adminPassword?.trim();
    const adminName = dto.adminName ?? "Owner";

    const result = await this.provisioning.provisionTenant({
      companyName: dto.companyName,
      planSlug: dto.planSlug,
      adminEmail: dto.adminEmail,
      adminPassword: temporaryPassword,
      adminName,
      outletName: dto.outletName,
      rkyvesClientId: dto.rkyvesClientId,
      status: "trial",
      mustChangePassword,
    });

    let emailSent = false;
    if (mustChangePassword) {
      emailSent = await this.mail.sendOwnerCredentials({
        to: dto.adminEmail,
        ownerName: adminName,
        restaurantName: dto.companyName,
        temporaryPassword,
        adminUrl: result.adminUrl,
      });
    }

    const webhookUrl = this.config.get("RKYVES_WEBHOOK_URL");
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-webhook-secret": this.config.get("RKYVES_WEBHOOK_SECRET") || "",
          },
          body: JSON.stringify({
            event: "tenant.ready",
            organizationId: result.organizationId,
            rkyvesClientId: dto.rkyvesClientId,
            slug: result.organizationSlug,
            adminEmail: result.ownerEmail,
          }),
        });
      } catch {
        // non-blocking
      }
    }

    return {
      organizationId: result.organizationId,
      outletId: result.outletId,
      adminUserId: result.ownerUserId,
      subscriptionId: result.subscriptionId,
      slug: result.organizationSlug,
      adminUrl: result.adminUrl,
      ownerEmail: result.ownerEmail,
      temporaryPassword: mustChangePassword ? temporaryPassword : undefined,
      emailSent,
    };
  }

  @Public()
  @Patch("subscriptions/:orgId/entitlements")
  async updateEntitlements(
    @Headers("x-internal-key") key: string,
    @Param("orgId") orgId: string,
    @Body() body: { status?: string; planSlug?: string; graceUntil?: string },
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
