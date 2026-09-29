import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../../../common/decorators";
import { verifyStaffAccessToken } from "../../../common/access-token.util";
import { assertPlatformAccess } from "../../../common/platform-access.util";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing token");
    }

    const payload = verifyStaffAccessToken(this.jwt, authHeader.slice(7));
    if (!payload) throw new UnauthorizedException("Invalid token");
    request.user = payload;
    assertPlatformAccess(this.reflector, context, payload);
    return true;
  }
}
