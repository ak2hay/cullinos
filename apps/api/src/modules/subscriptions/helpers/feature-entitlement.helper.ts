import { FeatureKey, PLAN_FEATURES } from '@cullinos/shared';
import { PrismaService } from '../../../prisma/prisma.service';

export class FeatureEntitlementHelper {
  constructor(private prisma: PrismaService) {}

  async getPlanFeatures(organizationId: string): Promise<FeatureKey[]> {
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
      return subscription.plan.planFeatures.map((pf: { featureKey: string }) => pf.featureKey as FeatureKey);
    }

    const planKey = subscription.plan.key.toUpperCase();
    return PLAN_FEATURES[planKey] ?? [];
  }

  async hasFeature(organizationId: string, feature: FeatureKey): Promise<boolean> {
    const features = await this.getPlanFeatures(organizationId);
    return features.includes(feature);
  }

  async hasAnyFeature(organizationId: string, features: FeatureKey[]): Promise<boolean> {
    const entitled = await this.getPlanFeatures(organizationId);
    return features.some((f) => entitled.includes(f));
  }

  async getSubscriptionLimits(organizationId: string) {
    const subscription = await this.prisma.client.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (!subscription) {
      return null;
    }

    const [outletCount, userCount, deviceCount] = await Promise.all([
      this.prisma.client.outlet.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.client.user.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.client.device.count({
        where: { organizationId, isActive: true },
      }),
    ]);

    return {
      plan: subscription.plan,
      status: subscription.status,
      usage: {
        outlets: { current: outletCount, max: subscription.plan.maxOutlets },
        users: { current: userCount, max: subscription.plan.maxUsers },
        terminals: { current: deviceCount, max: subscription.plan.maxTerminals },
      },
      startsAt: subscription.startsAt,
      endsAt: subscription.endsAt,
      trialEndsAt: subscription.trialEndsAt,
    };
  }
}
