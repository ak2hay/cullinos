import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RolesService } from "./roles.service";

@Controller("roles")
export class RolesController {
  constructor(private service: RolesService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
