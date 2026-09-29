import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { BillingService } from "./billing.service";

@Controller("billing")
@RequirePermissions("org:manage_settings", "settings:read")
export class BillingController {
  constructor(private service: BillingService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
