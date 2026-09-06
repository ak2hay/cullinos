import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const OWNER_PERMISSIONS = [
  "org:read", "org:update", "org:manage_users", "org:manage_settings",
  "outlet:read", "menu:read", "menu:create", "menu:update",
  "order:read", "order:create", "order:update", "order:cancel", "pos:access",
  "table:read", "table:manage", "inventory:read", "inventory:adjust", "inventory:transfer",
  "reports:read", "reports:export", "settings:read", "settings:update",
  "staff:read", "staff:manage", "customer:read", "customer:manage",
];

const MANAGER_PERMISSIONS = OWNER_PERMISSIONS;

const WAITER_PERMISSIONS = [
  "menu:read", "order:read", "order:create", "order:update",
  "table:read", "table:manage", "customer:read",
];

const CASHIER_PERMISSIONS = [
  "menu:read", "order:read", "order:create", "order:update", "pos:access",
  "customer:read", "reports:read",
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: OWNER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  waiter: WAITER_PERMISSIONS,
  cashier: CASHIER_PERMISSIONS,
};

const ALL_MODULES = [
  "pos", "kds", "admin", "waiter", "customer", "menu", "orders", "tables",
  "billing", "tax", "inventory", "crm", "loyalty", "management", "franchise",
  "hotel", "analytics", "delivery", "settings", "reports", "events", "production",
];

type MenuItemDef = {
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  isVeg: boolean;
  allergens?: string[];
  variants?: Array<{ id: string; name: string; price: number; isDefault?: boolean; sortOrder: number }>;
  modifierGroupIds?: string[];
};

type CategoryDef = {
  slug: string;
  name: string;
  sortOrder: number;
  items: MenuItemDef[];
};

const RESTAURANT_MENU: CategoryDef[] = [
  {
    slug: "starters",
    name: "Starters",
    sortOrder: 1,
    items: [
      {
        slug: "paneer-tikka",
        name: "Paneer Tikka",
        description: "Cottage cheese marinated in tandoori spices",
        basePrice: 249,
        isVeg: true,
        allergens: ["dairy"],
        modifierGroupIds: ["seed-modgroup-spice"],
      },
      {
        slug: "chicken-wings",
        name: "Chicken Wings",
        description: "Crispy wings with house sauce",
        basePrice: 299,
        isVeg: false,
        modifierGroupIds: ["seed-modgroup-spice", "seed-modgroup-cooking"],
      },
      {
        slug: "veg-spring-roll",
        name: "Veg Spring Roll",
        description: "Crispy rolls with mixed vegetables",
        basePrice: 179,
        isVeg: true,
      },
    ],
  },
  {
    slug: "main-course",
    name: "Main Course",
    sortOrder: 2,
    items: [
      {
        slug: "butter-chicken",
        name: "Butter Chicken",
        description: "Creamy tomato gravy with tender chicken",
        basePrice: 389,
        isVeg: false,
        allergens: ["dairy"],
        modifierGroupIds: ["seed-modgroup-spice"],
      },
      {
        slug: "dal-makhani",
        name: "Dal Makhani",
        description: "Slow-cooked black lentils with butter",
        basePrice: 279,
        isVeg: true,
        allergens: ["dairy"],
        modifierGroupIds: ["seed-modgroup-spice"],
      },
      {
        slug: "margherita-pizza",
        name: "Margherita Pizza",
        description: "Classic tomato and mozzarella",
        basePrice: 299,
        isVeg: true,
        allergens: ["dairy", "gluten"],
        variants: [
          { id: "seed-var-pizza-regular", name: "Regular", price: 299, isDefault: true, sortOrder: 1 },
          { id: "seed-var-pizza-medium", name: "Medium", price: 399, sortOrder: 2 },
          { id: "seed-var-pizza-large", name: "Large", price: 499, sortOrder: 3 },
        ],
        modifierGroupIds: ["seed-modgroup-toppings"],
      },
      {
        slug: "veg-biryani",
        name: "Veg Biryani",
        description: "Fragrant basmati rice with mixed vegetables",
        basePrice: 259,
        isVeg: true,
        modifierGroupIds: ["seed-modgroup-spice"],
      },
    ],
  },
  {
    slug: "breads",
    name: "Breads",
    sortOrder: 3,
    items: [
      {
        slug: "butter-naan",
        name: "Butter Naan",
        description: "Soft tandoor-baked naan with butter",
        basePrice: 69,
        isVeg: true,
        allergens: ["dairy", "gluten"],
      },
      {
        slug: "garlic-naan",
        name: "Garlic Naan",
        description: "Naan topped with garlic and coriander",
        basePrice: 89,
        isVeg: true,
        allergens: ["dairy", "gluten"],
      },
      {
        slug: "roti",
        name: "Roti",
        description: "Whole wheat tawa roti",
        basePrice: 35,
        isVeg: true,
        allergens: ["gluten"],
      },
    ],
  },
  {
    slug: "beverages",
    name: "Beverages",
    sortOrder: 4,
    items: [
      {
        slug: "masala-chai",
        name: "Masala Chai",
        description: "Spiced Indian tea with milk",
        basePrice: 49,
        isVeg: true,
        allergens: ["dairy"],
      },
      {
        slug: "fresh-lime-soda",
        name: "Fresh Lime Soda",
        description: "Sweet or salted lime soda",
        basePrice: 79,
        isVeg: true,
      },
      {
        slug: "cold-coffee",
        name: "Cold Coffee",
        description: "Blended iced coffee with cream",
        basePrice: 129,
        isVeg: true,
        allergens: ["dairy"],
      },
    ],
  },
  {
    slug: "desserts",
    name: "Desserts",
    sortOrder: 5,
    items: [
      {
        slug: "gulab-jamun",
        name: "Gulab Jamun",
        description: "Warm milk dumplings in sugar syrup (2 pcs)",
        basePrice: 99,
        isVeg: true,
        allergens: ["dairy"],
      },
      {
        slug: "brownie",
        name: "Brownie",
        description: "Chocolate brownie with chocolate sauce",
        basePrice: 149,
        isVeg: true,
        allergens: ["dairy", "gluten", "eggs"],
      },
    ],
  },
];

const SMB_MENUS: Record<
  string,
  Array<{ category: string; items: Array<{ slug: string; name: string; price: number; isVeg?: boolean }> }>
> = {
  cafe: [
    {
      category: "Coffee",
      items: [
        { slug: "espresso", name: "Espresso", price: 120, isVeg: true },
        { slug: "cappuccino", name: "Cappuccino", price: 180, isVeg: true },
        { slug: "latte", name: "Cafe Latte", price: 200, isVeg: true },
      ],
    },
    {
      category: "Tea",
      items: [
        { slug: "green-tea", name: "Green Tea", price: 100, isVeg: true },
        { slug: "chai-latte", name: "Chai Latte", price: 160, isVeg: true },
      ],
    },
    {
      category: "Pastries",
      items: [
        { slug: "croissant", name: "Butter Croissant", price: 140, isVeg: true },
        { slug: "muffin", name: "Blueberry Muffin", price: 130, isVeg: true },
      ],
    },
    {
      category: "Sandwiches",
      items: [
        { slug: "veg-club", name: "Veg Club Sandwich", price: 220, isVeg: true },
        { slug: "chicken-panini", name: "Chicken Panini", price: 260, isVeg: false },
      ],
    },
    {
      category: "Cold Drinks",
      items: [
        { slug: "iced-americano", name: "Iced Americano", price: 170, isVeg: true },
        { slug: "lemonade", name: "Fresh Lemonade", price: 110, isVeg: true },
      ],
    },
  ],
  food_truck: [
    {
      category: "Mains",
      items: [
        { slug: "loaded-burrito", name: "Loaded Burrito", price: 249, isVeg: false },
        { slug: "veg-taco", name: "Veg Soft Taco", price: 129, isVeg: true },
      ],
    },
    {
      category: "Sides",
      items: [
        { slug: "nachos", name: "Cheese Nachos", price: 149, isVeg: true },
        { slug: "fries", name: "Street Fries", price: 99, isVeg: true },
      ],
    },
    {
      category: "Drinks",
      items: [
        { slug: "agua-fresca", name: "Agua Fresca", price: 89, isVeg: true },
        { slug: "cola", name: "Cola", price: 49, isVeg: true },
      ],
    },
    {
      category: "Combos",
      items: [
        { slug: "taco-combo", name: "Taco Combo", price: 299, isVeg: false },
        { slug: "burrito-meal", name: "Burrito Meal", price: 349, isVeg: false },
      ],
    },
  ],
  bakery: [
    {
      category: "Breads",
      items: [
        { slug: "sourdough", name: "Sourdough Loaf", price: 180, isVeg: true },
        { slug: "multigrain", name: "Multigrain Bread", price: 160, isVeg: true },
      ],
    },
    {
      category: "Pastries",
      items: [
        { slug: "danish", name: "Fruit Danish", price: 120, isVeg: true },
        { slug: "pain-au-chocolat", name: "Pain au Chocolat", price: 140, isVeg: true },
      ],
    },
    {
      category: "Cakes",
      items: [
        { slug: "chocolate-slice", name: "Chocolate Cake Slice", price: 200, isVeg: true },
        { slug: "red-velvet-slice", name: "Red Velvet Slice", price: 220, isVeg: true },
      ],
    },
    {
      category: "Cookies",
      items: [
        { slug: "choc-chip", name: "Chocolate Chip Cookie", price: 60, isVeg: true },
        { slug: "oatmeal", name: "Oatmeal Cookie", price: 55, isVeg: true },
      ],
    },
    {
      category: "Savouries",
      items: [
        { slug: "cheese-puff", name: "Cheese Puff", price: 90, isVeg: true },
        { slug: "veg-puff", name: "Veg Puff", price: 70, isVeg: true },
      ],
    },
  ],
};

async function seedPermissions() {
  const permissionStrings = new Set<string>();
  for (const perms of Object.values(ROLE_PERMISSIONS)) {
    for (const p of perms) permissionStrings.add(p);
  }

  for (const perm of permissionStrings) {
    const [module, ...actionParts] = perm.split(":");
    const action = actionParts.join(":");
    const existing = await prisma.permission.findFirst({
      where: { module, action },
    });
    if (!existing) {
      await prisma.permission.create({
        data: { module, action, description: perm },
      });
    }
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
        ? ["pos", "kds", "admin", "menu", "orders", "tables", "billing", "tax", "settings", "reports", "analytics"]
        : plan.slug === "qsr"
          ? [
              "pos", "kds", "admin", "menu", "orders", "tables", "billing", "tax", "customer",
              "loyalty", "inventory", "events", "production", "settings", "reports", "analytics",
            ]
          : plan.slug === "professional"
            ? [
                "pos", "kds", "admin", "waiter", "customer", "menu", "orders", "tables",
                "billing", "tax", "inventory", "crm", "loyalty", "delivery", "events",
                "production", "settings", "reports", "analytics",
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

async function markSetupCompleted(orgId: string) {
  const existing = await prisma.organizationSettings.findUnique({
    where: { organizationId: orgId },
  });
  const prev =
    existing?.settings && typeof existing.settings === "object" && !Array.isArray(existing.settings)
      ? (existing.settings as Record<string, unknown>)
      : {};
  await prisma.organizationSettings.upsert({
    where: { organizationId: orgId },
    update: { settings: { ...prev, setupCompleted: true } as never },
    create: { organizationId: orgId, settings: { setupCompleted: true } as never },
  });
}

async function assignRolePermissions(orgId: string, roleSlug: string, permStrings: string[]) {
  const role = await prisma.role.findFirst({
    where: { organizationId: orgId, slug: roleSlug.toLowerCase() },
  });
  if (!role) return;

  for (const perm of permStrings) {
    const [module, ...actionParts] = perm.split(":");
    const action = actionParts.join(":");
    const permission = await prisma.permission.findFirst({
      where: { module, action },
    });
    if (!permission) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }
}

async function ensureRoles(orgId: string, roleSlugs: Array<[string, string]>) {
  for (const [slug, name] of roleSlugs) {
    await prisma.role.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug } },
      update: { name },
      create: { organizationId: orgId, slug, name, isSystem: true },
    });
    const perms = ROLE_PERMISSIONS[slug];
    if (perms) await assignRolePermissions(orgId, slug, perms);
  }
}

async function upsertStaffUser(opts: {
  orgId: string;
  email: string;
  name: string;
  passwordHash: string;
  roleSlug: string;
  outletIds: string[];
}) {
  const user = await prisma.user.upsert({
    where: {
      organizationId_email: { organizationId: opts.orgId, email: opts.email },
    },
    update: { passwordHash: opts.passwordHash, name: opts.name, isSuperAdmin: false },
    create: {
      organizationId: opts.orgId,
      email: opts.email,
      passwordHash: opts.passwordHash,
      name: opts.name,
      isSuperAdmin: false,
    },
  });

  const role = await prisma.role.findFirst({
    where: { organizationId: opts.orgId, slug: opts.roleSlug },
  });
  if (role) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }

  for (const outletId of opts.outletIds) {
    await prisma.outletUser.upsert({
      where: { userId_outletId: { userId: user.id, outletId } },
      update: {},
      create: { userId: user.id, outletId },
    });
  }

  return user;
}

async function assignSubscriptionEntitlements(subscriptionId: string, planId: string) {
  await prisma.subscriptionEntitlement.deleteMany({ where: { subscriptionId } });
  const features = await prisma.planFeature.findMany({ where: { planId } });
  for (const f of features) {
    await prisma.subscriptionEntitlement.create({
      data: { subscriptionId, module: f.module, enabled: f.enabled },
    });
  }
}

async function seedTax(orgId: string) {
  const taxGroup = await prisma.taxGroup.upsert({
    where: { id: "seed-tax-gst5" },
    update: { name: "GST 5%", isInclusive: false },
    create: {
      id: "seed-tax-gst5",
      organizationId: orgId,
      name: "GST 5%",
      isInclusive: false,
    },
  });

  await prisma.taxRate.upsert({
    where: { id: "seed-tax-cgst" },
    update: { rate: 2.5 },
    create: {
      id: "seed-tax-cgst",
      taxGroupId: taxGroup.id,
      name: "CGST",
      rate: 2.5,
      type: "percentage",
    },
  });

  await prisma.taxRate.upsert({
    where: { id: "seed-tax-sgst" },
    update: { rate: 2.5 },
    create: {
      id: "seed-tax-sgst",
      taxGroupId: taxGroup.id,
      name: "SGST",
      rate: 2.5,
      type: "percentage",
    },
  });

  return taxGroup;
}

async function seedModifiers(orgId: string) {
  const spice = await prisma.modifierGroup.upsert({
    where: { id: "seed-modgroup-spice" },
    update: { name: "Spice Level" },
    create: {
      id: "seed-modgroup-spice",
      organizationId: orgId,
      name: "Spice Level",
      minSelect: 0,
      maxSelect: 1,
      isRequired: false,
    },
  });

  for (const [id, name, sortOrder, isDefault] of [
    ["seed-mod-mild", "Mild", 1, true],
    ["seed-mod-medium", "Medium", 2, false],
    ["seed-mod-hot", "Hot", 3, false],
  ] as const) {
    await prisma.modifier.upsert({
      where: { id },
      update: { name, sortOrder, isDefault },
      create: {
        id,
        modifierGroupId: spice.id,
        name,
        price: 0,
        isDefault,
        sortOrder,
      },
    });
  }

  const toppings = await prisma.modifierGroup.upsert({
    where: { id: "seed-modgroup-toppings" },
    update: { name: "Extra Toppings" },
    create: {
      id: "seed-modgroup-toppings",
      organizationId: orgId,
      name: "Extra Toppings",
      minSelect: 0,
      maxSelect: 5,
      isRequired: false,
    },
  });

  for (const [id, name, price, sortOrder] of [
    ["seed-mod-extra-cheese", "Extra Cheese", 40, 1],
    ["seed-mod-olives", "Olives", 30, 2],
    ["seed-mod-jalapeno", "Jalapeño", 25, 3],
  ] as const) {
    await prisma.modifier.upsert({
      where: { id },
      update: { name, price },
      create: {
        id,
        modifierGroupId: toppings.id,
        name,
        price,
        sortOrder,
      },
    });
  }

  const cooking = await prisma.modifierGroup.upsert({
    where: { id: "seed-modgroup-cooking" },
    update: { name: "Cooking Preference" },
    create: {
      id: "seed-modgroup-cooking",
      organizationId: orgId,
      name: "Cooking Preference",
      minSelect: 0,
      maxSelect: 1,
      isRequired: false,
    },
  });

  for (const [id, name, sortOrder, isDefault] of [
    ["seed-mod-regular-cook", "Regular", 1, true],
    ["seed-mod-extra-crispy", "Extra Crispy", 2, false],
  ] as const) {
    await prisma.modifier.upsert({
      where: { id },
      update: { name, sortOrder, isDefault },
      create: {
        id,
        modifierGroupId: cooking.id,
        name,
        price: name === "Extra Crispy" ? 20 : 0,
        isDefault,
        sortOrder,
      },
    });
  }

  return { spice, toppings, cooking };
}

async function seedMenuCatalog(
  orgId: string,
  outletIds: string[],
  taxGroupId: string,
) {
  await seedModifiers(orgId);

  const itemBySlug = new Map<string, { id: string; basePrice: number; name: string }>();

  for (const cat of RESTAURANT_MENU) {
    const category = await prisma.menuCategory.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug: cat.slug } },
      update: { name: cat.name, sortOrder: cat.sortOrder, isActive: true },
      create: {
        organizationId: orgId,
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    });

    for (const [idx, item] of cat.items.entries()) {
      const menuItem = await prisma.menuItem.upsert({
        where: { organizationId_slug: { organizationId: orgId, slug: item.slug } },
        update: {
          name: item.name,
          description: item.description,
          basePrice: item.basePrice,
          isVeg: item.isVeg,
          allergens: item.allergens ?? [],
          categoryId: category.id,
          taxGroupId,
          isActive: true,
          sortOrder: idx + 1,
        },
        create: {
          organizationId: orgId,
          categoryId: category.id,
          name: item.name,
          slug: item.slug,
          description: item.description,
          basePrice: item.basePrice,
          isVeg: item.isVeg,
          allergens: item.allergens ?? [],
          taxGroupId,
          sortOrder: idx + 1,
        },
      });

      itemBySlug.set(item.slug, {
        id: menuItem.id,
        basePrice: item.basePrice,
        name: item.name,
      });

      if (item.variants) {
        for (const v of item.variants) {
          await prisma.menuItemVariant.upsert({
            where: { id: v.id },
            update: {
              name: v.name,
              price: v.price,
              isDefault: v.isDefault ?? false,
              sortOrder: v.sortOrder,
            },
            create: {
              id: v.id,
              menuItemId: menuItem.id,
              name: v.name,
              price: v.price,
              isDefault: v.isDefault ?? false,
              sortOrder: v.sortOrder,
            },
          });
        }
      }

      for (const groupId of item.modifierGroupIds ?? []) {
        await prisma.menuItemModifierGroup.upsert({
          where: {
            menuItemId_modifierGroupId: {
              menuItemId: menuItem.id,
              modifierGroupId: groupId,
            },
          },
          update: {},
          create: { menuItemId: menuItem.id, modifierGroupId: groupId },
        });
      }

      for (const outletId of outletIds) {
        await prisma.outletMenuPrice.upsert({
          where: {
            outletId_menuItemId_priceType: {
              outletId,
              menuItemId: menuItem.id,
              priceType: "retail",
            },
          },
          update: { price: item.basePrice, isAvailable: true },
          create: {
            outletId,
            menuItemId: menuItem.id,
            price: item.basePrice,
            priceType: "retail",
            isAvailable: true,
          },
        });
      }
    }
  }

  // Remove obsolete thin-seed category "mains" if it exists with no remaining use
  const legacyMains = await prisma.menuCategory.findUnique({
    where: { organizationId_slug: { organizationId: orgId, slug: "mains" } },
    include: { menuItems: true },
  });
  if (legacyMains && legacyMains.menuItems.length === 0) {
    await prisma.menuCategory.delete({ where: { id: legacyMains.id } });
  }

  const dal = itemBySlug.get("dal-makhani");
  const roti = itemBySlug.get("roti");
  const chai = itemBySlug.get("masala-chai");

  if (dal && roti && chai) {
    const combo = await prisma.combo.upsert({
      where: { id: "seed-combo-lunch-thali" },
      update: { name: "Lunch Thali", price: 349, isActive: true },
      create: {
        id: "seed-combo-lunch-thali",
        organizationId: orgId,
        name: "Lunch Thali",
        price: 349,
        isActive: true,
      },
    });

    for (const [id, menuItemId, quantity] of [
      ["seed-combo-item-dal", dal.id, 1],
      ["seed-combo-item-roti", roti.id, 2],
      ["seed-combo-item-chai", chai.id, 1],
    ] as const) {
      await prisma.comboItem.upsert({
        where: { id },
        update: { quantity },
        create: { id, comboId: combo.id, menuItemId, quantity },
      });
    }
  }

  return itemBySlug;
}

async function seedKitchenStations(outletId: string) {
  for (const [id, name, code, sortOrder] of [
    ["seed-station-hot", "Hot Kitchen", "HOT", 1],
    ["seed-station-cold", "Cold Prep", "COLD", 2],
    ["seed-station-bar", "Bar", "BAR", 3],
  ] as const) {
    await prisma.kitchenStation.upsert({
      where: { outletId_code: { outletId, code } },
      update: { name, sortOrder },
      create: { id, outletId, name, code, sortOrder },
    });
  }
}

async function seedFloorsAndTables(outlet1Id: string, outlet2Id: string) {
  const floor = await prisma.floor.upsert({
    where: { id: "seed-floor-main" },
    update: {},
    create: { id: "seed-floor-main", outletId: outlet1Id, name: "Ground Floor" },
  });

  const section = await prisma.section.upsert({
    where: { id: "seed-section-main" },
    update: {},
    create: { id: "seed-section-main", floorId: floor.id, name: "Dining" },
  });

  for (let i = 1; i <= 6; i++) {
    await prisma.table.upsert({
      where: { id: `seed-table-${i}` },
      update: { status: i <= 2 ? "occupied" : "available" },
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

  const floorBandra = await prisma.floor.upsert({
    where: { id: "seed-floor-bandra" },
    update: {},
    create: { id: "seed-floor-bandra", outletId: outlet2Id, name: "Ground Floor" },
  });

  const sectionBandra = await prisma.section.upsert({
    where: { id: "seed-section-bandra" },
    update: {},
    create: { id: "seed-section-bandra", floorId: floorBandra.id, name: "Dining" },
  });

  for (let i = 1; i <= 4; i++) {
    await prisma.table.upsert({
      where: { id: `seed-table-bandra-${i}` },
      update: { status: "available" },
      create: {
        id: `seed-table-bandra-${i}`,
        sectionId: sectionBandra.id,
        name: `B${i}`,
        capacity: 4,
        qrCode: `qr-bandra-table-${i}`,
        status: "available",
      },
    });
  }
}

async function seedInventory(orgId: string, outlet1Id: string, outlet2Id: string) {
  const items: Array<{
    idMain: string;
    idBandra: string;
    name: string;
    sku: string;
    unit: string;
    stockMain: number;
    stockBandra: number;
  }> = [
    {
      idMain: "seed-inv-mozzarella",
      idBandra: "seed-inv-mozzarella-bandra",
      name: "Mozzarella",
      sku: "MOZ-001",
      unit: "kg",
      stockMain: 50,
      stockBandra: 20,
    },
    {
      idMain: "seed-inv-chicken",
      idBandra: "seed-inv-chicken-bandra",
      name: "Chicken",
      sku: "CHK-001",
      unit: "kg",
      stockMain: 40,
      stockBandra: 15,
    },
    {
      idMain: "seed-inv-flour",
      idBandra: "seed-inv-flour-bandra",
      name: "Flour",
      sku: "FLR-001",
      unit: "kg",
      stockMain: 80,
      stockBandra: 30,
    },
    {
      idMain: "seed-inv-tea",
      idBandra: "seed-inv-tea-bandra",
      name: "Tea Leaves",
      sku: "TEA-001",
      unit: "kg",
      stockMain: 10,
      stockBandra: 5,
    },
  ];

  for (const item of items) {
    await prisma.inventoryItem.upsert({
      where: { id: item.idMain },
      update: { currentStock: item.stockMain, name: item.name },
      create: {
        id: item.idMain,
        organizationId: orgId,
        outletId: outlet1Id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        currentStock: item.stockMain,
        reorderLevel: 5,
      },
    });
    await prisma.inventoryItem.upsert({
      where: { id: item.idBandra },
      update: { currentStock: item.stockBandra, name: item.name },
      create: {
        id: item.idBandra,
        organizationId: orgId,
        outletId: outlet2Id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        currentStock: item.stockBandra,
        reorderLevel: 5,
      },
    });
  }
}

async function seedCrm(orgId: string) {
  const stampTier = await prisma.loyaltyTier.upsert({
    where: { id: "seed-loyalty-stamp" },
    update: { name: "Stamp Card", minPoints: 0, multiplier: 1 },
    create: {
      id: "seed-loyalty-stamp",
      organizationId: orgId,
      name: "Stamp Card",
      minPoints: 0,
      multiplier: 1,
    },
  });

  const goldTier = await prisma.loyaltyTier.upsert({
    where: { id: "seed-loyalty-gold" },
    update: { name: "Gold", minPoints: 500, multiplier: 1.5 },
    create: {
      id: "seed-loyalty-gold",
      organizationId: orgId,
      name: "Gold",
      minPoints: 500,
      multiplier: 1.5,
    },
  });

  const coupon = await prisma.coupon.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "WELCOME10" } },
    update: { isActive: true, value: 10, minOrder: 200 },
    create: {
      organizationId: orgId,
      code: "WELCOME10",
      type: "percent",
      value: 10,
      minOrder: 200,
      isActive: true,
    },
  });

  const customers = [
    {
      id: "seed-customer-1",
      name: "Priya Sharma",
      email: "priya@example.com",
      phone: "+919876543210",
      loyaltyTierId: goldTier.id,
      loyaltyPoints: 620,
      stampCount: 8,
    },
    {
      id: "seed-customer-2",
      name: "Rahul Mehta",
      email: "rahul@example.com",
      phone: "+919876543211",
      loyaltyTierId: stampTier.id,
      loyaltyPoints: 120,
      stampCount: 3,
    },
    {
      id: "seed-customer-3",
      name: "Ananya Patel",
      email: "ananya@example.com",
      phone: "+919876543212",
      loyaltyTierId: stampTier.id,
      loyaltyPoints: 40,
      stampCount: 1,
    },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        email: c.email,
        phone: c.phone,
        loyaltyTierId: c.loyaltyTierId,
        loyaltyPoints: c.loyaltyPoints,
        stampCount: c.stampCount,
      },
      create: {
        id: c.id,
        organizationId: orgId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        loyaltyTierId: c.loyaltyTierId,
        loyaltyPoints: c.loyaltyPoints,
        stampCount: c.stampCount,
      },
    });
  }

  await prisma.loyaltyTransaction.upsert({
    where: { id: "seed-loyalty-tx-1" },
    update: { points: 50 },
    create: {
      id: "seed-loyalty-tx-1",
      customerId: "seed-customer-1",
      points: 50,
      type: "earn",
      reference: "seed-order-completed",
    },
  });

  await prisma.loyaltyTransaction.upsert({
    where: { id: "seed-loyalty-tx-2" },
    update: { points: 20 },
    create: {
      id: "seed-loyalty-tx-2",
      customerId: "seed-customer-2",
      points: 20,
      type: "earn",
      reference: "welcome-bonus",
    },
  });

  return { coupon, customers };
}

async function seedSampleOrders(
  orgId: string,
  outletId: string,
  createdById: string,
  itemBySlug: Map<string, { id: string; basePrice: number; name: string }>,
) {
  const pizza = itemBySlug.get("margherita-pizza");
  const wings = itemBySlug.get("chicken-wings");
  const chai = itemBySlug.get("masala-chai");
  const dal = itemBySlug.get("dal-makhani");
  const naan = itemBySlug.get("butter-naan");
  const brownie = itemBySlug.get("brownie");

  if (!pizza || !wings || !chai || !dal || !naan || !brownie) {
    throw new Error("Missing menu items for sample orders");
  }

  const cashMethod = await prisma.paymentMethod.findUnique({ where: { code: "cash" } });
  const upiMethod = await prisma.paymentMethod.findUnique({ where: { code: "upi" } });
  const hotStation = await prisma.kitchenStation.findFirst({
    where: { outletId, code: "HOT" },
  });

  // Open dine-in on T1
  await prisma.tableSession.upsert({
    where: { id: "seed-session-t1" },
    update: { status: "active" },
    create: {
      id: "seed-session-t1",
      tableId: "seed-table-1",
      sessionToken: "seed-session-token-t1",
      status: "active",
      guestCount: 2,
    },
  });

  const openSubtotal = wings.basePrice + pizza.basePrice;
  const openTax = Math.round(openSubtotal * 0.05 * 100) / 100;
  const openTotal = openSubtotal + openTax;

  const openOrder = await prisma.order.upsert({
    where: { id: "seed-order-open" },
    update: {
      status: "preparing",
      subtotal: openSubtotal,
      taxTotal: openTax,
      total: openTotal,
    },
    create: {
      id: "seed-order-open",
      organizationId: orgId,
      outletId,
      orderNumber: "ORD-1001",
      type: "dine_in",
      source: "waiter",
      status: "preparing",
      tableId: "seed-table-1",
      tableSessionId: "seed-session-t1",
      customerId: "seed-customer-2",
      createdById,
      guestCount: 2,
      subtotal: openSubtotal,
      taxTotal: openTax,
      total: openTotal,
      customerName: "Rahul Mehta",
    },
  });

  await prisma.orderItem.upsert({
    where: { id: "seed-oi-open-1" },
    update: {},
    create: {
      id: "seed-oi-open-1",
      orderId: openOrder.id,
      menuItemId: wings.id,
      name: wings.name,
      quantity: 1,
      unitPrice: wings.basePrice,
      taxAmount: Math.round(wings.basePrice * 0.05 * 100) / 100,
      total: wings.basePrice,
      status: "preparing",
      modifiers: [{ name: "Hot", price: 0 }],
    },
  });

  await prisma.orderItem.upsert({
    where: { id: "seed-oi-open-2" },
    update: {},
    create: {
      id: "seed-oi-open-2",
      orderId: openOrder.id,
      menuItemId: pizza.id,
      variantId: "seed-var-pizza-medium",
      name: `${pizza.name} (Medium)`,
      quantity: 1,
      unitPrice: 399,
      taxAmount: Math.round(399 * 0.05 * 100) / 100,
      total: 399,
      status: "preparing",
      modifiers: [{ name: "Extra Cheese", price: 40 }],
    },
  });

  for (const [id, taxName, amount] of [
    ["seed-otl-open-cgst", "CGST", openTax / 2],
    ["seed-otl-open-sgst", "SGST", openTax / 2],
  ] as const) {
    await prisma.orderTaxLine.upsert({
      where: { id },
      update: { amount },
      create: { id, orderId: openOrder.id, taxName, rate: 2.5, amount },
    });
  }

  await prisma.orderTimeline.upsert({
    where: { id: "seed-tl-open-created" },
    update: {},
    create: {
      id: "seed-tl-open-created",
      orderId: openOrder.id,
      event: "created",
      metadata: { source: "seed" },
    },
  });

  const kot = await prisma.kOT.upsert({
    where: { id: "seed-kot-open" },
    update: { status: "pending" },
    create: {
      id: "seed-kot-open",
      orderId: openOrder.id,
      kitchenStationId: hotStation?.id,
      kotNumber: "KOT-1001",
      status: "pending",
    },
  });

  await prisma.kOTItem.upsert({
    where: { id: "seed-koti-1" },
    update: { status: "pending" },
    create: {
      id: "seed-koti-1",
      kotId: kot.id,
      orderItemId: "seed-oi-open-1",
      status: "pending",
    },
  });

  await prisma.kOTItem.upsert({
    where: { id: "seed-koti-2" },
    update: { status: "pending" },
    create: {
      id: "seed-koti-2",
      kotId: kot.id,
      orderItemId: "seed-oi-open-2",
      status: "pending",
    },
  });

  // Completed takeaway
  const doneSubtotal = dal.basePrice + naan.basePrice * 2 + chai.basePrice;
  const doneTax = Math.round(doneSubtotal * 0.05 * 100) / 100;
  const doneTotal = doneSubtotal + doneTax;
  const completedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const doneOrder = await prisma.order.upsert({
    where: { id: "seed-order-completed" },
    update: {
      status: "completed",
      subtotal: doneSubtotal,
      taxTotal: doneTax,
      total: doneTotal,
      completedAt,
    },
    create: {
      id: "seed-order-completed",
      organizationId: orgId,
      outletId,
      orderNumber: "ORD-1000",
      type: "takeaway",
      source: "pos",
      status: "completed",
      customerId: "seed-customer-1",
      createdById,
      subtotal: doneSubtotal,
      taxTotal: doneTax,
      total: doneTotal,
      customerName: "Priya Sharma",
      completedAt,
    },
  });

  await prisma.orderItem.upsert({
    where: { id: "seed-oi-done-1" },
    update: {},
    create: {
      id: "seed-oi-done-1",
      orderId: doneOrder.id,
      menuItemId: dal.id,
      name: dal.name,
      quantity: 1,
      unitPrice: dal.basePrice,
      taxAmount: Math.round(dal.basePrice * 0.05 * 100) / 100,
      total: dal.basePrice,
      status: "served",
    },
  });

  await prisma.orderItem.upsert({
    where: { id: "seed-oi-done-2" },
    update: {},
    create: {
      id: "seed-oi-done-2",
      orderId: doneOrder.id,
      menuItemId: naan.id,
      name: naan.name,
      quantity: 2,
      unitPrice: naan.basePrice,
      taxAmount: Math.round(naan.basePrice * 2 * 0.05 * 100) / 100,
      total: naan.basePrice * 2,
      status: "served",
    },
  });

  await prisma.orderItem.upsert({
    where: { id: "seed-oi-done-3" },
    update: {},
    create: {
      id: "seed-oi-done-3",
      orderId: doneOrder.id,
      menuItemId: chai.id,
      name: chai.name,
      quantity: 1,
      unitPrice: chai.basePrice,
      taxAmount: Math.round(chai.basePrice * 0.05 * 100) / 100,
      total: chai.basePrice,
      status: "served",
    },
  });

  for (const [id, taxName, amount] of [
    ["seed-otl-done-cgst", "CGST", doneTax / 2],
    ["seed-otl-done-sgst", "SGST", doneTax / 2],
  ] as const) {
    await prisma.orderTaxLine.upsert({
      where: { id },
      update: { amount },
      create: { id, orderId: doneOrder.id, taxName, rate: 2.5, amount },
    });
  }

  if (cashMethod) {
    await prisma.payment.upsert({
      where: { id: "seed-payment-done" },
      update: { amount: doneTotal, status: "completed" },
      create: {
        id: "seed-payment-done",
        orderId: doneOrder.id,
        paymentMethodId: cashMethod.id,
        amount: doneTotal,
        status: "completed",
        reference: "CASH-SEED-1000",
        processedAt: completedAt,
      },
    });
  }

  await prisma.invoice.upsert({
    where: { id: "seed-invoice-done" },
    update: { status: "paid", total: doneTotal },
    create: {
      id: "seed-invoice-done",
      orderId: doneOrder.id,
      invoiceNumber: "INV-1000",
      status: "paid",
      subtotal: doneSubtotal,
      taxTotal: doneTax,
      total: doneTotal,
      issuedAt: completedAt,
    },
  });

  // Ready takeaway (pickup)
  const readySubtotal = brownie.basePrice + chai.basePrice;
  const readyTax = Math.round(readySubtotal * 0.05 * 100) / 100;
  const readyTotal = readySubtotal + readyTax;

  const readyOrder = await prisma.order.upsert({
    where: { id: "seed-order-ready" },
    update: {
      status: "ready",
      subtotal: readySubtotal,
      taxTotal: readyTax,
      total: readyTotal,
    },
    create: {
      id: "seed-order-ready",
      organizationId: orgId,
      outletId,
      orderNumber: "ORD-1002",
      type: "takeaway",
      source: "customer",
      status: "ready",
      customerId: "seed-customer-3",
      createdById,
      subtotal: readySubtotal,
      taxTotal: readyTax,
      total: readyTotal,
      customerName: "Ananya Patel",
      scheduledPickupAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  await prisma.orderItem.upsert({
    where: { id: "seed-oi-ready-1" },
    update: {},
    create: {
      id: "seed-oi-ready-1",
      orderId: readyOrder.id,
      menuItemId: brownie.id,
      name: brownie.name,
      quantity: 1,
      unitPrice: brownie.basePrice,
      taxAmount: Math.round(brownie.basePrice * 0.05 * 100) / 100,
      total: brownie.basePrice,
      status: "ready",
    },
  });

  await prisma.orderItem.upsert({
    where: { id: "seed-oi-ready-2" },
    update: {},
    create: {
      id: "seed-oi-ready-2",
      orderId: readyOrder.id,
      menuItemId: chai.id,
      name: chai.name,
      quantity: 1,
      unitPrice: chai.basePrice,
      taxAmount: Math.round(chai.basePrice * 0.05 * 100) / 100,
      total: chai.basePrice,
      status: "ready",
    },
  });

  if (upiMethod) {
    await prisma.payment.upsert({
      where: { id: "seed-payment-ready" },
      update: { amount: readyTotal, status: "completed" },
      create: {
        id: "seed-payment-ready",
        orderId: readyOrder.id,
        paymentMethodId: upiMethod.id,
        amount: readyTotal,
        status: "completed",
        reference: "UPI-SEED-1002",
        processedAt: new Date(),
      },
    });
  }
}

async function seedSmbMenu(
  orgId: string,
  outletId: string,
  businessType: "cafe" | "food_truck" | "bakery",
) {
  const menu = SMB_MENUS[businessType];
  if (!menu) return;

  for (const [catIdx, cat] of menu.entries()) {
    const catSlug = cat.category.toLowerCase().replace(/\s+/g, "-");
    const category = await prisma.menuCategory.upsert({
      where: { organizationId_slug: { organizationId: orgId, slug: catSlug } },
      update: { name: cat.category, sortOrder: catIdx + 1 },
      create: {
        organizationId: orgId,
        name: cat.category,
        slug: catSlug,
        sortOrder: catIdx + 1,
      },
    });

    for (const [itemIdx, item] of cat.items.entries()) {
      const menuItem = await prisma.menuItem.upsert({
        where: { organizationId_slug: { organizationId: orgId, slug: item.slug } },
        update: {
          name: item.name,
          basePrice: item.price,
          isVeg: item.isVeg ?? true,
          categoryId: category.id,
          isActive: true,
          sortOrder: itemIdx + 1,
        },
        create: {
          organizationId: orgId,
          categoryId: category.id,
          name: item.name,
          slug: item.slug,
          basePrice: item.price,
          isVeg: item.isVeg ?? true,
          sortOrder: itemIdx + 1,
        },
      });

      await prisma.outletMenuPrice.upsert({
        where: {
          outletId_menuItemId_priceType: {
            outletId,
            menuItemId: menuItem.id,
            priceType: "retail",
          },
        },
        update: { price: item.price, isAvailable: true },
        create: {
          outletId,
          menuItemId: menuItem.id,
          price: item.price,
          priceType: "retail",
          isAvailable: true,
        },
      });
    }
  }
}

async function main() {
  await seedPermissions();
  const { enterprisePlan, qsrPlan } = await seedPlans();

  for (const code of ["cash", "card", "upi", "wallet"]) {
    await prisma.paymentMethod.upsert({
      where: { code },
      update: {},
      create: { name: code.toUpperCase(), code },
    });
  }

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const productionAdminHash = await bcrypt.hash("superadmin123", 10);

  // ── Platform ──────────────────────────────────────────────────────────────
  const platformOrg = await prisma.organization.upsert({
    where: { slug: "rkyves-platform" },
    update: {},
    create: {
      name: "Rkyves Platform",
      slug: "rkyves-platform",
      status: "active",
      email: "ops@rkyves.com",
      settings: { create: { settings: { setupCompleted: true } } },
    },
  });
  await markSetupCompleted(platformOrg.id);

  await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: platformOrg.id,
        email: "superadmin@cullinos.com",
      },
    },
    // Never reset existing production passwords on re-seed.
    update: { isSuperAdmin: true },
    create: {
      organizationId: platformOrg.id,
      email: "superadmin@cullinos.com",
      passwordHash,
      name: "Platform Super Admin",
      isSuperAdmin: true,
    },
  });

  await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: platformOrg.id,
        email: "admin@rkyves.com",
      },
    },
    update: { isSuperAdmin: true },
    create: {
      organizationId: platformOrg.id,
      email: "admin@rkyves.com",
      passwordHash: productionAdminHash,
      name: "Rkyves Admin",
      isSuperAdmin: true,
    },
  });

  const seedDemo =
    process.env.SEED_DEMO === "true" ||
    (process.env.SEED_DEMO !== "false" && process.env.NODE_ENV !== "production");

  if (!seedDemo) {
    console.log("Seed complete (production baseline only):", {
      platform: platformOrg.slug,
      plans: true,
      permissions: true,
      demoTenants: false,
      hint: "Set SEED_DEMO=true to create demo restaurants locally",
    });
    return;
  }

  // ── Demo restaurant (local / explicit SEED_DEMO=true only) ───────────────
  const org = await prisma.organization.upsert({
    where: { slug: "demo-restaurant" },
    update: { status: "active", businessType: "restaurant" },
    create: {
      name: "Demo Restaurant",
      slug: "demo-restaurant",
      businessType: "restaurant",
      status: "active",
      email: "demo@cullinos.com",
      settings: { create: { settings: { setupCompleted: true } } },
    },
  });
  await markSetupCompleted(org.id);

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

  await ensureRoles(org.id, [
    ["owner", "Owner"],
    ["manager", "Manager"],
    ["waiter", "Waiter"],
    ["cashier", "Cashier"],
  ]);

  const owner = await upsertStaffUser({
    orgId: org.id,
    email: "owner@cullinos.com",
    name: "Demo Owner",
    passwordHash,
    roleSlug: "owner",
    outletIds: [outlet1.id, outlet2.id],
  });

  await upsertStaffUser({
    orgId: org.id,
    email: "manager@cullinos.com",
    name: "Demo Manager",
    passwordHash,
    roleSlug: "manager",
    outletIds: [outlet1.id, outlet2.id],
  });

  await upsertStaffUser({
    orgId: org.id,
    email: "waiter@cullinos.com",
    name: "Demo Waiter",
    passwordHash,
    roleSlug: "waiter",
    outletIds: [outlet1.id, outlet2.id],
  });

  await upsertStaffUser({
    orgId: org.id,
    email: "cashier@cullinos.com",
    name: "Demo Cashier",
    passwordHash,
    roleSlug: "cashier",
    outletIds: [outlet1.id, outlet2.id],
  });

  await prisma.subscription.upsert({
    where: { id: "seed-subscription" },
    update: { planId: enterprisePlan.id, status: "active" },
    create: {
      id: "seed-subscription",
      organizationId: org.id,
      planId: enterprisePlan.id,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  await assignSubscriptionEntitlements("seed-subscription", enterprisePlan.id);

  const taxGroup = await seedTax(org.id);
  const itemBySlug = await seedMenuCatalog(org.id, [outlet1.id, outlet2.id], taxGroup.id);
  await seedKitchenStations(outlet1.id);
  await seedFloorsAndTables(outlet1.id, outlet2.id);
  await seedInventory(org.id, outlet1.id, outlet2.id);
  await seedCrm(org.id);
  await seedSampleOrders(org.id, outlet1.id, owner.id, itemBySlug);

  const existingFranchise = await prisma.franchiseAgreement.findUnique({
    where: { id: "seed-franchise-1" },
    include: { outlets: true },
  });
  if (!existingFranchise) {
    await prisma.franchiseAgreement.create({
      data: {
        id: "seed-franchise-1",
        organizationId: org.id,
        franchiseeName: "Bandra Franchise Partner",
        startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        outlets: { create: [{ outletId: outlet2.id }] },
      },
    });
  } else if (!existingFranchise.outlets.some((o) => o.outletId === outlet2.id)) {
    await prisma.franchiseOutlet.create({
      data: { franchiseAgreementId: existingFranchise.id, outletId: outlet2.id },
    });
  }

  // ── SMB demos ─────────────────────────────────────────────────────────────
  const foodBusinessDemos: Array<{
    slug: string;
    name: string;
    businessType: "cafe" | "food_truck" | "bakery";
    operatingMode: "counter" | "hybrid";
  }> = [
    { slug: "demo-cafe", name: "Demo Cafe", businessType: "cafe", operatingMode: "counter" },
    {
      slug: "demo-food-truck",
      name: "Demo Food Truck",
      businessType: "food_truck",
      operatingMode: "counter",
    },
    { slug: "demo-bakery", name: "Demo Bakery", businessType: "bakery", operatingMode: "hybrid" },
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
        settings: {
          create: { settings: { businessType: demo.businessType, setupCompleted: true } },
        },
      },
    });
    await markSetupCompleted(demoOrg.id);

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

    await ensureRoles(demoOrg.id, [["owner", "Owner"]]);

    await upsertStaffUser({
      orgId: demoOrg.id,
      email: `${demo.slug}-owner@cullinos.com`,
      name: `${demo.name} Owner`,
      passwordHash,
      roleSlug: "owner",
      outletIds: [demoOutlet.id],
    });

    const subId = `seed-sub-${demo.slug}`;
    await prisma.subscription.upsert({
      where: { id: subId },
      update: { planId: qsrPlan.id, status: "active" },
      create: {
        id: subId,
        organizationId: demoOrg.id,
        planId: qsrPlan.id,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await assignSubscriptionEntitlements(subId, qsrPlan.id);

    await seedSmbMenu(demoOrg.id, demoOutlet.id, demo.businessType);

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

  console.log("Seed complete:", {
    org: org.slug,
    logins: {
      superAdmin: "superadmin@cullinos.com / demo1234",
      platformAdmin: "admin@rkyves.com / superadmin123",
      owner: "owner@cullinos.com / demo1234",
      manager: "manager@cullinos.com / demo1234",
      waiter: "waiter@cullinos.com / demo1234",
      cashier: "cashier@cullinos.com / demo1234",
      cafeOwner: "demo-cafe-owner@cullinos.com / demo1234",
      foodTruckOwner: "demo-food-truck-owner@cullinos.com / demo1234",
      bakeryOwner: "demo-bakery-owner@cullinos.com / demo1234",
    },
    outlets: [outlet1.slug, outlet2.slug],
    menuCategories: RESTAURANT_MENU.map((c) => c.name),
    sampleOrders: ["ORD-1000 completed", "ORD-1001 preparing+KOT", "ORD-1002 ready"],
    storefront: `/demo-restaurant/main-outlet`,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
