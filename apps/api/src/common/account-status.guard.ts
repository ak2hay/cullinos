import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { IS_PUBLIC_KEY } from "./decorators";

const CACHE_TTL_MS = 30_000;
const BLOCKED_ORG_STATUSES = new Set(["suspended", "cancelled"]);

type StatusVerdict = "ok" | "user_inactive" | "token_revoked" | "org_blocked";

/**
 * Re-checks the signed-in staff user and their organization on every request, so a
 * deactivated user, revoked session (token version bump) or suspended tenant loses
 * access within CACHE_TTL_MS instead of at access-token expiry.
 */
@Injectable()
export class AccountStatusGuard implements CanActivate {
  private cache = new Map<string, { verdict: StatusVerdict; expiresAt: number }>();

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { sub?: string; organizationId?: string; tv?: number }
      | undefined;
    if (!user?.sub || !user.organizationId) return true;

    const verdict = await this.verdictFor(user.sub, user.organizationId, user.tv ?? 0);
    if (verdict === "user_inactive") throw new UnauthorizedException("Account is not active");
    if (verdict === "token_revoked") throw new UnauthorizedException("Session revoked");
    if (verdict === "org_blocked") throw new ForbiddenException("Organization suspended");
    return true;
  }

  async verdictFor(
    userId: string,
    organizationId: string,
    tokenVersion = 0,
  ): Promise<StatusVerdict> {
    const key = `${userId}:${organizationId}:${tokenVersion}`;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) return cached.verdict;

    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        isSuperAdmin: true,
        organizationId: true,
        tokenVersion: true,
        organization: { select: { status: true } },
      },
    });

    let verdict: StatusVerdict = "ok";
    if (!row || row.status !== "active") {
      verdict = "user_inactive";
    } else if (row.tokenVersion !== tokenVersion) {
      verdict = "token_revoked";
    } else if (
      !row.isSuperAdmin &&
      (row.organizationId !== organizationId ||
        BLOCKED_ORG_STATUSES.has(String(row.organization?.status)))
    ) {
      verdict = "org_blocked";
    }

    if (this.cache.size > 10_000) this.cache.clear();
    this.cache.set(key, { verdict, expiresAt: now + CACHE_TTL_MS });
    return verdict;
  }
}
