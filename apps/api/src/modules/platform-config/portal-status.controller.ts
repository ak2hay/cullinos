import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators";
import { AllowDisabledPortal } from "../../common/portal-context";
import { PortalStatusService } from "./portal-status.service";

@Controller("public")
export class PortalStatusController {
  constructor(private readonly portalStatus: PortalStatusService) {}

  @Public()
  @AllowDisabledPortal()
  @Get("portal-status")
  getPortalStatus() {
    return this.portalStatus.getStatus();
  }
}
