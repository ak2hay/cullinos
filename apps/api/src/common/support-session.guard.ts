import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const CACHE_TTL_MS = 15_000;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isReadOnlyBlocked(method: string, path: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  // Ending the session must always work.
  return !/\/auth\/logout(\?|$|-all)/.test(path);
}

/**
 * Ticket-backed support sessions: the grant must still be active (revocation applies
 * within seconds) and read-only grants cannot change tenant data.
 */
@Injectable()
export class SupportSessionGuard implements CanActivate {
  private cache = new Map<string, { active: boolean; expiresAt: number }>();

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;
    const req = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url: string;
      user?: { impersonation?: boolean; grantId?: string; accessLevel?: string };
    }>();
    const user = req.user;
    if (!user?.impersonation || !user.grantId) return true;

    if (!(await this.grantActive(user.grantId))) {
      throw new UnauthorizedException("Support access has ended or was revoked");
    }
    if (user.accessLevel !== "full" && isReadOnlyBlocked(req.method, req.originalUrl ?? req.url)) {
      throw new ForbiddenException("Read-only support access: changes are not allowed");
    }
    return true;
  }

  private async grantActive(grantId: string): Promise<boolean> {
    const now = Date.now();
    const hit = this.cache.get(grantId);
    if (hit && hit.expiresAt > now) return hit.active;
    const grant = await this.prisma.tenantAccessGrant.findUnique({
      where: { id: grantId },
      select: { status: true, expiresAt: true },
    });
    const active = Boolean(
      grant && grant.status === "active" && grant.expiresAt && grant.expiresAt.getTime() > now,
    );
    if (this.cache.size > 5_000) this.cache.clear();
    this.cache.set(grantId, { active, expiresAt: now + CACHE_TTL_MS });
    return active;
  }
}
