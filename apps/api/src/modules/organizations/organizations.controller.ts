import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { OrganizationsService } from "./organizations.service";

@Controller("organizations")
export class OrganizationsController {
  constructor(private service: OrganizationsService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("current")
  current(@OrgId() orgId: string) {
    return this.service.get(orgId);
  }
}
