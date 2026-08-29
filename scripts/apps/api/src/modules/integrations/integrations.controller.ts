import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { IntegrationsService } from "./integrations.service";

@Controller("integrations")
export class IntegrationsController {
  constructor(private service: IntegrationsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
