import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { DevicesService } from "./devices.service";

@Controller("devices")
export class DevicesController {
  constructor(private service: DevicesService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
