import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FEATURES } from '@cullinos/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, DailyDashboardQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, FeatureGuard)
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('executive')
  @RequireFeature(FEATURES.ADVANCED_ANALYTICS)
  executive(@CurrentUser('organizationId') orgId: string, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.executiveDashboard(orgId, query);
  }

  @Get('daily')
  @RequireFeature(FEATURES.BASIC_REPORTS)
  daily(@CurrentUser('organizationId') orgId: string, @Query() query: DailyDashboardQueryDto) {
    return this.analyticsService.dailyDashboard(orgId, query);
  }
}
