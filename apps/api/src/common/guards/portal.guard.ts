import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PortalStatusService } from "../../modules/platform-config/portal-status.service";
import {
  ALLOW_DISABLED_PORTAL_KEY,
  PORTAL_HEADER,
  parsePortal,
} from "../portal-context";

/**
 * Blocks requests from a portal that super admin switched off platform-wide.
 * The portal comes from the X-Cullinos-Portal header, or from the `portal` claim
 * stamped into the JWT at sign-in (so sessions stay tied to their portal).
 * Must run after JwtAuthGuard so `request.user` is populated.
 */
@Injectable()
export class PortalGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly portalStatus: PortalStatusService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") return true;

    const allow = this.reflector.getAllAndOverride<boolean>(ALLOW_DISABLED_PORTAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allow) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { isSuperAdmin?: boolean; portal?: unknown } | undefined;
    if (user?.isSuperAdmin) return true;

    const portal = parsePortal(request.headers?.[PORTAL_HEADER]) ?? parsePortal(user?.portal);
    if (!portal) return true;

    const status = await this.portalStatus.getStatus();
    if (status.portals[portal].enabled) return true;

    throw new ServiceUnavailableException({
      code: "PORTAL_DISABLED",
      message: status.message,
      details: { portal },
    });
  }
}
