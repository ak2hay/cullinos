import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { InsightsService } from "./insights.service";

@Controller("insights")
@RequirePermissions("reports:read")
export class InsightsController {
  constructor(private service: InsightsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
