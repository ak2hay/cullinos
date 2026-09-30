import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Plan, Subscription, SubscriptionStatus } from "@prisma/client";
import { isContactSalesPlanSlug } from "@cullinos/shared";
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
      if (Number(plan.priceMonthly) <= 0) continue;
      await this.ensureRazorpayPlan(plan);
      synced.push(plan.slug);
    }
    return synced;
  }

  async ensureRazorpayPlan(plan: Plan) {
    if (Number(plan.priceMonthly) <= 0) {
      throw new BadRequestException(
        `${plan.name} is custom-priced. Contact us for pricing to activate billing.`,
      );
    }
    if (plan.razorpayPlanIdMonthly) {
      const existing = await this.razorpay.fetchPlan(plan.razorpayPlanIdMonthly);
      if (existing) return existing.id;
      this.logger.warn(
        `Stored Razorpay plan ${plan.razorpayPlanIdMonthly} for ${plan.slug} is missing; recreating`,
      );
      await this.prisma.plan.update({
        where: { id: plan.id },
        data: { razorpayPlanIdMonthly: null },
      });
      plan = { ...plan, razorpayPlanIdMonthly: null };
    }

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

    let subscription = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) throw new NotFoundException("No subscription");

    if (
      subscription.razorpaySubId &&
      subscription.status !== "cancelled" &&
      subscription.status !== "trial"
    ) {
      const gatewaySub = await this.razorpay.fetchSubscription(subscription.razorpaySubId);
      if (
        gatewaySub &&
        (gatewaySub.status === "created" || gatewaySub.status === "authenticated")
      ) {
        const shortUrl = gatewaySub.short_url ?? subscription.razorpayShortUrl ?? null;
        if (shortUrl && shortUrl !== subscription.razorpayShortUrl) {
          await this.prisma.subscription.update({
            where: { id: subscription.id },
            data: { razorpayShortUrl: shortUrl },
          });
        }
        return this.checkoutPayload({
          organizationId: orgId,
          subscriptionId: subscription.id,
          razorpaySubId: subscription.razorpaySubId,
          shortUrl,
          status: subscription.status,
          org,
        });
      }

      this.logger.warn(
        `Clearing non-payable Razorpay subscription ${subscription.razorpaySubId} for org ${orgId} (gateway status: ${gatewaySub?.status ?? "missing"})`,
      );
      subscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { razorpaySubId: null, razorpayShortUrl: null },
        include: { plan: true },
      });
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

      const shortUrl = created.short_url ?? null;

      const updated = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          razorpaySubId: created.id,
          razorpayShortUrl: shortUrl,
        },
        include: { plan: true },
      });

      return this.checkoutPayload({
        organizationId: orgId,
        subscriptionId: updated.id,
        razorpaySubId: updated.razorpaySubId,
        shortUrl: updated.razorpayShortUrl,
        status: updated.status,
        org,
      });
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
      where: { isActive: true, visibility: "public" },
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
        maxUsers: true,
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
    if (!plan || !plan.isActive || plan.visibility !== "public") {
      throw new NotFoundException("Plan not found");
    }
    if (isContactSalesPlanSlug(plan.slug)) {
      throw new BadRequestException(
        `${plan.name} is custom-priced. Contact us for pricing to switch to this plan.`,
      );
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
    });
    if (!subscription) throw new NotFoundException("No subscription");

    // A paying tenant keeps the current plan until the new gateway subscription's first charge.
    if (subscription.status === "active" && subscription.razorpaySubId && plan.id !== subscription.planId) {
      return this.startPendingPlanChange(orgId, subscription.id, plan);
    }

    if (subscription.razorpaySubId) {
      await this.cancelGatewaySubscription(subscription);
    }
    await this.switchPlan(subscription.id, plan.id, {
      status: "past_due",
      trialEndsAt: null,
      razorpaySubId: null,
      razorpayShortUrl: null,
    });

    return this.collectPayment(orgId);
  }

  private async switchPlan(
    subscriptionId: string,
    planId: string,
    extra: Record<string, unknown>,
  ) {
    const planFeatures = await this.prisma.planFeature.findMany({ where: { planId } });
    await this.prisma.$transaction([
      this.prisma.subscriptionEntitlement.deleteMany({ where: { subscriptionId } }),
      this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          ...extra,
          planId,
          entitlements: {
            create: planFeatures.map((f) => ({
              module: f.module,
              enabled: f.enabled,
              limits: f.limits ?? undefined,
            })),
          },
        },
      }),
    ]);
  }

  private async startPendingPlanChange(orgId: string, subscriptionId: string, plan: Plan) {
    this.razorpay.requireConfigured();
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException("Organization not found");
    const existing = await this.prisma.subscription.findUniqueOrThrow({
      where: { id: subscriptionId },
    });
    if (existing.pendingRazorpaySubId) {
      await this.razorpay.cancelSubscription(existing.pendingRazorpaySubId).catch(() => undefined);
    }
    const customerId = await this.ensureCustomer(org);
    const gatewayPlanId = await this.ensureRazorpayPlan(plan);
    const created = await this.razorpay.createSubscription({
      planId: gatewayPlanId,
      customerId,
      notes: {
        kind: "saas",
        organizationId: orgId,
        subscriptionId,
        pendingPlanId: plan.id,
      },
    });
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        pendingPlanId: plan.id,
        pendingRazorpaySubId: created.id,
      },
    });
    return this.checkoutPayload({
      organizationId: orgId,
      subscriptionId,
      razorpaySubId: created.id,
      shortUrl: created.short_url ?? null,
      status: existing.status,
      org,
    });
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

    // First charge on a pending plan change: promote the new plan and retire the old gateway sub.
    if (razorpaySubId && razorpaySubId === subscription.pendingRazorpaySubId) {
      if (status === "cancelled" || status === "suspended") {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { pendingPlanId: null, pendingRazorpaySubId: null },
        });
      }
      if (status !== "active" || !subscription.pendingPlanId) {
        return { handled: true, subscriptionId: subscription.id, status: subscription.status };
      }
      const oldSubId = subscription.razorpaySubId;
      await this.switchPlan(subscription.id, subscription.pendingPlanId, {
        status: "active",
        razorpaySubId,
        razorpayShortUrl: null,
        pendingPlanId: null,
        pendingRazorpaySubId: null,
        cancelledAt: null,
        ...(currentEnd ? { currentPeriodEnd: currentEnd } : {}),
        ...(paymentId ? { lastRazorpayPaymentId: paymentId } : {}),
      });
      await this.prisma.organization.update({
        where: { id: subscription.organizationId },
        data: { status: "active" },
      });
      if (oldSubId && oldSubId !== razorpaySubId) {
        await this.razorpay.cancelSubscription(oldSubId).catch((err) =>
          this.logger.warn(
            `Could not cancel superseded Razorpay subscription ${oldSubId}: ${
              err instanceof Error ? err.message : err
            }`,
          ),
        );
      }
      return { handled: true, subscriptionId: subscription.id, status: "active" as const };
    }

    // Events for a gateway subscription we've already replaced must not touch the live one.
    if (razorpaySubId && razorpaySubId !== subscription.razorpaySubId) {
      this.logger.warn(
        `Ignoring SaaS webhook ${event} for superseded Razorpay subscription ${razorpaySubId}`,
      );
      return { handled: false };
    }

    const data: {
      status?: SubscriptionStatus;
      currentPeriodEnd?: Date;
      lastRazorpayPaymentId?: string;
      cancelledAt?: Date | null;
    } = {};

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

  private checkoutPayload(input: {
    organizationId: string;
    subscriptionId: string;
    razorpaySubId: string | null;
    shortUrl: string | null;
    status: string;
    org: { name: string; email: string | null; phone: string | null };
  }) {
    return {
      organizationId: input.organizationId,
      subscriptionId: input.subscriptionId,
      razorpaySubId: input.razorpaySubId,
      shortUrl: input.shortUrl,
      status: input.status,
      /** Platform key for Standard Checkout (preferred over hosted short_url). */
      keyId: this.razorpay.keyId() ?? null,
      prefill: {
        name: input.org.name,
        email: input.org.email,
        contact: input.org.phone,
      },
    };
  }

  private async ensureCustomer(org: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    razorpayCustomerId: string | null;
  }) {
    if (org.razorpayCustomerId) {
      const existing = await this.razorpay.fetchCustomer(org.razorpayCustomerId);
      if (existing) return existing.id;
      this.logger.warn(
        `Stored Razorpay customer ${org.razorpayCustomerId} for org ${org.id} is missing; recreating`,
      );
      await this.prisma.organization.update({
        where: { id: org.id },
        data: { razorpayCustomerId: null },
      });
      org = { ...org, razorpayCustomerId: null };
    }

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
    if (input.razorpaySubId) {
      const bySub = await this.prisma.subscription.findFirst({
        where: {
          OR: [
            { razorpaySubId: input.razorpaySubId },
            { pendingRazorpaySubId: input.razorpaySubId },
          ],
        },
      });
      if (bySub) return bySub;
    }
    if (input.id) {
      return this.prisma.subscription.findUnique({ where: { id: input.id } });
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
    // `authenticated` only means the mandate was set up; access starts with an actual charge.
    if (
      event === "subscription.charged" ||
      (event === "subscription.activated" && gatewayStatus !== "authenticated") ||
      gatewayStatus === "active"
    ) {
      return "active";
    }
    return undefined;
  }
}
