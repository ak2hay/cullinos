import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { ANY_PLATFORM_STAFF, PLATFORM_PERMISSIONS_KEY } from "./decorators";
import { isPlatformRole, permissionsForPlatformRole } from "./platform-permissions";
import type { ScopedGrant } from "../modules/platform-iam/platform-access.util";

type PlatformUser = { isSuperAdmin?: boolean; platformRole?: string } | undefined;

export type PlatformAccessView = {
  isOwner: boolean;
  global: readonly string[];
  scoped: readonly ScopedGrant[];
};

export type PlatformAccessDecision = {
  required: string[] | undefined;
  /** Set when only region / tenant-set scoped grants cover the route. */
  scopedOnly: ScopedGrant[] | null;
};

function accessFromRole(role: string | undefined): PlatformAccessView {
  return { isOwner: role === "owner", global: permissionsForPlatformRole(role), scoped: [] };
}

/**
 * Enforces platform staff permissions on a /super-admin route. Permissions come from the
 * database-resolved access (primary role + role assignments); without it, from the signed
 * role claim. Forged `platformPermissions` claims are never trusted.
 */
export function assertPlatformAccess(
  reflector: Reflector,
  context: ExecutionContext,
  user: PlatformUser,
  access?: PlatformAccessView,
): PlatformAccessDecision {
  if (!user?.isSuperAdmin) {
    throw new ForbiddenException("Super admin access required");
  }
  if (!isPlatformRole(user.platformRole)) {
    // Tokens issued before platform roles existed: force a refresh that adds the claim.
    throw new UnauthorizedException("Platform session is outdated, sign in again");
  }
  const view = access ?? accessFromRole(user.platformRole);

  const required = reflector.getAllAndOverride<string[] | undefined>(PLATFORM_PERMISSIONS_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (!required || required.length === 0) {
    if (!view.isOwner) {
      throw new ForbiddenException("Owner access required");
    }
    return { required, scopedOnly: null };
  }

  if (required.includes(ANY_PLATFORM_STAFF) || required.some((p) => view.global.includes(p))) {
    return { required, scopedOnly: null };
  }
  const scoped = view.scoped.filter((g) => required.some((p) => g.permissions.includes(p)));
  if (scoped.length) return { required, scopedOnly: scoped };
  throw new ForbiddenException("Your platform access does not allow this action");
}
