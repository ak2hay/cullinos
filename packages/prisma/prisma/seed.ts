import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const OWNER_PERMISSIONS = [
  "org:read", "org:update", "org:manage_users", "org:manage_settings",
  "outlet:read", "menu:read", "menu:create", "menu:update",
  "order:read", "order:create", "order:update", "order:cancel", "pos:access",
  "table:read", "table:manage", "inventory:read", "inventory:adjust", "inventory:transfer",
  "reports:read", "reports:export", "settings:read", "settings:update",
  "staff:read", "staff:manage",
];

const MANAGER_PERMISSIONS = OWNER_PERMISSIONS;
const WAITER_PERMISSIONS = [
  "menu:read", "order:read", "order:create", "order:update", "table:read", "table:manage", "customer:read",
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: OWNER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  waiter: WAITER_PERMISSIONS,
};

const ALL_MODULES = [
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
];

async function seedPermissions() {
  const permissionStrings = new Set<string>();
  for (const perms of Object.values(ROLE_PERMISSIONS)) {
    for (const p of perms) permissionStrings.add(p);
  }

  for (const perm of permissionStrings) {
    const [module, ...actionParts] = perm.split(":");
    const action = actionParts.join(":");
    await prisma.permission.upsert({
      where: { module_action: { module, action } },
      update: {},
      create: { module, action, description: perm },
    });
  }
}

async function seedPlans() {
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
    },
  });

  const enterprisePlan = await prisma.plan.upsert({
    where: { slug: "enterprise" },
    update: {},
    create: {
      name: "Enterprise",
      slug: "enterprise",
      description: "Multi-outlet chains — Management, franchise, analytics",
      priceMonthly: 19999,
      priceYearly: 199990,
      maxOutlets: 999,
      maxTerminals: 999,
    },
  });

  const qsrPlan = await prisma.plan.upsert({
    where: { slug: "qsr" },
    update: {},
    create: {
      name: "QSR / Food SMB",
      slug: "qsr",
      description: "Cafes, food trucks, bakeries — counter POS, QR ordering, pickup queue",
      priceMonthly: 4999,
      priceYearly: 49990,
      maxOutlets: 1,
      maxTerminals: 3,
    },
  });

  for (const plan of [starterPlan, qsrPlan, professionalPlan, enterprisePlan]) {
    const modules =
      plan.slug === "starter"
        ? ["pos", "kds", "admin", "menu", "orders", "tables", "billing", "tax"]
        : plan.slug === "qsr"
          ? [
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
            ]
          : plan.slug === "professional"
          ? [
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
            ]
          : ALL_MODULES;

    for (const module of modules) {
      await prisma.planFeature.upsert({
        where: { planId_module: { planId: plan.id, module } },
        update: { enabled: true },
        create: { planId: plan.id, module, enabled: true },
      });
    }
  }

  return { starterPlan, qsrPlan, professionalPlan, enterprisePlan };
}

async function assignRolePermissions(orgId: string, roleSlug: string, permStrings: string[]) {
  const role = await prisma.role.findFirst({
    where: { organizationId: orgId, slug: roleSlug.toLowerCase() },
  });
  if (!role) return;

  for (const perm of permStrings) {
    const [module, ...actionParts] = perm.split(":");
    const action = actionParts.join(":");
    const permission = await prisma.permission.findUnique({
      where: { module_action: { module, action } },
    });
    if (!permission) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }
}

async function main() {
  await seedPermissions();
  const { enterprisePlan } = await seedPlans();

  for (const code of ["cash", "card", "upi", "wallet"]) {
    await prisma.paymentMethod.upsert({
      where: { code },
      update: {},
      create: { name: code.toUpperCase(), code },
    });
  }

  const org = await prisma.organization.upsert({
    where: { slug: "demo-restaurant" },
    update: { status: "active", businessType: "restaurant" },
    create: {
      name: "Demo Restaurant",
      slug: "demo-restaurant",
      businessType: "restaurant",
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

  const outlet1 = await prisma.outlet.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "main-outlet" } },
    update: { operatingMode: "full_service" },
    create: {
      organizationId: org.id,
      brandId: brand.id,
      name: "Main Outlet",
      slug: "main-outlet",
      operatingMode: "full_service",
      city: "Mumbai",
      isDefault: true,
      settings: { create: { settings: {} } },
    },
  });

  const outlet2 = await prisma.outlet.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "bandra-outlet" } },
    update: {},
    create: {
      organizationId: org.id,
      brandId: brand.id,
      name: "Bandra Outlet",
      slug: "bandra-outlet",
      city: "Mumbai",
      settings: { create: { settings: {} } },
    },
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const platformOrg = await prisma.organization.upsert({
    where: { slug: "rkyves-platform" },
    update: {},
    create: {
      name: "Rkyves Platform",
      slug: "rkyves-platform",
      status: "active",
      email: "ops@rkyves.com",
      settings: { create: { settings: {} } },
    },
  });

  await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: platformOrg.id,
        email: "superadmin@cullinos.com",
      },
    },
    update: { passwordHash, isSuperAdmin: true },
    create: {
      organizationId: platformOrg.id,
      email: "superadmin@cullinos.com",
      passwordHash,
      name: "Platform Super Admin",
      isSuperAdmin: true,
    },
  });

  const productionAdminHash = await bcrypt.hash("superadmin123", 10);
  await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: platformOrg.id,
        email: "admin@rkyves.com",
      },
    },
    update: { passwordHash: productionAdminHash, isSuperAdmin: true },
    create: {
      organizationId: platformOrg.id,
      email: "admin@rkyves.com",
      passwordHash: productionAdminHash,
      name: "Rkyves Admin",
      isSuperAdmin: true,
    },
  });

  const owner = await prisma.user.upsert({
    where: {
      organizationId_email: { organizationId: org.id, email: "owner@cullinos.com" },
    },
    update: { passwordHash, isSuperAdmin: false },
    create: {
      organizationId: org.id,
      email: "owner@cullinos.com",
      passwordHash,
      name: "Demo Owner",
      isSuperAdmin: false,
    },
  });

  for (const [slug, name] of [
    ["owner", "Owner"],
    ["manager", "Manager"],
    ["waiter", "Waiter"],
  ] as const) {
    await prisma.role.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug } },
      update: { name },
      create: {
        organizationId: org.id,
        slug,
        name,
        isSystem: true,
      },
    });
  }

  await assignRolePermissions(org.id, "owner", ROLE_PERMISSIONS.owner);
  await assignRolePermissions(org.id, "manager", ROLE_PERMISSIONS.manager);
  await assignRolePermissions(org.id, "waiter", ROLE_PERMISSIONS.waiter);

  const ownerRole = await prisma.role.findFirst({
    where: { organizationId: org.id, slug: "owner" },
  });

  if (ownerRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: owner.id, roleId: ownerRole.id },
    });
  }

  for (const outlet of [outlet1, outlet2]) {
    await prisma.outletUser.upsert({
      where: { userId_outletId: { userId: owner.id, outletId: outlet.id } },
      update: {},
      create: { userId: owner.id, outletId: outlet.id },
    });
  }

  await prisma.subscription.upsert({
    where: { id: "seed-subscription" },
    update: {
      planId: enterprisePlan.id,
      status: "active",
    },
    create: {
      id: "seed-subscription",
      organizationId: org.id,
      planId: enterprisePlan.id,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const subscription = await prisma.subscription.findUnique({
    where: { id: "seed-subscription" },
  });
  if (subscription) {
    await prisma.subscriptionEntitlement.deleteMany({
      where: { subscriptionId: subscription.id },
    });
    const features = await prisma.planFeature.findMany({
      where: { planId: enterprisePlan.id },
    });
    for (const f of features) {
      await prisma.subscriptionEntitlement.create({
        data: {
          subscriptionId: subscription.id,
          module: f.module,
          enabled: f.enabled,
        },
      });
    }
  }

  const category = await prisma.menuCategory.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "mains" } },
    update: {},
    create: {
      organizationId: org.id,
      name: "Mains",
      slug: "mains",
      sortOrder: 1,
    },
  });

  const menuItem = await prisma.menuItem.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: "margherita-pizza" } },
    update: {},
    create: {
      organizationId: org.id,
      categoryId: category.id,
      name: "Margherita Pizza",
      slug: "margherita-pizza",
      description: "Classic tomato and mozzarella",
      basePrice: 299,
      isVeg: true,
    },
  });

  for (const outlet of [outlet1, outlet2]) {
    await prisma.outletMenuPrice.upsert({
      where: {
        outletId_menuItemId_priceType: {
          outletId: outlet.id,
          menuItemId: menuItem.id,
          priceType: "retail",
        },
      },
      update: { price: 299, isAvailable: true },
      create: {
        outletId: outlet.id,
        menuItemId: menuItem.id,
        price: 299,
        priceType: "retail",
        isAvailable: true,
      },
    });
  }

  const floor = await prisma.floor.upsert({
    where: { id: "seed-floor-main" },
    update: {},
    create: {
      id: "seed-floor-main",
      outletId: outlet1.id,
      name: "Ground Floor",
    },
  });

  const section = await prisma.section.upsert({
    where: { id: "seed-section-main" },
    update: {},
    create: {
      id: "seed-section-main",
      floorId: floor.id,
      name: "Dining",
    },
  });

  for (let i = 1; i <= 6; i++) {
    await prisma.table.upsert({
      where: { id: `seed-table-${i}` },
      update: {},
      create: {
        id: `seed-table-${i}`,
        sectionId: section.id,
        name: `T${i}`,
        capacity: 4,
        qrCode: `qr-table-${i}`,
        status: i <= 2 ? "occupied" : "available",
      },
    });
  }

  const inventoryItem = await prisma.inventoryItem.upsert({
    where: { id: "seed-inv-mozzarella" },
    update: {},
    create: {
      id: "seed-inv-mozzarella",
      organizationId: org.id,
      outletId: outlet1.id,
      name: "Mozzarella",
      sku: "MOZ-001",
      unit: "kg",
      currentStock: 50,
    },
  });

  await prisma.inventoryItem.upsert({
    where: { id: "seed-inv-mozzarella-bandra" },
    update: {},
    create: {
      id: "seed-inv-mozzarella-bandra",
      organizationId: org.id,
      outletId: outlet2.id,
      name: "Mozzarella",
      sku: "MOZ-001",
      unit: "kg",
      currentStock: 20,
    },
  });

  await prisma.franchiseAgreement.upsert({
    where: { id: "seed-franchise-1" },
    update: {},
    create: {
      id: "seed-franchise-1",
      organizationId: org.id,
      franchiseeName: "Bandra Franchise Partner",
      startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      outlets: {
        create: [{ outletId: outlet2.id }],
      },
    },
  });

  const foodBusinessDemos: Array<{
    slug: string;
    name: string;
    businessType: "cafe" | "food_truck" | "bakery";
    operatingMode: "counter" | "hybrid";
    categories: string[];
  }> = [
    {
      slug: "demo-cafe",
      name: "Demo Cafe",
      businessType: "cafe",
      operatingMode: "counter",
      categories: ["Coffee", "Tea", "Pastries"],
    },
    {
      slug: "demo-food-truck",
      name: "Demo Food Truck",
      businessType: "food_truck",
      operatingMode: "counter",
      categories: ["Mains", "Sides", "Drinks"],
    },
    {
      slug: "demo-bakery",
      name: "Demo Bakery",
      businessType: "bakery",
      operatingMode: "hybrid",
      categories: ["Breads", "Pastries", "Cakes"],
    },
  ];

  for (const demo of foodBusinessDemos) {
    const demoOrg = await prisma.organization.upsert({
      where: { slug: demo.slug },
      update: { businessType: demo.businessType },
      create: {
        name: demo.name,
        slug: demo.slug,
        businessType: demo.businessType,
        status: "active",
        email: `${demo.slug}@cullinos.com`,
        settings: { create: { settings: { businessType: demo.businessType } } },
      },
    });

    const demoBrand = await prisma.brand.upsert({
      where: { organizationId_slug: { organizationId: demoOrg.id, slug: "main" } },
      update: {},
      create: {
        organizationId: demoOrg.id,
        name: "Main Brand",
        slug: "main",
        isDefault: true,
        settings: { create: { settings: {} } },
      },
    });

    const demoOutlet = await prisma.outlet.upsert({
      where: { organizationId_slug: { organizationId: demoOrg.id, slug: "main" } },
      update: { operatingMode: demo.operatingMode },
      create: {
        organizationId: demoOrg.id,
        brandId: demoBrand.id,
        name: `${demo.name} Outlet`,
        slug: "main",
        operatingMode: demo.operatingMode,
        city: "Mumbai",
        isDefault: true,
        settings: {
          create: {
            settings: {
              operatingMode: demo.operatingMode,
              enabledOrderTypes: ["takeaway", "qr", "online"],
            },
          },
        },
      },
    });

    for (const [idx, catName] of demo.categories.entries()) {
      const catSlug = catName.toLowerCase().replace(/\s+/g, "-");
      await prisma.menuCategory.upsert({
        where: { organizationId_slug: { organizationId: demoOrg.id, slug: catSlug } },
        update: {},
        create: {
          organizationId: demoOrg.id,
          name: catName,
          slug: catSlug,
          sortOrder: idx + 1,
        },
      });
    }

    if (demo.businessType === "food_truck") {
      await prisma.outletEvent.upsert({
        where: { id: `seed-event-${demo.slug}` },
        update: {},
        create: {
          id: `seed-event-${demo.slug}`,
          organizationId: demoOrg.id,
          outletId: demoOutlet.id,
          name: "Weekend Market",
          location: "Bandra Kurla Complex",
          address: "BKC, Mumbai",
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          startTime: "11:00",
          endTime: "15:00",
          preOrderOpensAt: new Date(),
          preOrderClosesAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
          maxPreOrders: 50,
        },
      });
    }

    if (demo.businessType === "bakery") {
      await prisma.productionBatch.upsert({
        where: { id: `seed-batch-${demo.slug}` },
        update: {},
        create: {
          id: `seed-batch-${demo.slug}`,
          organizationId: demoOrg.id,
          outletId: demoOutlet.id,
          name: "Morning Sourdough",
          plannedQty: 24,
          scaleFactor: 1,
          status: "planned",
          batchNumber: "BATCH-001",
          scheduledFor: new Date(Date.now() + 12 * 60 * 60 * 1000),
        },
      });
    }
  }

  await prisma.loyaltyTier.upsert({
    where: { id: "seed-loyalty-stamp" },
    update: {},
    create: {
      id: "seed-loyalty-stamp",
      organizationId: org.id,
      name: "Stamp Card",
      minPoints: 0,
      multiplier: 1,
    },
  });

  await prisma.coupon.upsert({
    where: { organizationId_code: { organizationId: org.id, code: "WELCOME10" } },
    update: { isActive: true },
    create: {
      organizationId: org.id,
      code: "WELCOME10",
      type: "percent",
      value: 10,
      minOrder: 200,
      isActive: true,
    },
  });

  console.log("Seed complete:", {
    org: org.slug,
    owner: owner.email,
    superAdmin: "superadmin@cullinos.com",
    password: "demo1234",
    outlets: [outlet1.slug, outlet2.slug],
    storefront: `/demo-restaurant/main-outlet`,
    note: "Create waiter/cashier accounts in Admin → Staff",
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
