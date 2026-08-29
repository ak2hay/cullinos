import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { InsightsService } from "./insights.service";

@Controller("insights")
export class InsightsController {
  constructor(private service: InsightsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
