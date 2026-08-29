import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { verifyPassword } from "@cullinos/auth";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantProvisioningService } from "../organizations/tenant-provisioning.service";

@Injectable()
export class SuperAdminService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private provisioning: TenantProvisioningService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, status: "active", isSuperAdmin: true },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const accessToken = this.jwt.sign({
      sub: user.id,
      organizationId: user.organizationId,
      email: user.email,
      isSuperAdmin: true,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      admin: { id: user.id, email: user.email, name: user.name },
    };
  }

  async listOrganizations(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
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
      this.prisma.organization.count(),
    ]);

    return {
      data: organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        email: org.email,
        isActive: org.status === "active" || org.status === "trial",
        plan: org.subscriptions[0]?.plan?.slug ?? null,
        subscriptionStatus: org.subscriptions[0]?.status ?? null,
        outletCount: org.outlets.length,
        userCount: org.users.length,
        createdAt: org.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        hasMore: skip + organizations.length < total,
      },
    };
  }

  listTenants() {
    return this.prisma.organization.findMany({
      include: { subscriptions: { include: { plan: true } }, outlets: true },
      orderBy: { createdAt: "desc" },
    });
  }

  suspendTenant(id: string, _reason?: string) {
    return this.prisma.organization.update({ where: { id }, data: { status: "suspended" } });
  }

  reactivateTenant(id: string) {
    return this.prisma.organization.update({ where: { id }, data: { status: "active" } });
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

      return this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: plan.id,
          status: payload.status.toLowerCase() as never,
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
    ownerPassword: string;
    ownerName?: string;
    outletName?: string;
  }) {
    return this.provisioning.provisionTenant({
      companyName: input.companyName,
      planSlug: input.planSlug,
      adminEmail: input.ownerEmail,
      adminPassword: input.ownerPassword,
      adminName: input.ownerName ?? "Owner",
      outletName: input.outletName,
      status: "trial",
    });
  }

  async listPlans() {
    return this.prisma.plan.findMany({
      orderBy: { priceMonthly: "asc" },
      select: { id: true, slug: true, name: true, priceMonthly: true },
    });
  }

  async health() {
    const [totalOrganizations, activeOrganizations, ordersToday, pendingSyncEvents, failedNotifications] =
      await Promise.all([
        this.prisma.organization.count(),
        this.prisma.organization.count({ where: { status: { in: ["active", "trial"] } } }),
        this.prisma.order.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        this.prisma.syncEvent.count({ where: { status: "pending" } }),
        this.prisma.notification.count(),
      ]);

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      metrics: {
        totalOrganizations,
        activeOrganizations,
        ordersToday,
        pendingSyncEvents,
        failedNotifications: failedNotifications,
        unreadNotifications: failedNotifications,
      },
    };
  }
}
