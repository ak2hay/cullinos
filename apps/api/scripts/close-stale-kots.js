/**
 * One-off: close kitchen tickets (KOTs) that are still open although their order is
 * completed / cancelled / voided (pre-fix data, e.g. K0001/K0002 stuck on NEW).
 *
 * Usage: node apps/api/scripts/close-stale-kots.js [--org <organizationId>] [--apply]
 * Dry-run by default; pass --apply to write.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const orgId = arg("--org");

  const stale = await prisma.kOT.findMany({
    where: {
      status: { in: ["pending", "preparing", "ready"] },
      order: {
        status: { in: ["completed", "cancelled", "voided"] },
        ...(orgId ? { organizationId: orgId } : {}),
      },
    },
    select: {
      id: true,
      kotNumber: true,
      status: true,
      order: { select: { organizationId: true, orderNumber: true, status: true } },
    },
  });

  for (const kot of stale) {
    const target = kot.order.status === "completed" ? "served" : "cancelled";
    console.log(
      `${apply ? "close" : "would close"} ${kot.kotNumber} (${kot.status} -> ${target})`,
      `org=${kot.order.organizationId} order=#${kot.order.orderNumber} (${kot.order.status})`,
    );
    if (!apply) continue;
    await prisma.$transaction([
      prisma.kOTItem.updateMany({
        where: { kotId: kot.id, status: { notIn: ["served", "cancelled"] } },
        data: { status: target },
      }),
      prisma.kOT.update({ where: { id: kot.id }, data: { status: target } }),
    ]);
  }
  console.log(`${stale.length} stale KOT(s)${apply ? " closed" : " found (dry-run)"}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
