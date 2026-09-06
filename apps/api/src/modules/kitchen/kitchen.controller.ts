import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
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

  @Patch("items/:id/status")
  updateItemStatus(
    @Param("id") id: string,
    @Body() body: { status?: string },
  ) {
    return this.service.updateItemStatus(id, body.status ?? "");
  }
}
