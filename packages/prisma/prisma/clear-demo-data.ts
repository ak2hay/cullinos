/**
 * Remove seeded demo tenants and related data from the database.
 * Keeps: platform org, SaaS plans, permissions, payment methods, real customer orgs.
 *
 * Usage:
 *   npx tsx packages/prisma/prisma/clear-demo-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_ORG_SLUGS = [
  "demo-restaurant",
  "demo-cafe",
  "demo-food-truck",
  "demo-bakery",
] as const;

const DEMO_ORG_EMAILS = [
  "demo@cullinos.com",
  "demo-cafe@cullinos.com",
  "demo-food-truck@cullinos.com",
  "demo-bakery@cullinos.com",
] as const;

async function deleteOrganizationTree(orgId: string) {
  // Clear join tables / non-cascading FKs first (Prisma schema has gaps).
  await prisma.$executeRaw`
    DELETE FROM franchise_outlets
    WHERE outlet_id IN (SELECT id FROM outlets WHERE organization_id = ${orgId})
       OR franchise_agreement_id IN (
            SELECT id FROM franchise_agreements WHERE organization_id = ${orgId}
          )
  `;

  await prisma.$executeRaw`
    DELETE FROM combo_items
    WHERE combo_id IN (SELECT id FROM combos WHERE organization_id = ${orgId})
       OR menu_item_id IN (SELECT id FROM menu_items WHERE organization_id = ${orgId})
  `;

  await prisma.$executeRaw`
    DELETE FROM combos WHERE organization_id = ${orgId}
  `;

  await prisma.$executeRaw`
    UPDATE employees SET outlet_id = NULL WHERE organization_id = ${orgId}
  `;

  await prisma.$executeRaw`
    DELETE FROM menu_item_modifier_groups
    WHERE menu_item_id IN (SELECT id FROM menu_items WHERE organization_id = ${orgId})
  `;

  await prisma.$executeRaw`
    DELETE FROM menu_item_variants
    WHERE menu_item_id IN (SELECT id FROM menu_items WHERE organization_id = ${orgId})
  `;

  await prisma.$executeRaw`
    DELETE FROM outlet_menu_prices
    WHERE menu_item_id IN (SELECT id FROM menu_items WHERE organization_id = ${orgId})
       OR outlet_id IN (SELECT id FROM outlets WHERE organization_id = ${orgId})
  `;

  await prisma.organization.delete({ where: { id: orgId } });
}

async function main() {
  const demos = await prisma.organization.findMany({
    where: {
      OR: [
        { slug: { in: [...DEMO_ORG_SLUGS] } },
        { email: { in: [...DEMO_ORG_EMAILS] } },
      ],
    },
    select: { id: true, slug: true, name: true, email: true },
  });

  const toDelete = demos.filter((o) => o.slug !== "rkyves-platform");

  if (toDelete.length === 0) {
    console.log("No demo organizations found. Nothing to clear.");
    return;
  }

  console.log(
    "Deleting demo organizations:",
    toDelete.map((o) => `${o.slug} (${o.email ?? "no-email"})`).join(", "),
  );

  for (const org of toDelete) {
    await deleteOrganizationTree(org.id);
    console.log(`Deleted ${org.slug}`);
  }

  const remaining = await prisma.organization.findMany({
    select: { slug: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  console.log(
    "Remaining organizations:",
    remaining.map((o) => `${o.slug} <${o.email ?? ""}>`).join(", ") || "(none)",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
