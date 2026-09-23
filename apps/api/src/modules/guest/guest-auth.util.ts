import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { getJwtSecret } from "../../common/jwt-secret.util";

export const IS_GUEST_KEY = "isGuest";
export const GuestAuth = () => SetMetadata(IS_GUEST_KEY, true);

export type GuestJwtPayload = {
  sub: string;
  type: "guest";
  phone: string;
};

export const CurrentGuest = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GuestJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.guest;
  },
);

@Injectable()
export class GuestAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(IS_GUEST_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing guest token");
    }

    try {
      const payload = this.jwt.verify(authHeader.slice(7), {
        secret: getJwtSecret(),
      }) as GuestJwtPayload;
      if (payload.type !== "guest" || !payload.sub) {
        throw new UnauthorizedException("Not a guest token");
      }
      request.guest = payload;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException("Invalid guest token");
    }
  }
}

export function verifyGuestToken(
  jwt: JwtService,
  auth: string | undefined,
): GuestJwtPayload {
  if (!auth?.startsWith("Bearer ")) {
    throw new UnauthorizedException("Missing guest token");
  }
  try {
    const payload = jwt.verify(auth.slice(7), {
      secret: getJwtSecret(),
    }) as GuestJwtPayload;
    if (payload.type !== "guest" || !payload.sub) {
      throw new UnauthorizedException("Not a guest token");
    }
    return payload;
  } catch (err) {
    if (err instanceof UnauthorizedException) throw err;
    throw new UnauthorizedException("Invalid guest token");
  }
}
