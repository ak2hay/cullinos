import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { LoyaltyService } from "./loyalty.service";

@Controller("loyalty")
export class LoyaltyController {
  constructor(private service: LoyaltyService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
