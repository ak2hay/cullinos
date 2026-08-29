import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { FEATURES } from '@cullinos/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateInsightDto, ListInsightsQueryDto } from './dto/insights.dto';
import { InsightsService } from './insights.service';

@Controller('insights')
@UseGuards(JwtAuthGuard, FeatureGuard)
@RequireFeature(FEATURES.ADVANCED_ANALYTICS)
export class InsightsController {
  constructor(private insightsService: InsightsService) {}

  @Get()
  list(@CurrentUser('organizationId') orgId: string, @Query() query: ListInsightsQueryDto) {
    return this.insightsService.list(orgId, query);
  }

  @Post()
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateInsightDto) {
    return this.insightsService.create(orgId, dto);
  }
}
