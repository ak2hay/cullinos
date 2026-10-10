import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import type { JwtPayload } from "@cullinos/auth";
import type { PlatformPermission } from "./platform-permissions";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Platform staff permission for a /super-admin route (any one of the listed ones).
 * Undecorated /super-admin routes are Owner-only.
 */
export const PLATFORM_PERMISSIONS_KEY = "platformPermissions";
export const RequirePlatformPermission = (...permissions: PlatformPermission[]) =>
  SetMetadata(PLATFORM_PERMISSIONS_KEY, permissions);

/** Any active platform staff member (own inbox, notifications, profile-level data). */
export const ANY_PLATFORM_STAFF = "*";
export const AnyPlatformStaff = () => SetMetadata(PLATFORM_PERMISSIONS_KEY, [ANY_PLATFORM_STAFF]);

/**
 * Lets staff whose permission only comes from a region / tenant-set scoped role use the
 * route. `param`/`query` name the organization id; `list` means the handler filters
 * results itself via `request.platformScope`.
 */
export const PLATFORM_SCOPE_KEY = "platformScope";
export type PlatformScopeSpec = { source: "param" | "query" | "list"; name?: string };
export const PlatformScope = (source: PlatformScopeSpec["source"], name = "id") =>
  SetMetadata(PLATFORM_SCOPE_KEY, { source, name } satisfies PlatformScopeSpec);

/** Excludes a high-frequency, non-sensitive route (polling) from the staff activity log. */
export const SKIP_ACTIVITY_LOG_KEY = "skipActivityLog";
export const SkipActivityLog = () => SetMetadata(SKIP_ACTIVITY_LOG_KEY, true);

/**
 * Maker-checker: when an active approval policy exists for `actionKey`, the first call
 * creates an approval request (HTTP 202) and the action only runs when replayed with an
 * approved `X-Approval-Id`. `sensitiveBody` stores the body encrypted and hides it.
 */
export const REQUIRES_APPROVAL_KEY = "requiresApproval";
export type RequiresApprovalSpec = { actionKey: string; title: string; sensitiveBody?: boolean };
export const RequiresApproval = (
  actionKey: string,
  title: string,
  options: { sensitiveBody?: boolean } = {},
) =>
  SetMetadata(REQUIRES_APPROVAL_KEY, {
    actionKey,
    title,
    ...options,
  } satisfies RequiresApprovalSpec);

/** Route that issues step-up codes itself and must not demand one. */
export const SKIP_STEP_UP_KEY = "skipStepUp";
export const SkipStepUp = () => SetMetadata(SKIP_STEP_UP_KEY, true);

export const REQUIRE_MODULE_KEY = "requireModule";
export const RequireModule = (module: string) => SetMetadata(REQUIRE_MODULE_KEY, module);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);

export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const orgId = request.user?.organizationId;
    // An undefined orgId makes Prisma drop the tenant filter entirely.
    if (typeof orgId !== "string" || !orgId) {
      throw new UnauthorizedException("Organization context required");
    }
    return orgId;
  }
);
