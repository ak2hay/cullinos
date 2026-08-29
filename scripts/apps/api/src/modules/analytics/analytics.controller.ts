import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
