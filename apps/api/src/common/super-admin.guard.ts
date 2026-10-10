import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./decorators";
import { PlatformAuthorizationService } from "../modules/platform-iam/platform-authorization.service";

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authz: PlatformAuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const path: string = request.path ?? request.url ?? "";
    if (!path.includes("/super-admin")) return true;

    await this.authz.authorize(context, request);
    return true;
  }
}
