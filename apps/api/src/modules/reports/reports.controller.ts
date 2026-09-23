import { Controller, Get, Query } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get()
  @RequirePermissions("reports:read")
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("smb-summary")
  @RequireModule("reports")
  @RequirePermissions("reports:read")
  smbSummary(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("date") date?: string,
  ) {
    return this.service.smbSummary(orgId, outletId, date);
  }

  @Get("export")
  @RequireModule("reports")
  @RequirePermissions("reports:export", "reports:read")
  export(
    @OrgId() orgId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("outletId") outletId?: string,
  ) {
    return this.service.export(orgId, from, to, outletId);
  }

  @Get("items")
  @RequireModule("reports")
  @RequirePermissions("reports:read")
  itemWise(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.itemWiseSummary(orgId, { outletId, from, to });
  }

  @Get("categories")
  @RequireModule("reports")
  @RequirePermissions("reports:read")
  categories(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.categorySummary(orgId, { outletId, from, to });
  }

  @Get("payment-methods")
  @RequireModule("reports")
  @RequirePermissions("reports:read")
  paymentMethods(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.paymentMethodSummary(orgId, { outletId, from, to });
  }

  @Get("discounts")
  @RequireModule("reports")
  @RequirePermissions("reports:read")
  discounts(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.discountSummary(orgId, { outletId, from, to });
  }

  @Get("cancellations")
  @RequireModule("reports")
  @RequirePermissions("reports:read")
  cancellations(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.cancellationSummary(orgId, { outletId, from, to });
  }

  @Get("food-cost")
  @RequireModule("reports")
  @RequirePermissions("reports:read")
  foodCost(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.foodCost(orgId, { outletId, from, to });
  }

  @Get("tax-collection")
  @RequireModule("reports")
  @RequirePermissions("reports:read")
  taxCollection(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.taxCollection(orgId, { outletId, from, to });
  }

  @Get("sales-by-tax-group")
  @RequireModule("reports")
  @RequirePermissions("reports:read")
  salesByTaxGroup(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.salesByTaxGroup(orgId, { outletId, from, to });
  }
}
