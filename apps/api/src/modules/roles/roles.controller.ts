import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { RolesService } from "./roles.service";

@Controller("roles")
@RequirePermissions("staff:read", "org:manage_users")
export class RolesController {
  constructor(private service: RolesService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
