import { Controller, Get, Param } from "@nestjs/common";
import { OrgId, Public } from "../../common/decorators";
import { KitchenService } from "./kitchen.service";

@Controller("kitchen")
export class KitchenController {
  constructor(private service: KitchenService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("outlets/:outletId/display")
  @Public()
  getOutletDisplay(@Param("outletId") outletId: string) {
    return this.service.getOutletDisplay(outletId);
  }
}
