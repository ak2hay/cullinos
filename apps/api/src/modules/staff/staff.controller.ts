import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { StaffService } from "./staff.service";

@Controller("staff")
@RequirePermissions("staff:read")
export class StaffController {
  constructor(private service: StaffService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
