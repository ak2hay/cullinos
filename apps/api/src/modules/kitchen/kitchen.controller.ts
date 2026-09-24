import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { KitchenService } from "./kitchen.service";
import { UpdateKitchenItemStatusDto } from "./dto/kitchen.dto";

@Controller("kitchen")
export class KitchenController {
  constructor(private service: KitchenService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("outlets/:outletId/display")
  getOutletDisplay(@OrgId() orgId: string, @Param("outletId") outletId: string) {
    return this.service.getOutletDisplay(orgId, outletId);
  }

  @Patch("items/:id/status")
  updateItemStatus(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: UpdateKitchenItemStatusDto,
  ) {
    return this.service.updateItemStatus(orgId, id, body.status ?? "");
  }
}
