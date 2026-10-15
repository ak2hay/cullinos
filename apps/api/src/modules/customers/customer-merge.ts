import type { Customer, Prisma } from "@prisma/client";
import { normalizePhoneE164 } from "../../common/phone.util";

/** Same handset → same key, whatever format (+91…, 91…, 10-digit, stray spaces / zero-width chars). */
export function customerPhoneKey(phone: string | null | undefined): string | null {
  const cleaned = String(phone ?? "").replace(/[\s\u200B-\u200D\uFEFF]/g, "");
  if (!cleaned || cleaned.startsWith("anon_")) return null;
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;
  return normalizePhoneE164(cleaned);
}

export const isGuestName = (name: string | null | undefined) => /^Guest(\s|$)/.test(name ?? "");

type MergeCandidate = Pick<
  Customer,
  "id" | "name" | "phone" | "email" | "loyaltyTierId" | "loyaltyPoints" | "stampCount" | "createdAt"
>;

export type DuplicateGroup<T extends MergeCandidate = MergeCandidate> = {
  phone: string;
  primary: T;
  duplicates: T[];
};

/** Groups by normalized phone; the oldest customer in each group is kept. */
export function findDuplicateGroups<T extends MergeCandidate>(customers: T[]): {
  groups: DuplicateGroup<T>[];
  toNormalize: { customer: T; phone: string }[];
} {
  const byKey = new Map<string, T[]>();
  for (const c of [...customers].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const key = customerPhoneKey(c.phone);
    if (!key) continue;
    const rows = byKey.get(key) ?? [];
    rows.push(c);
    byKey.set(key, rows);
  }
  const groups: DuplicateGroup<T>[] = [];
  const toNormalize: { customer: T; phone: string }[] = [];
  for (const [phone, [primary, ...duplicates]] of byKey) {
    if (duplicates.length) groups.push({ phone, primary, duplicates });
    else if (primary.phone !== phone) toNormalize.push({ customer: primary, phone });
  }
  return { groups, toNormalize };
}

/** Marketing opt-ins are not widened: the kept customer's choices win. */
export function mergedCustomerFields(group: DuplicateGroup) {
  const all = [group.primary, ...group.duplicates];
  const realName = all.find((c) => !isGuestName(c.name))?.name;
  return {
    phone: group.phone,
    name: isGuestName(group.primary.name) && realName ? realName : group.primary.name,
    email: group.primary.email ?? group.duplicates.find((d) => d.email)?.email ?? null,
    loyaltyTierId:
      group.primary.loyaltyTierId ?? group.duplicates.find((d) => d.loyaltyTierId)?.loyaltyTierId ?? null,
    loyaltyPoints: all.reduce((s, c) => s + (c.loyaltyPoints || 0), 0),
    stampCount: all.reduce((s, c) => s + (c.stampCount || 0), 0),
  };
}

export async function applyMergeGroup(
  tx: Prisma.TransactionClient,
  orgId: string,
  group: DuplicateGroup,
) {
  const dupIds = group.duplicates.map((d) => d.id);
  const primaryId = group.primary.id;
  await tx.order.updateMany({
    where: { organizationId: orgId, customerId: { in: dupIds } },
    data: { customerId: primaryId },
  });
  await tx.loyaltyTransaction.updateMany({
    where: { customerId: { in: dupIds } },
    data: { customerId: primaryId },
  });
  await tx.couponUsage.updateMany({
    where: { customerId: { in: dupIds } },
    data: { customerId: primaryId },
  });
  await tx.consentRecord.updateMany({
    where: { organizationId: orgId, subjectType: "customer", subjectId: { in: dupIds } },
    data: { subjectId: primaryId },
  });

  let keep = await tx.guestOrgMembership.findUnique({ where: { customerId: primaryId } });
  const dupMemberships = await tx.guestOrgMembership.findMany({
    where: { customerId: { in: dupIds } },
    orderBy: { createdAt: "asc" },
  });
  for (const m of dupMemberships) {
    if (!keep) {
      keep = await tx.guestOrgMembership.update({ where: { id: m.id }, data: { customerId: primaryId } });
    } else {
      await tx.guestOrgMembership.delete({ where: { id: m.id } });
    }
  }

  await tx.customer.deleteMany({ where: { id: { in: dupIds }, organizationId: orgId } });
  await tx.customer.update({ where: { id: primaryId }, data: mergedCustomerFields(group) });
}
