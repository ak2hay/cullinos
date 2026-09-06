import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { DeliveryService } from "./delivery.service";

@Controller("delivery")
export class DeliveryController {
  constructor(private service: DeliveryService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("zones")
  listZones(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post("zones")
  createZone(
    @OrgId() orgId: string,
    @Body()
    body: {
      name: string;
      outletId?: string;
      pincode?: string;
      minOrder?: number;
      fee?: number;
      estimatedMinutes?: number;
    },
  ) {
    return this.service.createZone(orgId, body);
  }

  @Get("zones/:id")
  getZone(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.getZone(orgId, id);
  }
}
