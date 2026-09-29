import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { KotService } from "./kot.service";

@Controller("kot")
@RequirePermissions("kitchen:read", "order:read")
export class KotController {
  constructor(private service: KotService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
