import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { ReportsService } from "./reports.service";

@Controller("reports")
export class ReportsController {
  constructor(private service: ReportsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
