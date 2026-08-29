import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { LoyaltyService } from "./loyalty.service";

@Controller("loyalty")
export class LoyaltyController {
  constructor(private service: LoyaltyService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post("tiers")
  @RequireModule("loyalty")
  createTier(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.createTier(orgId, body as never);
  }

  @Post("customers/:customerId/stamp")
  @RequireModule("loyalty")
  addStamp(@OrgId() orgId: string, @Param("customerId") customerId: string) {
    return this.service.addStamp(orgId, customerId);
  }

  @Post("customers/:customerId/redeem-stamps")
  @RequireModule("loyalty")
  redeemStamps(@OrgId() orgId: string, @Param("customerId") customerId: string) {
    return this.service.redeemStamps(orgId, customerId);
  }
}
