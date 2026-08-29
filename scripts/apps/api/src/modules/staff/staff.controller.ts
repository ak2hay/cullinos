import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { StaffService } from "./staff.service";

@Controller("staff")
export class StaffController {
  constructor(private service: StaffService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
