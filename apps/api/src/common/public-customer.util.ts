import type { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { newUnsubscribeToken } from "../modules/privacy/privacy.crypto";
import { getJwtSecret } from "./jwt-secret.util";
import { isGuestName } from "../modules/customers/customer-merge";
import { customerPhoneLookupVariants, normalizePhoneE164 } from "./phone.util";

type CustomerDb = Pick<PrismaService, "customer"> | Prisma.TransactionClient;

/** Oldest customer in the org whose phone matches any stored format of `phone`. */
export function findCustomerByPhone(db: CustomerDb, orgId: string, phone: string) {
  const variants = customerPhoneLookupVariants(phone);
  if (!variants.length) return Promise.resolve(null);
  return db.customer.findFirst({
    where: { organizationId: orgId, phone: { in: variants } },
    orderBy: { createdAt: "asc" },
  });
}

export function guestNameForPhone(phone: string): string {
  return `Guest ${normalizePhoneE164(phone).slice(-4)}`;
}

/**
 * Single entry point for phone-keyed customer creation: matches every stored phone format
 * and always writes E.164, so one handset maps to one customer per org.
 */
export async function findOrCreateCustomerByPhone(
  db: CustomerDb,
  orgId: string,
  phone: string,
  createData: Omit<Prisma.CustomerUncheckedCreateInput, "organizationId" | "phone" | "name"> & {
    name?: string | null;
  } = {},
) {
  const normalized = normalizePhoneE164(phone);
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;

  const realName = createData.name?.trim() ? createData.name.trim().slice(0, 120) : null;
  const existing = await findCustomerByPhone(db, orgId, normalized);
  if (existing) {
    if (realName && !existing.anonymizedAt && isGuestName(existing.name) && !isGuestName(realName)) {
      const renamed = await db.customer.update({ where: { id: existing.id }, data: { name: realName } });
      return { customer: renamed, created: false };
    }
    return { customer: existing, created: false };
  }

  const name = realName ?? guestNameForPhone(normalized);
  try {
    const customer = await db.customer.create({
      data: {
        unsubscribeToken: newUnsubscribeToken(),
        ...createData,
        organizationId: orgId,
        phone: normalized,
        name,
      },
    });
    return { customer, created: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await findCustomerByPhone(db, orgId, normalized);
      if (raced) return { customer: raced, created: false };
    }
    throw err;
  }
}

/**
 * Anonymous QR guests: find or create the org's customer by phone so the order can earn
 * loyalty. Earn-only — redeeming still needs a verified customer token or staff at POS.
 */
export async function resolvePublicCustomerByPhone(
  prisma: PrismaService,
  orgId: string,
  phone: unknown,
  name: unknown,
): Promise<string | undefined> {
  if (typeof phone !== "string") return undefined;
  const result = await findOrCreateCustomerByPhone(prisma, orgId, phone, {
    name: typeof name === "string" ? name : null,
  });
  if (!result || result.customer.anonymizedAt) return undefined;
  return result.customer.id;
}

/**
 * A guest may only attach an order to a customer record they own: via their
 * Cullinos App guest token (org membership) or a per-org customer token.
 */
export async function provePublicCustomerId(
  jwt: JwtService,
  prisma: PrismaService,
  orgId: string,
  customerId: string | undefined,
  authorization: string | undefined,
): Promise<string | undefined> {
  if (!customerId || !authorization?.startsWith("Bearer ")) return undefined;
  let payload: { sub?: string; type?: string; orgId?: string };
  try {
    payload = jwt.verify(authorization.slice(7), { secret: getJwtSecret() });
  } catch {
    return undefined;
  }
  if (payload.type === "customer") {
    return payload.sub === customerId && payload.orgId === orgId ? customerId : undefined;
  }
  if (payload.type === "guest" && payload.sub) {
    const membership = await prisma.guestOrgMembership.findFirst({
      where: { guestUserId: payload.sub, customerId, organizationId: orgId },
      select: { customerId: true },
    });
    return membership?.customerId ?? undefined;
  }
  return undefined;
}
