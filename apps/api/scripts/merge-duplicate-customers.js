/**
 * Merge customers that share a handset within an organization and store every phone as E.164.
 *
 *   node apps/api/scripts/merge-duplicate-customers.js            # dry run (default)
 *   node apps/api/scripts/merge-duplicate-customers.js --apply    # write changes
 *   node apps/api/scripts/merge-duplicate-customers.js --org <organizationId>
 *
 * The oldest customer in each group is kept. Orders, loyalty transactions, coupon usages,
 * consent records and the guest-app membership move to it; points and stamps are summed.
 * Marketing opt-ins are not widened: the kept customer's choices win.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const orgArg = args.indexOf("--org");
const ORG_ID = orgArg >= 0 ? args[orgArg + 1] : undefined;

function toE164(phone) {
  const cleaned = String(phone || "").replace(/[\s\u200B-\u200D\uFEFF]/g, "");
  if (!cleaned || cleaned.startsWith("anon_")) return null;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

const isGuestName = (name) => /^Guest(\s|$)/.test(name || "");

async function checkUniqueIndex() {
  const rows = await prisma.$queryRaw`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'customers' AND indexname = 'customers_organization_id_phone_key'`;
  if (!rows.length) {
    console.warn(
      "WARNING: unique index customers_organization_id_phone_key is missing; " +
        "recreate it after merging (prisma migrate deploy).",
    );
  } else {
    console.log("OK: unique index customers_organization_id_phone_key present");
  }
}

async function mergeGroup(primary, dups, e164) {
  const dupIds = dups.map((d) => d.id);
  const orgId = primary.organizationId;
  const realName = [primary, ...dups].find((c) => !isGuestName(c.name))?.name;

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({ where: { customerId: { in: dupIds } }, data: { customerId: primary.id } });
    await tx.loyaltyTransaction.updateMany({
      where: { customerId: { in: dupIds } },
      data: { customerId: primary.id },
    });
    await tx.couponUsage.updateMany({
      where: { customerId: { in: dupIds } },
      data: { customerId: primary.id },
    });
    await tx.consentRecord.updateMany({
      where: { organizationId: orgId, subjectType: "customer", subjectId: { in: dupIds } },
      data: { subjectId: primary.id },
    });

    const primaryMembership = await tx.guestOrgMembership.findUnique({
      where: { customerId: primary.id },
    });
    const dupMemberships = await tx.guestOrgMembership.findMany({
      where: { customerId: { in: dupIds } },
      orderBy: { createdAt: "asc" },
    });
    let keep = primaryMembership;
    for (const m of dupMemberships) {
      if (!keep) {
        keep = await tx.guestOrgMembership.update({ where: { id: m.id }, data: { customerId: primary.id } });
      } else {
        await tx.guestOrgMembership.delete({ where: { id: m.id } });
      }
    }

    await tx.customer.deleteMany({ where: { id: { in: dupIds }, organizationId: orgId } });
    await tx.customer.update({
      where: { id: primary.id },
      data: {
        phone: e164,
        name: isGuestName(primary.name) && realName ? realName : primary.name,
        email: primary.email ?? dups.find((d) => d.email)?.email ?? null,
        loyaltyTierId: primary.loyaltyTierId ?? dups.find((d) => d.loyaltyTierId)?.loyaltyTierId ?? null,
        loyaltyPoints: [primary, ...dups].reduce((s, c) => s + (c.loyaltyPoints || 0), 0),
        stampCount: [primary, ...dups].reduce((s, c) => s + (c.stampCount || 0), 0),
      },
    });
  });
}

async function main() {
  console.log(APPLY ? "Mode: APPLY" : "Mode: DRY RUN (pass --apply to write)");
  await checkUniqueIndex();

  const customers = await prisma.customer.findMany({
    where: { phone: { not: null }, anonymizedAt: null, ...(ORG_ID ? { organizationId: ORG_ID } : {}) },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map();
  for (const c of customers) {
    const e164 = toE164(c.phone);
    if (!e164) continue;
    const key = `${c.organizationId}|${e164}`;
    if (!groups.has(key)) groups.set(key, { e164, rows: [] });
    groups.get(key).rows.push(c);
  }

  let merged = 0;
  let normalized = 0;
  for (const { e164, rows } of groups.values()) {
    const [primary, ...dups] = rows;
    if (!dups.length) {
      if (primary.phone === e164) continue;
      console.log(`normalize ${primary.id} "${primary.phone}" -> ${e164}`);
      normalized++;
      if (APPLY) {
        await prisma.customer.update({ where: { id: primary.id }, data: { phone: e164 } });
      }
      continue;
    }
    console.log(
      `merge org=${primary.organizationId} ${e164}: keep ${primary.id} ("${primary.name}", ${primary.phone}) ` +
        `<- ${dups.map((d) => `${d.id} ("${d.name}", ${JSON.stringify(d.phone)})`).join(", ")}`,
    );
    merged += dups.length;
    if (APPLY) await mergeGroup(primary, dups, e164);
  }

  console.log(
    `${APPLY ? "Done" : "Would change"}: ${merged} duplicate customer(s) merged, ${normalized} phone(s) normalized`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
