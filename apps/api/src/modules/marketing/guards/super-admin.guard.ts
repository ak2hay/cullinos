import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../../../common/decorators";

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

    try {
      const token = authHeader.slice(7);
      const payload = this.jwt.verify(token, {
        secret: process.env.JWT_SECRET || "dev-secret",
      }) as { isSuperAdmin?: boolean };
      request.user = payload;
      if (!payload.isSuperAdmin) {
        throw new ForbiddenException("Super admin access required");
      }
      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new UnauthorizedException("Invalid token");
    }
  }
}
