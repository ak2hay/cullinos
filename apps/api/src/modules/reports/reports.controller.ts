import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FEATURES } from '@cullinos/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, FeatureGuard)
@RequireFeature(FEATURES.BASIC_REPORTS)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('sales')
  sales(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.salesReport(orgId, query);
  }

  @Get('items')
  items(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.itemReport(orgId, query);
  }

  @Get('categories')
  categories(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.categoryReport(orgId, query);
  }

  @Get('outlets')
  outlets(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.outletReport(orgId, query);
  }

  @Get('employees')
  employees(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.employeeReport(orgId, query);
  }

  @Get('payments')
  payments(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.paymentReport(orgId, query);
  }

  @Get('tax')
  tax(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.taxReport(orgId, query);
  }

  @Get('inventory')
  inventory(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.inventoryReport(orgId, query);
  }

  @Get('kitchen')
  kitchen(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.kitchenReport(orgId, query);
  }

  @Get('delivery')
  delivery(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.deliveryReport(orgId, query);
  }

  @Get('wastage')
  wastage(@CurrentUser('organizationId') orgId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.wastageReport(orgId, query);
  }
}
