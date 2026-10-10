import { Body, Controller, Get, Put } from "@nestjs/common";
import type { JwtPayload } from "@cullinos/auth";
import { CurrentUser, OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { RefundPinService } from "./refund-pin.service";

@Controller("me/refund-pin")
@RequirePermissions("order:refund")
export class RefundPinController {
  constructor(private service: RefundPinService) {}

  @Get()
  status(@OrgId() orgId: string, @CurrentUser() user: JwtPayload) {
    return this.service.status(orgId, user.sub);
  }

  @Put()
  set(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { currentPassword?: string; pin?: string },
  ) {
    return this.service.setPin(orgId, user.sub, body?.currentPassword, body?.pin);
  }
}
