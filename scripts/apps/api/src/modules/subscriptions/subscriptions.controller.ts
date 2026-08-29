import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { SubscriptionsService } from "./subscriptions.service";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private service: SubscriptionsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
