import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, randomBytes } from "crypto";
import { hashPassword, verifyPassword } from "@cullinos/auth";
import type { Prisma } from "@prisma/client";
import { generateTemporaryPassword } from "../../common/generate-password";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { MailService } from "../mail/mail.service";
import { Msg91Service } from "../sms/msg91.service";
import { TenantProvisioningService } from "../organizations/tenant-provisioning.service";
import { SaasBillingService } from "../subscriptions/saas-billing.service";

type OrgListFilters = {
  q?: string;
  status?: string;
  planSlug?: string;
};

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dateKey(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

function buildDaySeries(days: number, start: Date): string[] {
  const keys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    keys.push(dateKey(d));
  }
  return keys;
}

@Injectable()
export class SuperAdminService {
  constructor(
    private prisma: PrismaService,
    private provisioning: TenantProvisioningService,
    private saas: SaasBillingService,
    private mail: MailService,
    private auth: AuthService,
    private msg91: Msg91Service,
  ) {}

  private adminAppUrl(): string {
    return (
      process.env.ADMIN_URL?.replace(/\/$/, "") ||
      process.env.ADMIN_APP_URL?.replace(/\/$/, "") ||
      "https://admin.cullinos.com"
    );
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, status: "active", isSuperAdmin: true },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const result = await this.auth.startLoginOtp(user.id, user.email);
    if ("requiresOtp" in result) {
      return result;
    }

    if (!(result.user as { isSuperAdmin?: boolean }).isSuperAdmin) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const name = [result.user.firstName, result.user.lastName].filter(Boolean).join(" ");
    return {
      accessToken: result.accessToken,
      admin: {
        id: result.user.id,
        email: result.user.email,
        name: name || result.user.email,
      },
    };
  }

  async verifyOtp(challengeToken: string, otp: string) {
    const result = await this.auth.verifyLoginOtp(challengeToken, otp);
    if (!(result.user as { isSuperAdmin?: boolean }).isSuperAdmin) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const name = [result.user.firstName, result.user.lastName].filter(Boolean).join(" ");
    return {
      accessToken: result.accessToken,
      admin: {
        id: result.user.id,
        email: result.user.email,
        name: name || result.user.email,
      },
    };
  }

  async resendOtp(challengeToken: string) {
    return this.auth.resendOtp(challengeToken);
  }

  private orgListWhere(filters?: OrgListFilters): Prisma.OrganizationWhereInput {
    const where: Prisma.OrganizationWhereInput = {};
    const q = filters?.q?.trim();
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    if (filters?.status) {
      where.status = filters.status as never;
    }
    if (filters?.planSlug) {
      where.subscriptions = {
        some: { plan: { slug: filters.planSlug } },
      };
    }
    return where;
  }

  private mapOrgSummary(org: {
    id: string;
    name: string;
    slug: string;
    email: string | null;
    status: string;
    createdAt: Date;
    subscriptions: Array<{
      status: string;
      trialEndsAt: Date | null;
      graceUntil: Date | null;
      razorpayShortUrl: string | null;
      razorpaySubId: string | null;
      lastRazorpayPaymentId: string | null;
      plan: { slug: string; priceMonthly: { toString(): string } | number } | null;
    }>;
    outlets: unknown[];
    users: unknown[];
  }) {
    const sub = org.subscriptions[0];
    const priceMonthly = sub?.plan?.priceMonthly != null ? Number(sub.plan.priceMonthly) : 0;
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      email: org.email,
      status: org.status,
      isActive: org.status === "active" || org.status === "trial",
      plan: sub?.plan?.slug ?? null,
      priceMonthly,
      mrrContribution:
        sub && ["active", "trial", "past_due"].includes(sub.status) ? priceMonthly : 0,
      subscriptionStatus: sub?.status ?? null,
      trialEndsAt: sub?.trialEndsAt?.toISOString() ?? null,
      graceUntil: sub?.graceUntil?.toISOString() ?? null,
      checkoutUrl: sub?.razorpayShortUrl ?? null,
      razorpaySubId: sub?.razorpaySubId ?? null,
      lastRazorpayPaymentId: sub?.lastRazorpayPaymentId ?? null,
      outletCount: org.outlets.length,
      userCount: org.users.length,
      createdAt: org.createdAt.toISOString(),
    };
  }

  async listOrganizations(page = 1, limit = 20, filters?: OrgListFilters) {
    const skip = (page - 1) * limit;
    const where = this.orgListWhere(filters);
    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        include: {
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          outlets: true,
          users: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: organizations.map((org) => this.mapOrgSummary(org)),
      meta: {
        total,
        page,
        limit,
        hasMore: skip + organizations.length < total,
      },
    };
  }

  async getOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: { plan: true, entitlements: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        outlets: { select: { id: true, name: true, slug: true, status: true } },
        _count: { select: { users: true, outlets: true, orders: true } },
      },
    });
    if (!org) throw new NotFoundException("Organization not found");

    const recentAudit = await this.prisma.auditLog.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    const sub = org.subscriptions[0];
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      email: org.email,
      phone: org.phone,
      status: org.status,
      businessType: org.businessType,
      restaurantSize: org.restaurantSize,
      city: org.city,
      state: org.state,
      country: org.country,
      timezone: org.timezone,
      currency: org.currency,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
      counts: org._count,
      outlets: org.outlets,
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            planId: sub.planId,
            planSlug: sub.plan.slug,
            planName: sub.plan.name,
            priceMonthly: Number(sub.plan.priceMonthly),
            trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
            graceUntil: sub.graceUntil?.toISOString() ?? null,
            currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
            razorpaySubId: sub.razorpaySubId,
            razorpayShortUrl: sub.razorpayShortUrl,
            lastRazorpayPaymentId: sub.lastRazorpayPaymentId,
            entitlements: sub.entitlements,
          }
        : null,
      recentAudit: recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
        user: a.user,
      })),
    };
  }

  async listOrganizationUsers(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("Organization not found");

    const users = await this.prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        status: true,
        isSuperAdmin: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: { include: { role: { select: { slug: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      status: u.status,
      mustChangePassword: u.mustChangePassword,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      roles: u.userRoles.map((ur) => ({ slug: ur.role.slug, name: ur.role.name })),
    }));
  }

  async resetOrganizationUserPassword(orgId: string, userId: string, actorUserId?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isSuperAdmin: false },
      include: { organization: true },
    });
    if (!user) throw new NotFoundException("User not found");

    const temporaryPassword = generateTemporaryPassword();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
      },
    });

    const adminUrl = this.adminAppUrl();
    const emailSent = await this.mail.sendOwnerCredentials({
      to: user.email,
      ownerName: user.name,
      restaurantName: user.organization.name,
      temporaryPassword,
      adminUrl,
    });

    let smsSent = false;
    if (user.phone) {
      try {
        const sms = await this.msg91.sendTransactionalSms(
          user.phone,
          `Cullinos: Password reset for ${user.organization.name}. Email: ${user.email}. Temp password: ${temporaryPassword}. Login: ${adminUrl}`,
        );
        smsSent = sms.sent;
      } catch {
        smsSent = false;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: actorUserId ?? null,
        action: "reset_password",
        entityType: "user",
        entityId: userId,
        metadata: { email: user.email, emailSent, smsSent },
      },
    });

    return {
      userId: user.id,
      email: user.email,
      temporaryPassword,
      emailSent,
      smsSent,
      adminUrl,
    };
  }

  async deactivateOrganizationUser(orgId: string, userId: string, actorUserId?: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("Organization not found");

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isSuperAdmin: false },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException("User not found");

    const isOwner = user.userRoles.some((ur) => ur.role.slug === "owner");
    if (isOwner && user.status === "active") {
      const otherActiveOwners = await this.prisma.user.count({
        where: {
          organizationId: orgId,
          status: "active",
          id: { not: userId },
          userRoles: { some: { role: { slug: "owner" } } },
        },
      });
      if (otherActiveOwners === 0) {
        throw new ForbiddenException(
          "Cannot deactivate the last active owner. Assign another owner first.",
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: "inactive" },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: actorUserId ?? null,
        action: "deactivate_user",
        entityType: "user",
        entityId: userId,
        metadata: { email: user.email, wasOwner: isOwner },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      status: updated.status,
    };
  }

  async activateOrganizationUser(orgId: string, userId: string, actorUserId?: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("Organization not found");

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: orgId, isSuperAdmin: false },
    });
    if (!user) throw new NotFoundException("User not found");

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: "active" },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: actorUserId ?? null,
        action: "activate_user",
        entityType: "user",
        entityId: userId,
        metadata: { email: user.email },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      status: updated.status,
    };
  }

  async listAuditLogs(page = 1, limit = 50, organizationId?: string) {
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = organizationId ? { organizationId } : {};
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, email: true, name: true } },
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        metadata: a.metadata,
        createdAt: a.createdAt.toISOString(),
        user: a.user,
        organization: a.organization,
      })),
      meta: { total, page, limit, hasMore: skip + logs.length < total },
    };
  }

  async impersonateOrganization(
    orgId: string,
    impersonatedBy: string,
    reason: string,
  ) {
    const trimmedReason = reason?.trim();
    if (!trimmedReason || trimmedReason.length < 8) {
      throw new BadRequestException("A support reason (min 8 chars) is required");
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("Organization not found");
    if (org.status === "suspended") {
      throw new BadRequestException("Cannot impersonate a suspended organization");
    }

    let target = await this.prisma.user.findFirst({
      where: {
        organizationId: orgId,
        status: "active",
        isSuperAdmin: false,
        userRoles: { some: { role: { slug: "owner" } } },
      },
      include: { organization: true },
    });

    if (!target) {
      target = await this.prisma.user.findFirst({
        where: { organizationId: orgId, status: "active", isSuperAdmin: false },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!target) {
      throw new NotFoundException("No active user found to impersonate");
    }

    const session = await this.auth.issueImpersonationSession(target, impersonatedBy);
    const adminBase = this.adminAppUrl();

    const code = randomBytes(32).toString("hex");
    const codeHash = createHash("sha256").update(code).digest("hex");

    await this.prisma.impersonationHandoff.create({
      data: {
        organizationId: orgId,
        createdByUserId: impersonatedBy,
        targetUserId: target.id,
        codeHash,
        accessToken: session.accessToken,
        reason: trimmedReason,
        expiresAt: new Date(session.expiresAt),
      },
    });

    const adminUrl = `${adminBase}/?impersonationCode=${encodeURIComponent(code)}`;

    await this.prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: impersonatedBy,
        action: "impersonate_start",
        entityType: "organization",
        entityId: orgId,
        metadata: {
          targetUserId: target.id,
          reason: trimmedReason,
          expiresAt: session.expiresAt,
          handoff: true,
        },
      },
    });

    return {
      expiresIn: session.expiresIn,
      expiresAt: session.expiresAt,
      refreshToken: null as string | null,
      handoffCode: code,
      adminUrl,
      organization: { id: org.id, name: org.name, slug: org.slug },
      user: { id: target.id, email: target.email, name: target.name },
    };
  }

  listTenants() {
    return this.prisma.organization.findMany({
      include: { subscriptions: { include: { plan: true } }, outlets: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async suspendTenant(id: string, reason?: string, actorUserId?: string) {
    const org = await this.prisma.organization.update({
      where: { id },
      data: { status: "suspended" },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: id,
        userId: actorUserId ?? null,
        action: "suspend",
        entityType: "organization",
        entityId: id,
        metadata: { reason: reason ?? null },
      },
    });
    return org;
  }

  async reactivateTenant(id: string, actorUserId?: string) {
    const org = await this.prisma.organization.update({
      where: { id },
      data: { status: "active" },
    });
    await this.prisma.auditLog.create({
      data: {
        organizationId: id,
        userId: actorUserId ?? null,
        action: "activate",
        entityType: "organization",
        entityId: id,
        metadata: {},
      },
    });
    return org;
  }

  async deleteOrganization(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) throw new NotFoundException("Organization not found");

    await this.prisma.organization.delete({ where: { id } });
    return { deleted: true, id, name: org.name };
  }

  async manageSubscription(
    orgId: string,
    payload: { planId?: string; planSlug?: string; status: string },
  ) {
    const plan = payload.planId
      ? await this.prisma.plan.findUnique({ where: { id: payload.planId } })
      : payload.planSlug
        ? await this.prisma.plan.findUnique({ where: { slug: payload.planSlug } })
        : null;
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });

    const planFeatures = await this.prisma.planFeature.findMany({
      where: { planId: plan.id },
    });

    if (subscription) {
      await this.prisma.subscriptionEntitlement.deleteMany({
        where: { subscriptionId: subscription.id },
      });

      const nextStatus = payload.status.toLowerCase();
      const previousPlanId = subscription.planId;
      if (nextStatus === "cancelled") {
        await this.saas.cancelGatewaySubscription(subscription);
      }

      const updated = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: plan.id,
          status: nextStatus as never,
          cancelledAt: nextStatus === "cancelled" ? new Date() : null,
          entitlements: {
            create: planFeatures.map((f) => ({
              module: f.module,
              enabled: f.enabled,
            })),
          },
        },
        include: { plan: true, entitlements: true },
      });

      if (nextStatus !== "cancelled" && previousPlanId !== plan.id && subscription.razorpaySubId) {
        await this.saas.recreateForPlanChange(orgId);
      }

      return updated;
    }

    return this.prisma.subscription.create({
      data: {
        organizationId: orgId,
        planId: plan.id,
        status: payload.status.toLowerCase() as never,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        entitlements: {
          create: planFeatures.map((f) => ({
            module: f.module,
            enabled: f.enabled,
          })),
        },
      },
      include: { plan: true, entitlements: true },
    });
  }

  async onboardRestaurant(input: {
    companyName: string;
    planSlug: string;
    ownerEmail: string;
    ownerName?: string;
    ownerPhone?: string;
    outletName?: string;
    businessType?: string;
    restaurantSize?: string | null;
  }) {
    const ownerEmail = input.ownerEmail.trim().toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: { email: ownerEmail },
    });
    if (existingUser?.isSuperAdmin) {
      throw new BadRequestException(
        "Owner email cannot be your platform admin login. Use a unique email for the restaurant owner.",
      );
    }
    if (existingUser) {
      throw new BadRequestException(
        `Email "${ownerEmail}" is already registered. Use a unique owner email for this restaurant.`,
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const ownerName = input.ownerName?.trim() || "Owner";
    const result = await this.provisioning.provisionTenant({
      companyName: input.companyName,
      planSlug: input.planSlug,
      adminEmail: ownerEmail,
      adminPassword: temporaryPassword,
      adminName: ownerName,
      adminPhone: input.ownerPhone?.trim() || undefined,
      outletName: input.outletName,
      status: "trial",
      mustChangePassword: true,
      businessType: input.businessType,
      restaurantSize:
        input.businessType === "restaurant" ? (input.restaurantSize ?? null) : null,
      trialDays: 15,
    });

    const emailSent = await this.mail.sendOwnerCredentials({
      to: ownerEmail,
      ownerName,
      restaurantName: input.companyName,
      temporaryPassword,
      adminUrl: result.adminUrl,
    });

    let smsSent = false;
    const phone = input.ownerPhone?.trim();
    if (phone) {
      try {
        const sms = await this.msg91.sendTransactionalSms(
          phone,
          `Cullinos: Your ${input.companyName} admin login is ready. Email: ${ownerEmail}. Temp password: ${temporaryPassword}. Login: ${result.adminUrl}`,
        );
        smsSent = sms.sent;
      } catch {
        smsSent = false;
      }
    }

    return {
      ...result,
      temporaryPassword,
      emailSent,
      smsSent,
    };
  }

  collectSubscription(orgId: string) {
    return this.saas.collectPayment(orgId);
  }

  async listPlans() {
    const plans = await this.prisma.plan.findMany({
      orderBy: [{ sortOrder: "asc" }, { priceMonthly: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        priceMonthly: true,
        priceYearly: true,
        maxOutlets: true,
        maxTerminals: true,
        isActive: true,
        sortOrder: true,
        features: {
          select: { module: true, enabled: true },
          orderBy: { module: "asc" },
        },
        _count: { select: { subscriptions: true } },
      },
    });

    return plans.map((plan) => ({
      ...plan,
      priceMonthly: Number(plan.priceMonthly),
      priceYearly: Number(plan.priceYearly),
      subscriptionCount: plan._count.subscriptions,
      modules: plan.features.filter((f) => f.enabled).map((f) => f.module),
    }));
  }

  async createPlan(input: {
    name: string;
    slug: string;
    description?: string;
    priceMonthly?: number;
    priceYearly?: number;
    maxOutlets?: number;
    maxTerminals?: number;
    modules?: string[];
  }) {
    const slug = input.slug.trim().toLowerCase().replace(/\s+/g, "-");
    const existing = await this.prisma.plan.findUnique({ where: { slug } });
    if (existing) throw new BadRequestException(`Plan slug "${slug}" already exists`);

    const modules = [...new Set((input.modules ?? []).map((m) => m.trim()).filter(Boolean))];
    const plan = await this.prisma.plan.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || null,
        priceMonthly: input.priceMonthly ?? 0,
        priceYearly: input.priceYearly ?? 0,
        maxOutlets: input.maxOutlets ?? 1,
        maxTerminals: input.maxTerminals ?? 2,
        isActive: true,
        features:
          modules.length > 0
            ? { create: modules.map((module) => ({ module, enabled: true })) }
            : undefined,
      },
    });

    const plans = await this.listPlans();
    return plans.find((p) => p.id === plan.id);
  }

  async updatePlan(
    planId: string,
    input: {
      name?: string;
      description?: string | null;
      priceMonthly?: number;
      priceYearly?: number;
      maxOutlets?: number;
      maxTerminals?: number;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plan not found");

    await this.prisma.plan.update({
      where: { id: planId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priceMonthly !== undefined ? { priceMonthly: input.priceMonthly } : {}),
        ...(input.priceYearly !== undefined ? { priceYearly: input.priceYearly } : {}),
        ...(input.maxOutlets !== undefined ? { maxOutlets: input.maxOutlets } : {}),
        ...(input.maxTerminals !== undefined ? { maxTerminals: input.maxTerminals } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    const plans = await this.listPlans();
    return plans.find((p) => p.id === planId);
  }

  async deactivatePlan(planId: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!plan) throw new NotFoundException("Plan not found");
    if (plan._count.subscriptions > 0) {
      await this.prisma.plan.update({ where: { id: planId }, data: { isActive: false } });
      return { deactivated: true, deleted: false, id: planId };
    }
    await this.prisma.plan.delete({ where: { id: planId } });
    return { deactivated: false, deleted: true, id: planId };
  }

  async updatePlanModules(planId: string, modules: string[]) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException("Plan not found");

    const uniqueModules = [...new Set(modules.map((m) => m.trim()).filter(Boolean))];

    await this.prisma.$transaction(async (tx) => {
      await tx.planFeature.updateMany({
        where: { planId },
        data: { enabled: false },
      });
      for (const module of uniqueModules) {
        await tx.planFeature.upsert({
          where: { planId_module: { planId, module } },
          update: { enabled: true },
          create: { planId, module, enabled: true },
        });
      }
    });

    const plans = await this.listPlans();
    return plans.find((p) => p.id === planId);
  }

  async analyticsOverview(range: "7d" | "30d" | "90d" = "30d") {
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const now = new Date();
    const rangeStart = startOfUtcDay(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
    const todayStart = startOfUtcDay(now);
    const trialWindowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dayKeys = buildDaySeries(days, rangeStart);

    const [
      organizations,
      newOrgs,
      cancelledSubs,
      ordersInRange,
      ordersToday,
      pendingSyncEvents,
      failedSyncEvents,
      unreadNotifications,
      trialsEnding,
    ] = await Promise.all([
      this.prisma.organization.findMany({
        include: {
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      this.prisma.organization.findMany({
        where: { createdAt: { gte: rangeStart } },
        select: { createdAt: true },
      }),
      this.prisma.subscription.findMany({
        where: {
          status: "cancelled",
          cancelledAt: { gte: rangeStart },
        },
        select: { cancelledAt: true },
      }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: rangeStart } },
        select: { createdAt: true },
      }),
      this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.syncEvent.count({ where: { status: "pending" } }),
      this.prisma.syncEvent.count({ where: { status: "failed" } }),
      this.prisma.notification.count({ where: { read: false } }),
      this.prisma.subscription.findMany({
        where: {
          status: "trial",
          trialEndsAt: { gte: now, lte: trialWindowEnd },
        },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          plan: { select: { slug: true, name: true } },
        },
        orderBy: { trialEndsAt: "asc" },
        take: 20,
      }),
    ]);

    let mrr = 0;
    let trialCount = 0;
    let activeOrgs = 0;
    const totalOrgs = organizations.length;
    const planMixMap = new Map<
      string,
      { planSlug: string; planName: string; count: number; mrr: number }
    >();

    for (const org of organizations) {
      if (org.status === "active" || org.status === "trial") activeOrgs += 1;
      const sub = org.subscriptions[0];
      if (!sub?.plan) continue;
      if (sub.status === "trial") trialCount += 1;
      const price = Number(sub.plan.priceMonthly);
      if (["active", "trial", "past_due"].includes(sub.status) && org.status !== "suspended") {
        mrr += price;
      }
      const key = sub.plan.slug;
      const entry = planMixMap.get(key) ?? {
        planSlug: sub.plan.slug,
        planName: sub.plan.name,
        count: 0,
        mrr: 0,
      };
      entry.count += 1;
      if (["active", "trial", "past_due"].includes(sub.status) && org.status !== "suspended") {
        entry.mrr += price;
      }
      planMixMap.set(key, entry);
    }

    const newOrgsByDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    for (const o of newOrgs) {
      const k = dateKey(o.createdAt);
      if (k in newOrgsByDay) newOrgsByDay[k]! += 1;
    }

    const ordersByDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
    for (const o of ordersInRange) {
      const k = dateKey(o.createdAt);
      if (k in ordersByDay) ordersByDay[k]! += 1;
    }

    const cancelledInRange = cancelledSubs.length;

    return {
      range,
      rangeStart: rangeStart.toISOString(),
      generatedAt: now.toISOString(),
      saas: {
        mrr: Math.round(mrr * 100) / 100,
        arr: Math.round(mrr * 12 * 100) / 100,
        trialCount,
        cancelledInRange,
        planMix: [...planMixMap.values()].sort((a, b) => b.count - a.count),
        newOrganizationsByDay: dayKeys.map((date) => ({
          date,
          count: newOrgsByDay[date] ?? 0,
        })),
        trialsEndingSoon: trialsEnding.map((t) => ({
          organizationId: t.organization.id,
          organizationName: t.organization.name,
          organizationSlug: t.organization.slug,
          planSlug: t.plan.slug,
          planName: t.plan.name,
          trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
        })),
      },
      ops: {
        totalOrganizations: totalOrgs,
        activeOrganizations: activeOrgs,
        ordersToday,
        pendingSyncEvents,
        failedSyncEvents,
        unreadNotifications,
        failedNotifications: failedSyncEvents,
        ordersByDay: dayKeys.map((date) => ({ date, count: ordersByDay[date] ?? 0 })),
      },
      alerts: [
        ...(failedSyncEvents > 0
          ? [{ severity: "error" as const, message: `${failedSyncEvents} failed sync events` }]
          : []),
        ...(pendingSyncEvents > 50
          ? [
              {
                severity: "warning" as const,
                message: `${pendingSyncEvents} pending sync events`,
              },
            ]
          : []),
        ...(trialsEnding.length > 0
          ? [
              {
                severity: "info" as const,
                message: `${trialsEnding.length} trial(s) ending within 7 days`,
              },
            ]
          : []),
      ],
    };
  }

  async health() {
    const [
      totalOrganizations,
      activeOrganizations,
      trialOrganizations,
      ordersToday,
      pendingSyncEvents,
      failedSyncEvents,
      unreadNotifications,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: { in: ["active", "trial"] } } }),
      this.prisma.organization.count({ where: { status: "trial" } }),
      this.prisma.order.count({
        where: {
          createdAt: {
            gte: startOfUtcDay(new Date()),
          },
        },
      }),
      this.prisma.syncEvent.count({ where: { status: "pending" } }),
      this.prisma.syncEvent.count({ where: { status: "failed" } }),
      this.prisma.notification.count({ where: { read: false } }),
    ]);

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      metrics: {
        totalOrganizations,
        activeOrganizations,
        trialOrganizations,
        ordersToday,
        pendingSyncEvents,
        failedNotifications: failedSyncEvents,
        failedSyncEvents,
        unreadNotifications,
      },
    };
  }
}
