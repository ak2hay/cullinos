import { Injectable, NotFoundException } from '@nestjs/common';
import { FeatureKey } from '@cullinos/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureEntitlementHelper } from './helpers/feature-entitlement.helper';

@Injectable()
export class SubscriptionsService {
  private entitlement: FeatureEntitlementHelper;

  constructor(private prisma: PrismaService) {
    this.entitlement = new FeatureEntitlementHelper(prisma);
  }

  getEntitlementHelper(): FeatureEntitlementHelper {
    return this.entitlement;
  }

  async getCurrentSubscription(organizationId: string) {
    const subscription = await this.prisma.client.organizationSubscription.findUnique({
      where: { organizationId },
      include: {
        plan: { include: { planFeatures: true } },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    const features = await this.entitlement.getPlanFeatures(organizationId);
    const limits = await this.entitlement.getSubscriptionLimits(organizationId);

    return {
      id: subscription.id,
      status: subscription.status,
      plan: {
        id: subscription.plan.id,
        key: subscription.plan.key,
        name: subscription.plan.name,
        description: subscription.plan.description,
        priceMonthly: subscription.plan.priceMonthly,
        priceYearly: subscription.plan.priceYearly,
        features,
      },
      startsAt: subscription.startsAt,
      endsAt: subscription.endsAt,
      trialEndsAt: subscription.trialEndsAt,
      limits: limits?.usage,
    };
  }

  async listPlans() {
    const plans = await this.prisma.client.plan.findMany({
      where: { isActive: true },
      include: { planFeatures: true },
      orderBy: { priceMonthly: 'asc' },
    });

    return plans.map((plan) => ({
      id: plan.id,
      key: plan.key,
      name: plan.name,
      description: plan.description,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      maxOutlets: plan.maxOutlets,
      maxUsers: plan.maxUsers,
      maxTerminals: plan.maxTerminals,
      features: plan.planFeatures.map((pf) => pf.featureKey),
    }));
  }

  async checkFeatureEntitlement(organizationId: string, feature: FeatureKey) {
    const entitled = await this.entitlement.hasFeature(organizationId, feature);
    return {
      feature,
      entitled,
    };
  }
}
