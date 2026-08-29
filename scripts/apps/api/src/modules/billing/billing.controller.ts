import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { BillingService } from "./billing.service";

@Controller("billing")
export class BillingController {
  constructor(private service: BillingService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
