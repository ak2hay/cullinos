import { ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Restaurant-level access: users with OutletUser rows may only touch those outlets.
 * Users with no OutletUser rows (typical owners) may access all org outlets.
 */
@Injectable()
export class OutletAccessService {
  constructor(private prisma: PrismaService) {}

  /** null = unrestricted (all outlets in org). */
  async allowedOutletIds(userId: string, orgId: string): Promise<Set<string> | null> {
    const rows = await this.prisma.outletUser.findMany({
      where: { userId, outlet: { organizationId: orgId } },
      select: { outletId: true },
    });
    if (rows.length === 0) return null;
    return new Set(rows.map((r) => r.outletId));
  }

  async assertCanAccessOutlet(userId: string, orgId: string, outletId: string) {
    const allowed = await this.allowedOutletIds(userId, orgId);
    if (allowed && !allowed.has(outletId)) {
      throw new ForbiddenException("You do not have access to this restaurant");
    }
  }
}
