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
  @RequireModule("reports")
  daily(
    @OrgId() orgId: string,
    @Query("date") date?: string,
    @Query("outletId") outletId?: string,
  ) {
    return this.service.daily(orgId, { date, outletId });
  }

  @Get("trend")
  @RequireModule("reports")
  trend(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("days") days?: string,
  ) {
    return this.service.trend(orgId, {
      outletId,
      days: days ? parseInt(days, 10) : 7,
    });
  }

  @Get("outlet-comparison")
  @RequireModule("analytics")
  outletComparison(
    @OrgId() orgId: string,
    @Query("date") date?: string,
    @Query("brandId") brandId?: string,
    @Query("city") city?: string,
    @Query("zone") zone?: string,
    @Query("state") state?: string,
  ) {
    return this.service.outletComparison(orgId, {
      date,
      brandId,
      city,
      zone,
      state,
    });
  }

  @Get("outlet-geo-filters")
  @RequireModule("analytics")
  outletGeoFilters(
    @OrgId() orgId: string,
    @Query("brandId") brandId?: string,
  ) {
    return this.service.outletGeoFilters(orgId, brandId);
  }
}
