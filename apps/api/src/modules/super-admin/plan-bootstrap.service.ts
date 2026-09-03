import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { SaasBillingService } from "../subscriptions/saas-billing.service";

const DEFAULT_PLANS = [
  {
    slug: "starter",
    name: "Starter",
    description: "Single outlet — POS, KDS, Admin, GST billing",
    priceMonthly: 2999,
    priceYearly: 29990,
    maxOutlets: 1,
    maxTerminals: 2,
    modules: ["pos", "kds", "admin", "menu", "orders", "tables", "billing", "tax", "settings", "reports"],
  },
  {
    slug: "qsr",
    name: "QSR / Food SMB",
    description: "Cafes, food trucks, bakeries — counter POS, QR ordering, pickup queue",
    priceMonthly: 4999,
    priceYearly: 49990,
    maxOutlets: 1,
    maxTerminals: 3,
    modules: [
      "pos",
      "admin",
      "menu",
      "orders",
      "billing",
      "tax",
      "customer",
      "loyalty",
      "events",
      "production",
      "settings",
      "reports",
    ],
  },
  {
    slug: "professional",
    name: "Professional",
    description: "Up to 3 outlets — Waiter, QR, inventory, CRM",
    priceMonthly: 7999,
    priceYearly: 79990,
    maxOutlets: 3,
    maxTerminals: 6,
    modules: [
      "pos",
      "kds",
      "admin",
      "waiter",
      "customer",
      "menu",
      "orders",
      "tables",
      "inventory",
      "crm",
      "loyalty",
      "events",
      "production",
      "settings",
      "reports",
    ],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description: "Multi-outlet chains — Management, franchise, analytics",
    priceMonthly: 19999,
    priceYearly: 199990,
    maxOutlets: 999,
    maxTerminals: 999,
    modules: [
      "pos",
      "kds",
      "admin",
      "waiter",
      "customer",
      "menu",
      "orders",
      "tables",
      "billing",
      "tax",
      "inventory",
      "crm",
      "loyalty",
      "management",
      "franchise",
      "hotel",
      "analytics",
      "delivery",
      "events",
      "production",
      "settings",
      "reports",
    ],
  },
] as const;

@Injectable()
export class PlanBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(PlanBootstrapService.name);

  constructor(
    private prisma: PrismaService,
    private saas: SaasBillingService,
  ) {}

  async onModuleInit() {
    try {
      await this.upsertPlans();
      await this.syncSubscriptionEntitlements();
      await this.saas.syncPlansToRazorpay();
    } catch (err) {
      this.logger.error(
        "Plan bootstrap failed — run db:seed manually. API will continue starting.",
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Upsert all default plans and their features. Safe to run on every startup —
   * uses upsert so it never overwrites custom plan pricing or extra features.
   */
  private async upsertPlans() {
    let created = 0;
    for (const plan of DEFAULT_PLANS) {
      const record = await this.prisma.plan.upsert({
        where: { slug: plan.slug },
        update: {},
        create: {
          name: plan.name,
          slug: plan.slug,
          description: plan.description,
          priceMonthly: plan.priceMonthly,
          priceYearly: plan.priceYearly,
          maxOutlets: plan.maxOutlets,
          maxTerminals: plan.maxTerminals,
        },
      });

      for (const module of plan.modules) {
        await this.prisma.planFeature.upsert({
          where: { planId_module: { planId: record.id, module } },
          update: { enabled: true },
          create: { planId: record.id, module, enabled: true },
        });
      }
      created++;
    }
    this.logger.log(`Plan bootstrap complete — upserted ${created} plans`);
  }

  /**
   * For every active/trial subscription, insert any missing SubscriptionEntitlement
   * rows that exist on the plan's features but not yet on the subscription.
   * This syncs existing tenants after new modules are added to plans without
   * requiring a manual re-provision in Super Admin.
   */
  private async syncSubscriptionEntitlements() {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: { in: ["active", "trial"] } },
      include: {
        plan: { include: { features: true } },
        entitlements: true,
      },
    });

    let synced = 0;
    for (const sub of subscriptions) {
      const existing = new Set(sub.entitlements.map((e) => e.module));
      for (const feature of sub.plan.features) {
        if (!existing.has(feature.module)) {
          await this.prisma.subscriptionEntitlement.create({
            data: {
              subscriptionId: sub.id,
              module: feature.module,
              enabled: feature.enabled,
            },
          });
          synced++;
        }
      }
    }

    if (synced > 0) {
      this.logger.log(`Synced ${synced} missing subscription entitlement(s) across ${subscriptions.length} subscription(s)`);
    }
  }
}
