import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FeatureKey } from '@cullinos/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('current')
  current(@CurrentUser('organizationId') orgId: string) {
    return this.subscriptionsService.getCurrentSubscription(orgId);
  }

  @Get('plans')
  plans() {
    return this.subscriptionsService.listPlans();
  }

  @Get('features/:feature')
  checkFeature(
    @CurrentUser('organizationId') orgId: string,
    @Param('feature') feature: FeatureKey,
  ) {
    return this.subscriptionsService.checkFeatureEntitlement(orgId, feature);
  }
}
