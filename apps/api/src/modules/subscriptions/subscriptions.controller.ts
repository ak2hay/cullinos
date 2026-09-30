import { Body, Controller, Get, Post } from "@nestjs/common";
import { OrgId, Public } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { SaasBillingService } from "./saas-billing.service";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private saas: SaasBillingService) {}

  @Get()
  @RequirePermissions("org:manage_settings", "settings:read")
  list(@OrgId() orgId: string) {
    return this.saas.listForOrg(orgId);
  }

  @Get("current")
  @RequirePermissions("org:manage_settings", "settings:read")
  current(@OrgId() orgId: string) {
    return this.saas.currentForOrg(orgId);
  }

  @Public()
  @Get("plans")
  plans() {
    return this.saas.listActivePlans();
  }

  @Post("checkout")
  @RequirePermissions("org:manage_settings")
  checkout(@OrgId() orgId: string, @Body() _body: Record<string, unknown>) {
    return this.saas.collectPayment(orgId);
  }

  @Post("activate-plan")
  @RequirePermissions("org:manage_settings")
  activatePlan(@OrgId() orgId: string, @Body() body: { planSlug: string }) {
    return this.saas.activatePlan(orgId, body.planSlug);
  }
}
