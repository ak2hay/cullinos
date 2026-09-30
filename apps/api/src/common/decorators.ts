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
