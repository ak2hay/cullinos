import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Plan, Subscription, SubscriptionStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RazorpayClient } from "../payments/razorpay.client";

function isHttpLike(err: unknown): err is { getStatus?: () => number } {
  return typeof err === "object" && err !== null && "getStatus" in err;
}

@Injectable()
export class SaasBillingService {
  private readonly logger = new Logger(SaasBillingService.name);

  constructor(
    private prisma: PrismaService,
    private razorpay: RazorpayClient,
  ) {}

  async listForOrg(orgId: string) {
    return this.prisma.subscription.findMany({
      where: { organizationId: orgId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async currentForOrg(orgId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) throw new NotFoundException("No subscription");
    return subscription;
  }

  async syncPlansToRazorpay() {
    if (!this.razorpay.isConfigured()) {
      this.logger.warn("Skipping Razorpay plan sync — keys not configured");
      return [];
    }

    const plans = await this.prisma.plan.findMany({ where: { isActive: true } });
    const synced: string[] = [];
    for (const plan of plans) {
      await this.ensureRazorpayPlan(plan);
      synced.push(plan.slug);
    }
    return synced;
  }

  async ensureRazorpayPlan(plan: Plan) {
    if (plan.razorpayPlanIdMonthly) return plan.razorpayPlanIdMonthly;
    this.razorpay.requireConfigured();
    try {
      const created = await this.razorpay.createPlan({
        name: `Cullinos ${plan.name}`,
        amountPaise: Math.round(Number(plan.priceMonthly) * 100),
        description: plan.description,
      });
      const updated = await this.prisma.plan.update({
        where: { id: plan.id },
        data: { razorpayPlanIdMonthly: created.id },
      });
      return updated.razorpayPlanIdMonthly!;
    } catch (err) {
      if (isHttpLike(err)) throw err;
      this.logger.error(
        `Failed to sync plan ${plan.slug} to Razorpay: ${err instanceof Error ? err.message : err}`,
      );
      throw new BadGatewayException(
        "Could not sync billing plan with Razorpay. Check gateway keys and plan price.",
      );
    }
  }

  async collectPayment(orgId: string) {
    try {
      this.razorpay.requireConfigured();
    } catch (err) {
      if (isHttpLike(err)) throw err;
      throw new BadRequestException(
        "Razorpay is not configured. Ask a platform admin to set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
      );
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("Organization not found");

    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) throw new NotFoundException("No subscription");

    if (
      subscription.razorpaySubId &&
      subscription.razorpayShortUrl &&
      subscription.status !== "cancelled" &&
      subscription.status !== "trial"
    ) {
      return {
        organizationId: orgId,
        subscriptionId: subscription.id,
        razorpaySubId: subscription.razorpaySubId,
        shortUrl: subscription.razorpayShortUrl,
        status: subscription.status,
      };
    }

    try {
      const customerId = await this.ensureCustomer(org);
      const planId = await this.ensureRazorpayPlan(subscription.plan);
      const created = await this.razorpay.createSubscription({
        planId,
        customerId,
        notes: {
          kind: "saas",
          organizationId: orgId,
          subscriptionId: subscription.id,
        },
      });

      const shortUrl = created.short_url ?? subscription.razorpayShortUrl;

      const updated = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          razorpaySubId: created.id,
          razorpayShortUrl: shortUrl ?? null,
        },
        include: { plan: true },
      });

      return {
        organizationId: orgId,
        subscriptionId: updated.id,
        razorpaySubId: updated.razorpaySubId,
        shortUrl: updated.razorpayShortUrl,
        status: updated.status,
      };
    } catch (err) {
      if (isHttpLike(err)) throw err;
      this.logger.error(
        `collectPayment failed for org ${orgId}: ${err instanceof Error ? err.message : err}`,
      );
      throw new BadGatewayException(
        "Could not start Razorpay checkout. Verify gateway configuration and try again.",
      );
    }
  }

  async listActivePlans() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        priceMonthly: true,
        priceYearly: true,
        maxOutlets: true,
      },
    });
    return plans.map((p) => ({
      ...p,
      priceMonthly: Number(p.priceMonthly),
      priceYearly: Number(p.priceYearly),
    }));
  }

  /** Switch plan (e.g. after Enterprise trial) and start Razorpay checkout. */
  async activatePlan(orgId: string, planSlug: string) {
    const plan = await this.prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan || !plan.isActive) throw new NotFoundException("Plan not found");

    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) throw new NotFoundException("No subscription");

    const planFeatures = await this.prisma.planFeature.findMany({
      where: { planId: plan.id },
    });

    if (subscription.razorpaySubId) {
      await this.cancelGatewaySubscription(subscription);
    }

    await this.prisma.subscriptionEntitlement.deleteMany({
      where: { subscriptionId: subscription.id },
    });

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: plan.id,
        status: "past_due",
        trialEndsAt: null,
        razorpaySubId: null,
        razorpayShortUrl: null,
        entitlements: {
          create: planFeatures.map((f) => ({
            module: f.module,
            enabled: f.enabled,
            limits: f.limits ?? undefined,
          })),
        },
      },
    });

    return this.collectPayment(orgId);
  }

  async cancelGatewaySubscription(subscription: Pick<Subscription, "razorpaySubId">) {
    if (subscription.razorpaySubId) {
      await this.razorpay.cancelSubscription(subscription.razorpaySubId);
    }
  }

  async recreateForPlanChange(orgId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription?.razorpaySubId || !this.razorpay.isConfigured()) return;

    await this.cancelGatewaySubscription(subscription);
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { razorpaySubId: null, razorpayShortUrl: null },
    });

    if (subscription.status === "cancelled") return;
    await this.collectPayment(orgId);
  }

  async applyWebhook(event: string, payload: Record<string, unknown>) {
    const subscriptionEntity = this.entity(payload, "subscription");
    const paymentEntity = this.entity(payload, "payment");
    const notes = {
      ...(this.notesOf(subscriptionEntity) ?? {}),
      ...(this.notesOf(paymentEntity) ?? {}),
    };

    const razorpaySubId =
      this.stringField(subscriptionEntity, "id") ??
      this.stringField(paymentEntity, "subscription_id");
    const organizationId = notes.organizationId;
    const subscriptionId = notes.subscriptionId;

    const subscription = await this.findSubscription({
      id: subscriptionId,
      organizationId,
      razorpaySubId,
    });
    if (!subscription) {
      this.logger.warn(`SaaS webhook ${event} did not match a subscription`);
      return { handled: false };
    }

    const paymentId = this.stringField(paymentEntity, "id");
    const currentEnd = this.unixToDate(this.numberField(subscriptionEntity, "current_end"));
    const status = this.mapStatus(event, this.stringField(subscriptionEntity, "status"));

    const data: {
      status?: SubscriptionStatus;
      currentPeriodEnd?: Date;
      lastRazorpayPaymentId?: string;
      cancelledAt?: Date | null;
      razorpaySubId?: string;
    } = {};

    if (razorpaySubId) data.razorpaySubId = razorpaySubId;
    if (currentEnd) data.currentPeriodEnd = currentEnd;
    if (paymentId) data.lastRazorpayPaymentId = paymentId;
    if (status) data.status = status;
    if (status === "cancelled") data.cancelledAt = new Date();
    if (status === "active") {
      data.cancelledAt = null;
      await this.prisma.organization.update({
        where: { id: subscription.organizationId },
        data: { status: "active" },
      });
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data,
    });

    return { handled: true, subscriptionId: subscription.id, status };
  }

  private async ensureCustomer(org: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    razorpayCustomerId: string | null;
  }) {
    if (org.razorpayCustomerId) return org.razorpayCustomerId;
    if (!org.email && !org.phone) {
      throw new BadRequestException(
        "Organization needs an email or phone before starting Razorpay checkout.",
      );
    }
    try {
      const customer = await this.razorpay.createCustomer({
        name: org.name,
        email: org.email,
        contact: org.phone,
        notes: { kind: "saas", organizationId: org.id },
      });
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { razorpayCustomerId: customer.id },
      });
      return customer.id;
    } catch (err) {
      if (isHttpLike(err)) throw err;
      this.logger.error(
        `Failed to create Razorpay customer for org ${org.id}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      throw new BadGatewayException(
        "Could not create Razorpay customer. Check organization email/phone and gateway keys.",
      );
    }
  }

  private async findSubscription(input: {
    id?: string;
    organizationId?: string;
    razorpaySubId?: string;
  }) {
    if (input.id) {
      return this.prisma.subscription.findUnique({ where: { id: input.id } });
    }
    if (input.razorpaySubId) {
      return this.prisma.subscription.findFirst({
        where: { razorpaySubId: input.razorpaySubId },
      });
    }
    if (input.organizationId) {
      return this.prisma.subscription.findFirst({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "desc" },
      });
    }
    return null;
  }

  private entity(payload: Record<string, unknown>, key: string) {
    const section = payload[key] as { entity?: Record<string, unknown> } | undefined;
    return section?.entity ?? null;
  }

  private notesOf(entity: Record<string, unknown> | null): Record<string, string> | null {
    if (!entity || typeof entity.notes !== "object" || !entity.notes) return null;
    return entity.notes as Record<string, string>;
  }

  private stringField(entity: Record<string, unknown> | null, key: string) {
    const value = entity?.[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private numberField(entity: Record<string, unknown> | null, key: string) {
    const value = entity?.[key];
    return typeof value === "number" ? value : undefined;
  }

  private unixToDate(value?: number) {
    if (!value) return undefined;
    return new Date(value * 1000);
  }

  private mapStatus(event: string, gatewayStatus?: string): SubscriptionStatus | undefined {
    if (event === "subscription.cancelled" || gatewayStatus === "cancelled" || gatewayStatus === "expired" || gatewayStatus === "completed") {
      return "cancelled";
    }
    if (event === "subscription.halted" || gatewayStatus === "halted") {
      return "suspended";
    }
    if (event === "subscription.pending" || gatewayStatus === "pending") {
      return "past_due";
    }
    if (
      event === "subscription.activated" ||
      event === "subscription.charged" ||
      gatewayStatus === "active" ||
      gatewayStatus === "authenticated"
    ) {
      return "active";
    }
    return undefined;
  }
}
