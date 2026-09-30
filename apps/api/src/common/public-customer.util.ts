import type { JwtService } from "@nestjs/jwt";
import type { PrismaService } from "../prisma/prisma.service";
import { getJwtSecret } from "./jwt-secret.util";

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
