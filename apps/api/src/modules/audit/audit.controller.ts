import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { AuditService } from "./audit.service";

@Controller("audit")
@RequirePermissions("org:manage_settings", "staff:manage")
export class AuditController {
  constructor(private service: AuditService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
