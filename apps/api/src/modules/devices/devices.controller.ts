import { Body, Controller, Get, Post } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { DevicesService } from "./devices.service";

@Controller("devices")
export class DevicesController {
  constructor(private service: DevicesService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post()
  create(
    @OrgId() orgId: string,
    @Body()
    body: {
      name: string;
      type: string;
      outletId?: string;
      identifier?: string;
    },
  ) {
    return this.service.create(orgId, body);
  }
}
