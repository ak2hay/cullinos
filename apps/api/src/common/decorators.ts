import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import type { JwtPayload } from "@cullinos/auth";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

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
    return request.user?.organizationId;
  }
);
