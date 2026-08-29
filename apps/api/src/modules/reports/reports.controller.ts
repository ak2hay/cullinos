import { Controller, Get, Query } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("smb-summary")
  @RequireModule("reports")
  smbSummary(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("date") date?: string,
  ) {
    return this.service.smbSummary(orgId, outletId, date);
  }
}
