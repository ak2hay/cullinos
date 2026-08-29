import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { AuditService } from "./audit.service";

@Controller("audit")
export class AuditController {
  constructor(private service: AuditService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
