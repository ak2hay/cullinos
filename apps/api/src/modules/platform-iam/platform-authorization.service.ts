import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import {
  ANY_PLATFORM_STAFF,
  PLATFORM_SCOPE_KEY,
  SKIP_STEP_UP_KEY,
  type PlatformScopeSpec,
} from "../../common/decorators";
import { clientIp } from "../../common/client-ip.util";
import { assertPlatformAccess } from "../../common/platform-access.util";
import { isPlatformRole, permissionRisk } from "../../common/platform-permissions";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformAccessService } from "./platform-access.service";
import {
  IpNotAllowedError,
  grantCoversOrg,
  ipMatchesAllowlist,
  type EffectiveAccess,
  type ScopedGrant,
} from "./platform-access.util";
import { PlatformSecuritySettingsService } from "./platform-security-settings.service";

export const STEP_UP_HEADER = "x-step-up-token";
const STEP_UP_SCOPES = new Set(["platform", "labs_sql"]);

type PlatformRequest = {
  method?: string;
  ip?: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  user?: { sub?: string; isSuperAdmin?: boolean; platformRole?: string };
  platformAccess?: EffectiveAccess;
  platformScope?: ScopedGrant[] | null;
  platformAuthorized?: boolean;
};

/**
 * One place that decides whether a platform staff request may proceed: database-resolved
 * permissions, IP allowlists, region / tenant-set scope and step-up for critical writes.
 * Both super-admin guards delegate here; the result is memoised on the request.
 */
@Injectable()
export class PlatformAuthorizationService {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private prisma: PrismaService,
    private access: PlatformAccessService,
    private security: PlatformSecuritySettingsService,
  ) {}

  async authorize(context: ExecutionContext, request: PlatformRequest): Promise<void> {
    if (request.platformAuthorized) return;
    const user = request.user;
    if (!user?.isSuperAdmin) throw new ForbiddenException("Super admin access required");
    if (!isPlatformRole(user.platformRole) || !user.sub) {
      throw new UnauthorizedException("Platform session is outdated, sign in again");
    }

    const ip = clientIp(request as never);
    const settings = await this.security.get();
    if (!ipMatchesAllowlist(ip, settings.globalIpAllowlist)) {
      throw new ForbiddenException({ code: "IP_NOT_ALLOWED", message: new IpNotAllowedError().message });
    }

    let access: EffectiveAccess | null;
    try {
      access = await this.access.resolve(user.sub, ip);
    } catch (err) {
      if (err instanceof IpNotAllowedError) {
        throw new ForbiddenException({ code: "IP_NOT_ALLOWED", message: err.message });
      }
      throw err;
    }
    if (!access) throw new ForbiddenException("Super admin access required");

    const decision = assertPlatformAccess(this.reflector, context, user, access);
    if (decision.scopedOnly) {
      await this.enforceScope(context, request, decision.scopedOnly);
    } else {
      request.platformScope = null;
    }

    if (settings.stepUpCritical) {
      this.enforceStepUp(context, request, decision.required, access);
    }

    request.platformAccess = access;
    request.platformAuthorized = true;
  }

  private async enforceScope(
    context: ExecutionContext,
    request: PlatformRequest,
    grants: ScopedGrant[],
  ) {
    const spec = this.reflector.getAllAndOverride<PlatformScopeSpec | undefined>(
      PLATFORM_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!spec) {
      throw new ForbiddenException("Your access to this action is limited to specific tenants");
    }
    if (spec.source === "list") {
      request.platformScope = grants;
      return;
    }
    const raw =
      spec.source === "param" ? request.params?.[spec.name ?? "id"] : request.query?.[spec.name ?? "id"];
    const orgId = typeof raw === "string" ? raw : "";
    if (!orgId) {
      throw new ForbiddenException("Your access to this action is limited to specific tenants");
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, state: true },
    });
    if (!org || !grants.some((g) => grantCoversOrg(g, org))) {
      throw new ForbiddenException("This tenant is outside your assigned scope");
    }
    request.platformScope = grants;
  }

  private enforceStepUp(
    context: ExecutionContext,
    request: PlatformRequest,
    required: string[] | undefined,
    access: EffectiveAccess,
  ) {
    const method = (request.method ?? "GET").toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip || required?.includes(ANY_PLATFORM_STAFF)) return;
    // Owner-only (undecorated) routes are treated as critical.
    const held = required?.length
      ? required.filter((p) => access.global.includes(p) || access.scoped.some((g) => g.permissions.includes(p)))
      : ["__owner__"];
    const critical = held.every((p) => p === "__owner__" || permissionRisk(p) === "critical");
    if (!critical) return;

    const header = request.headers[STEP_UP_HEADER];
    const token = Array.isArray(header) ? header[0] : header;
    if (token) {
      try {
        const payload = this.jwt.verify<{ sub?: string; type?: string; scope?: string }>(token);
        if (
          payload.type === "step_up" &&
          payload.sub === request.user?.sub &&
          STEP_UP_SCOPES.has(String(payload.scope))
        ) {
          return;
        }
      } catch {
        /* fall through */
      }
    }
    throw new ForbiddenException({
      code: "STEP_UP_REQUIRED",
      message: "Confirm with an emailed code to perform this critical action",
    });
  }
}
