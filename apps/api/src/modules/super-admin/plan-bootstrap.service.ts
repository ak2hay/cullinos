import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  PUBLIC_PLAN_CATALOG,
  isContactSalesPlanSlug,
  modulesForPublicPlanSlug,
  type PublicPlanSlug,
} from "@cullinos/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { SaasBillingService } from "../subscriptions/saas-billing.service";

const PUBLIC_SLUGS = Object.keys(PUBLIC_PLAN_CATALOG) as PublicPlanSlug[];

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
    } catch (err) {
      this.logger.error(
        "Plan bootstrap failed — run db:seed manually. API will continue starting.",
        err instanceof Error ? err.message : err,
      );
      return;
    }

    try {
      await this.saas.syncPlansToRazorpay();
    } catch (err) {
      this.logger.warn(
        "Razorpay plan sync failed after entitlement bootstrap — entitlements are still up to date.",
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Upsert all public catalog plans. Updates metadata/pricing/modules for known
   * public slugs on every startup. Never touches private (custom) plan rows.
   */
  private async upsertPlans() {
    let upserted = 0;
    for (const slug of PUBLIC_SLUGS) {
      const catalog = PUBLIC_PLAN_CATALOG[slug];
      const modules = modulesForPublicPlanSlug(slug);

      // Contact-sales rows keep their stored price so existing subscribers can still be billed.
      const syncPrice = !isContactSalesPlanSlug(slug);
      const existing = await this.prisma.plan.findUnique({ where: { slug } });
      const priceChanged =
        syncPrice && existing != null && Number(existing.priceMonthly) !== catalog.priceMonthly;

      const record = await this.prisma.plan.upsert({
        where: { slug },
        update: {
          name: catalog.name,
          description: catalog.description,
          ...(syncPrice
            ? { priceMonthly: catalog.priceMonthly, priceYearly: catalog.priceYearly }
            : {}),
          maxOutlets: catalog.maxOutlets,
          maxTerminals: catalog.maxTerminals,
          maxUsers: catalog.maxUsers,
          sortOrder: catalog.sortOrder,
          visibility: "public",
          isActive: true,
          ...(priceChanged ? { razorpayPlanIdMonthly: null } : {}),
        },
        create: {
          name: catalog.name,
          slug,
          description: catalog.description,
          priceMonthly: catalog.priceMonthly,
          priceYearly: catalog.priceYearly,
          maxOutlets: catalog.maxOutlets,
          maxTerminals: catalog.maxTerminals,
          maxUsers: catalog.maxUsers,
          sortOrder: catalog.sortOrder,
          visibility: "public",
          isActive: true,
        },
      });

      await this.prisma.planFeature.updateMany({
        where: { planId: record.id, module: { notIn: [...modules] } },
        data: { enabled: false },
      });
      for (const module of modules) {
        await this.prisma.planFeature.upsert({
          where: { planId_module: { planId: record.id, module } },
          update: { enabled: true },
          create: { planId: record.id, module, enabled: true },
        });
      }
      upserted++;
    }
    this.logger.log(`Plan bootstrap complete — upserted ${upserted} public plans`);
  }

  /**
   * For every active/trial subscription, insert any missing SubscriptionEntitlement
   * rows that exist on the plan's features but not yet on the subscription, and
   * re-enable rows that were left disabled after plan modules were restored.
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
      const byModule = new Map(sub.entitlements.map((e) => [e.module, e]));
      for (const feature of sub.plan.features) {
        if (!feature.enabled) continue;
        const existing = byModule.get(feature.module);
        if (!existing) {
          await this.prisma.subscriptionEntitlement.create({
            data: {
              subscriptionId: sub.id,
              module: feature.module,
              enabled: feature.enabled,
            },
          });
          synced++;
          continue;
        }
        if (feature.enabled && !existing.enabled) {
          await this.prisma.subscriptionEntitlement.update({
            where: { id: existing.id },
            data: { enabled: true },
          });
          synced++;
        }
      }
    }

    if (synced > 0) {
      this.logger.log(
        `Synced ${synced} subscription entitlement(s) across ${subscriptions.length} subscription(s)`,
      );
    }
  }
}
