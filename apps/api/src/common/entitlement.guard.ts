import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../prisma/prisma.service";
import { REQUIRE_MODULE_KEY } from "./decorators";

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const module = this.reflector.getAllAndOverride<string>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!module) return true;

    const request = context.switchToHttp().getRequest();
    const orgId = request.user?.organizationId;
    if (!orgId) return false;

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (org?.status === "suspended") {
      throw new ForbiddenException("Organization suspended");
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId: orgId, status: { in: ["active", "trial"] } },
      include: { entitlements: true },
    });

    if (!subscription) {
      throw new ForbiddenException("No active subscription");
    }

    const entitled = subscription.entitlements.some(
      (e) => e.module === module && e.enabled
    );
    if (!entitled) {
      throw new ForbiddenException(`Module not entitled: ${module}`);
    }

    return true;
  }
}
