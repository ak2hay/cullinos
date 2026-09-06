/**
 * Seed a compact demo menu for an existing tenant so kiosk / phone checkout can be tested.
 *
 * Usage:
 *   ORG_SLUG=test-resto-mtoihd64 npx tsx packages/prisma/prisma/seed-org-menu.ts
 *
 * On the VM (via docker compose api container), DATABASE_URL is already set.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ItemDef = {
  slug: string;
  name: string;
  description: string;
  basePrice: number;
  isVeg: boolean;
  allergens?: string[];
};

type CategoryDef = {
  slug: string;
  name: string;
  sortOrder: number;
  items: ItemDef[];
};

/** Cafe-friendly demo catalog — enough to exercise cart + checkout. */
const DEMO_MENU: CategoryDef[] = [
  {
    slug: "chai-coffee",
    name: "Chai & Coffee",
    sortOrder: 1,
    items: [
      {
        slug: "matka-chai",
        name: "Matka Chai",
        description: "Clay-pot masala chai",
        basePrice: 40,
        isVeg: true,
        allergens: ["dairy"],
      },
      {
        slug: "cutting-chai",
        name: "Cutting Chai",
        description: "Half-cup strong chai",
        basePrice: 20,
        isVeg: true,
        allergens: ["dairy"],
      },
      {
        slug: "filter-coffee",
        name: "Filter Coffee",
        description: "South Indian filter coffee",
        basePrice: 60,
        isVeg: true,
        allergens: ["dairy"],
      },
    ],
  },
  {
    slug: "snacks",
    name: "Snacks",
    sortOrder: 2,
    items: [
      {
        slug: "samosa",
        name: "Samosa",
        description: "Crispy potato samosa (2 pcs)",
        basePrice: 40,
        isVeg: true,
        allergens: ["gluten"],
      },
      {
        slug: "vada-pav",
        name: "Vada Pav",
        description: "Mumbai classic with chutney",
        basePrice: 35,
        isVeg: true,
        allergens: ["gluten"],
      },
      {
        slug: "maska-bun",
        name: "Maska Bun",
        description: "Soft bun with butter",
        basePrice: 45,
        isVeg: true,
        allergens: ["dairy", "gluten"],
      },
    ],
  },
  {
    slug: "combos",
    name: "Combos",
    sortOrder: 3,
    items: [
      {
        slug: "chai-samosa-combo",
        name: "Chai + Samosa Combo",
        description: "Matka chai with 2 samosas",
        basePrice: 70,
        isVeg: true,
        allergens: ["dairy", "gluten"],
      },
      {
        slug: "coffee-bun-combo",
        name: "Coffee + Maska Bun",
        description: "Filter coffee with maska bun",
        basePrice: 95,
        isVeg: true,
        allergens: ["dairy", "gluten"],
      },
    ],
  },
];

async function ensureTaxGroup(orgId: string) {
  const existing = await prisma.taxGroup.findFirst({
    where: { organizationId: orgId, name: "GST 5%" },
  });
  if (existing) return existing;

  return prisma.taxGroup.create({
    data: {
      organizationId: orgId,
      name: "GST 5%",
      isInclusive: false,
      rates: {
        create: [
          { name: "CGST", rate: 2.5, type: "percentage" },
          { name: "SGST", rate: 2.5, type: "percentage" },
        ],
      },
    },
  });
}

async function main() {
  const orgSlug = (process.env.ORG_SLUG ?? "").trim();
  if (!orgSlug) {
    throw new Error("Set ORG_SLUG (e.g. ORG_SLUG=test-resto-mtoihd64)");
  }

  const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (!org) {
    throw new Error(`Organization not found: ${orgSlug}`);
  }

  const outlets = await prisma.outlet.findMany({
    where: { organizationId: org.id, isActive: true },
    select: { id: true, slug: true, name: true },
  });
  if (outlets.length === 0) {
    throw new Error(`No active outlets for ${orgSlug}`);
  }

  const taxGroup = await ensureTaxGroup(org.id);
  let itemCount = 0;

  for (const cat of DEMO_MENU) {
    const category = await prisma.menuCategory.upsert({
      where: { organizationId_slug: { organizationId: org.id, slug: cat.slug } },
      update: { name: cat.name, sortOrder: cat.sortOrder, isActive: true },
      create: {
        organizationId: org.id,
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder,
        isActive: true,
      },
    });

    for (const [idx, item] of cat.items.entries()) {
      const menuItem = await prisma.menuItem.upsert({
        where: { organizationId_slug: { organizationId: org.id, slug: item.slug } },
        update: {
          name: item.name,
          description: item.description,
          basePrice: item.basePrice,
          isVeg: item.isVeg,
          allergens: item.allergens ?? [],
          categoryId: category.id,
          taxGroupId: taxGroup.id,
          isActive: true,
          sortOrder: idx + 1,
        },
        create: {
          organizationId: org.id,
          categoryId: category.id,
          name: item.name,
          slug: item.slug,
          description: item.description,
          basePrice: item.basePrice,
          isVeg: item.isVeg,
          allergens: item.allergens ?? [],
          taxGroupId: taxGroup.id,
          sortOrder: idx + 1,
        },
      });

      for (const outlet of outlets) {
        await prisma.outletMenuPrice.upsert({
          where: {
            outletId_menuItemId_priceType: {
              outletId: outlet.id,
              menuItemId: menuItem.id,
              priceType: "retail",
            },
          },
          update: { price: item.basePrice, isAvailable: true },
          create: {
            outletId: outlet.id,
            menuItemId: menuItem.id,
            price: item.basePrice,
            priceType: "retail",
            isAvailable: true,
          },
        });
      }

      itemCount += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        org: org.slug,
        orgName: org.name,
        outlets: outlets.map((o) => o.slug),
        categories: DEMO_MENU.map((c) => c.name),
        items: itemCount,
        storefront: `https://order.cullinos.com/${org.slug}/${outlets[0].slug}`,
        kiosk: `https://order.cullinos.com/${org.slug}/${outlets[0].slug}/kiosk`,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
