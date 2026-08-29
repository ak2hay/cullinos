import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, PLAN_FEATURES } from '@cullinos/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Cullinos database...');

  // Seed permissions
  const permissionEntries = Object.entries(PERMISSIONS).map(([key, permKey]) => ({
    key: permKey,
    description: key.replace(/_/g, ' '),
    module: permKey.split(':')[0],
  }));

  for (const perm of permissionEntries) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {},
      create: perm,
    });
  }

  // Seed plans
  const plans = [
    {
      key: 'STARTER',
      name: 'Starter',
      description: 'POS, Billing, KOT, Basic reports',
      priceMonthly: 99900,
      priceYearly: 999900,
      maxOutlets: 1,
      maxUsers: 5,
      maxTerminals: 2,
      features: PLAN_FEATURES.STARTER,
    },
    {
      key: 'PROFESSIONAL',
      name: 'Professional',
      description: 'Full restaurant operations',
      priceMonthly: 299900,
      priceYearly: 2999900,
      maxOutlets: 3,
      maxUsers: 20,
      maxTerminals: 10,
      features: PLAN_FEATURES.PROFESSIONAL,
    },
    {
      key: 'ENTERPRISE',
      name: 'Enterprise',
      description: 'Multi-outlet and franchise',
      priceMonthly: 999900,
      priceYearly: 9999900,
      maxOutlets: 50,
      maxUsers: 200,
      maxTerminals: 100,
      features: PLAN_FEATURES.ENTERPRISE,
    },
    {
      key: 'HOSPITALITY',
      name: 'Hospitality',
      description: 'Hotel and resort restaurants',
      priceMonthly: 1499900,
      priceYearly: 14999900,
      maxOutlets: 100,
      maxUsers: 500,
      maxTerminals: 200,
      features: PLAN_FEATURES.HOSPITALITY,
    },
  ];

  for (const plan of plans) {
    const created = await prisma.plan.upsert({
      where: { key: plan.key },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        maxOutlets: plan.maxOutlets,
        maxUsers: plan.maxUsers,
        maxTerminals: plan.maxTerminals,
      },
      create: {
        key: plan.key,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        maxOutlets: plan.maxOutlets,
        maxUsers: plan.maxUsers,
        maxTerminals: plan.maxTerminals,
      },
    });

    for (const featureKey of plan.features) {
      await prisma.planFeature.upsert({
        where: { planId_featureKey: { planId: created.id, featureKey } },
        update: {},
        create: { planId: created.id, featureKey },
      });
    }
  }

  // Seed super admin
  const superAdminPassword = await bcrypt.hash('superadmin123', 12);
  await prisma.superAdmin.upsert({
    where: { email: 'admin@rkyves.com' },
    update: {},
    create: {
      email: 'admin@rkyves.com',
      passwordHash: superAdminPassword,
      name: 'Rkyves Admin',
    },
  });

  // Seed unit conversions
  const conversions = [
    { fromUnit: 'KG', toUnit: 'GRAM', factor: 1000 },
    { fromUnit: 'LITRE', toUnit: 'ML', factor: 1000 },
    { fromUnit: 'BOX', toUnit: 'PIECE', factor: 1 },
  ];

  for (const conv of conversions) {
    await prisma.unitConversion.upsert({
      where: { fromUnit_toUnit: { fromUnit: conv.fromUnit, toUnit: conv.toUnit } },
      update: { factor: conv.factor },
      create: conv,
    });
  }

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
