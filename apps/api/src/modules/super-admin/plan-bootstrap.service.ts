import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const DEFAULT_PLANS = [
  {
    slug: "starter",
    name: "Starter",
    description: "Single outlet — POS, KDS, Admin, GST billing",
    priceMonthly: 2999,
    priceYearly: 29990,
    maxOutlets: 1,
    maxTerminals: 2,
    modules: ["pos", "kds", "admin", "menu", "orders", "tables", "billing", "tax"],
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
      "analytics",
      "delivery",
    ],
  },
] as const;

@Injectable()
export class PlanBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(PlanBootstrapService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.plan.count();
    if (count > 0) return;

    this.logger.warn("No subscription plans found — seeding default plans");

    for (const plan of DEFAULT_PLANS) {
      const created = await this.prisma.plan.create({
        data: {
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
        await this.prisma.planFeature.create({
          data: { planId: created.id, module, enabled: true },
        });
      }
    }

    this.logger.log(`Seeded ${DEFAULT_PLANS.length} default subscription plans`);
  }
}
