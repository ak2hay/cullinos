import { Body, Controller, Get, Patch } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
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

  @Get("settings")
  @RequireModule("settings")
  getSettings(@OrgId() orgId: string) {
    return this.service.getSettings(orgId);
  }

  @Patch("settings")
  @RequireModule("settings")
  updateSettings(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.updateSettings(orgId, body);
  }

  @Patch("current")
  @RequireModule("settings")
  updateCurrent(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.update(orgId, body);
  }
}
