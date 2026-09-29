import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { PLATFORM_PERMISSIONS_KEY } from "./decorators";
import { isPlatformRole, permissionsForPlatformRole } from "./platform-permissions";

type PlatformUser = { isSuperAdmin?: boolean; platformRole?: string } | undefined;

/**
 * Enforces platform staff role permissions on a /super-admin route. Permissions are
 * derived from the signed role claim, so catalog changes apply without re-login.
 */
export function assertPlatformAccess(
  reflector: Reflector,
  context: ExecutionContext,
  user: PlatformUser,
): void {
  if (!user?.isSuperAdmin) {
    throw new ForbiddenException("Super admin access required");
  }
  if (!isPlatformRole(user.platformRole)) {
    // Tokens issued before platform roles existed: force a refresh that adds the claim.
    throw new UnauthorizedException("Platform session is outdated, sign in again");
  }

  const required = reflector.getAllAndOverride<string[] | undefined>(PLATFORM_PERMISSIONS_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (!required || required.length === 0) {
    if (user.platformRole !== "owner") {
      throw new ForbiddenException("Owner access required");
    }
    return;
  }

  const granted: string[] = permissionsForPlatformRole(user.platformRole);
  if (!required.some((p) => granted.includes(p))) {
    throw new ForbiddenException("Your platform role does not allow this action");
  }
}
