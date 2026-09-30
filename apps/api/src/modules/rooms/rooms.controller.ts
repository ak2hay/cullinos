import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { RoomsService } from "./rooms.service";

@Controller("rooms")
@RequirePermissions("outlet:read", "order:read")
export class RoomsController {
  constructor(private service: RoomsService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
