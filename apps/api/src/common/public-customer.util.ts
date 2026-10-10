import type { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { newUnsubscribeToken } from "../modules/privacy/privacy.crypto";
import { getJwtSecret } from "./jwt-secret.util";
import { normalizePhoneE164, staffPhoneLookupVariants } from "./phone.util";

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
  const normalized = normalizePhoneE164(phone.trim());
  const digits = normalized.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return undefined;

  const find = () =>
    prisma.customer.findFirst({
      where: {
        organizationId: orgId,
        phone: { in: [normalized, ...staffPhoneLookupVariants(digits)] },
      },
      select: { id: true, anonymizedAt: true },
      orderBy: { createdAt: "asc" },
    });

  const existing = await find();
  if (existing) return existing.anonymizedAt ? undefined : existing.id;

  const displayName = typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : "Guest";
  try {
    const created = await prisma.customer.create({
      data: {
        organizationId: orgId,
        name: displayName,
        phone: normalized,
        unsubscribeToken: newUnsubscribeToken(),
      },
      select: { id: true },
    });
    return created.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await find();
      return raced && !raced.anonymizedAt ? raced.id : undefined;
    }
    throw err;
  }
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
