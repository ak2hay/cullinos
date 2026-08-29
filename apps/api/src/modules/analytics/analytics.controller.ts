import { Controller, Get, Query } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("daily")
  @RequireModule("analytics")
  daily(
    @OrgId() orgId: string,
    @Query("date") date?: string,
    @Query("outletId") outletId?: string,
  ) {
    return this.service.daily(orgId, { date, outletId });
  }

  @Get("outlet-comparison")
  @RequireModule("analytics")
  outletComparison(
    @OrgId() orgId: string,
    @Query("date") date?: string,
    @Query("brandId") brandId?: string,
  ) {
    return this.service.outletComparison(orgId, { date, brandId });
  }
}
