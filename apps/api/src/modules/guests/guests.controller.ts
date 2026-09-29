import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { GuestsService } from "./guests.service";

@Controller("guests")
@RequirePermissions("customer:read")
export class GuestsController {
  constructor(private service: GuestsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
