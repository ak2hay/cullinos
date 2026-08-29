import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const starterPlan = await prisma.plan.upsert({
    where: { slug: "starter" },
    update: {},
    create: {
      name: "Starter",
      slug: "starter",
      description: "Single outlet — POS, KDS, Admin, GST billing",
      priceMonthly: 2999,
      priceYearly: 29990,
      maxOutlets: 1,
      maxTerminals: 2,
      features: {
        create: [
          { module: "pos", enabled: true },
          { module: "kds", enabled: true },
          { module: "admin", enabled: true },
          { module: "menu", enabled: true },
          { module: "orders", enabled: true },
          { module: "billing", enabled: true },
          { module: "tax", enabled: true },
        ],
      },
    },
  });

  const professionalPlan = await prisma.plan.upsert({
    where: { slug: "professional" },
    update: {},
    create: {
      name: "Professional",
      slug: "professional",
      description: "Up to 3 outlets — Waiter, QR, inventory, CRM",
      priceMonthly: 7999,
      priceYearly: 79990,
      maxOutlets: 3,
      maxTerminals: 6,
      features: {
        create: [
          { module: "pos", enabled: true },
          { module: "kds", enabled: true },
          { module: "admin", enabled: true },
          { module: "waiter", enabled: true },
          { module: "customer", enabled: true },
          { module: "inventory", enabled: true },
          { module: "crm", enabled: true },
          { module: "loyalty", enabled: true },
        ],
      },
    },
  });

  const enterprisePlan = await prisma.plan.upsert({
    where: { slug: "enterprise" },
    update: {},
    create: {
      name: "Enterprise",
      slug: "enterprise",
      description: "Multi-outlet chains — Management, franchise, hotel, analytics",
      priceMonthly: 19999,
      priceYearly: 199990,
      maxOutlets: 999,
      maxTerminals: 999,
      features: {
        create: [
          { module: "management", enabled: true },
          { module: "franchise", enabled: true },
          { module: "hotel", enabled: true },
          { module: "analytics", enabled: true },
          { module: "delivery", enabled: true },
        ],
      },
    },
  });

  const paymentMethods = ["cash", "card", "upi", "wallet"];
  for (const code of paymentMethods) {
    await prisma.paymentMethod.upsert({
      where: { code },
      update: {},
      create: { name: code.toUpperCase(), code },
    });
  }

  const org = await prisma.organization.upsert({
    where: { slug: "demo-restaurant" },
    update: {},
    create: {
      name: "Demo Restaurant",
      slug: "demo-restaurant",
      status: "active",
      email: "demo@cullinos.com",
      settings: { create: { settings: {} } },
    },
  });

  const brand = await prisma.brand.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "main" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Main Brand",
      slug: "main",
      isDefault: true,
      settings: { create: { settings: {} } },
    },
  });

  const outlet = await prisma.outlet.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "main-outlet" } },
    update: {},
    create: {
      organizationId: org.id,
      brandId: brand.id,
      name: "Main Outlet",
      slug: "main-outlet",
      isDefault: true,
      settings: { create: { settings: {} } },
    },
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const admin = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: "admin@cullinos.com" } },
    update: {},
    create: {
      organizationId: org.id,
      email: "admin@cullinos.com",
      passwordHash,
      name: "Demo Admin",
      isSuperAdmin: true,
    },
  });

  await prisma.subscription.upsert({
    where: { id: "seed-subscription" },
    update: {},
    create: {
      id: "seed-subscription",
      organizationId: org.id,
      planId: starterPlan.id,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      entitlements: {
        create: starterPlan.id
          ? [
              { module: "pos", enabled: true },
              { module: "kds", enabled: true },
              { module: "admin", enabled: true },
            ]
          : [],
      },
    },
  });

  console.log("Seed complete:", { org: org.slug, admin: admin.email, plans: [starterPlan.slug, professionalPlan.slug, enterprisePlan.slug] });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
