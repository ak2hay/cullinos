import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FeatureGuard } from '../../common/guards/feature.guard';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

@Module({
  imports: [PrismaModule],
  controllers: [InsightsController],
  providers: [InsightsService, FeatureGuard],
  exports: [InsightsService],
})
export class InsightsModule {}
