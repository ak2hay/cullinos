import { Body, Controller, Get, Post } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { SaasBillingService } from "./saas-billing.service";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private saas: SaasBillingService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.saas.listForOrg(orgId);
  }

  @Get("current")
  current(@OrgId() orgId: string) {
    return this.saas.currentForOrg(orgId);
  }

  @Post("checkout")
  checkout(@OrgId() orgId: string, @Body() _body: Record<string, unknown>) {
    return this.saas.collectPayment(orgId);
  }
}
