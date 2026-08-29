import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureKey, PLAN_FEATURES } from '@cullinos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<FeatureKey[]>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const organizationId = request.user?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Organization context required');
    }

    const entitled = await this.getOrganizationFeatures(organizationId);
    const hasFeature = required.some((f) => entitled.includes(f));
    if (!hasFeature) {
      throw new ForbiddenException(`Feature not available on current plan: ${required.join(', ')}`);
    }
    return true;
  }

  async getOrganizationFeatures(organizationId: string): Promise<FeatureKey[]> {
    const subscription = await this.prisma.client.organizationSubscription.findUnique({
      where: { organizationId },
      include: {
        plan: { include: { planFeatures: true } },
      },
    });

    if (!subscription || subscription.status !== 'ACTIVE') {
      return [];
    }

    if (subscription.plan.planFeatures.length > 0) {
      return subscription.plan.planFeatures.map((pf) => pf.featureKey as FeatureKey);
    }

    const planKey = subscription.plan.key.toUpperCase();
    return PLAN_FEATURES[planKey] ?? [];
  }
}
