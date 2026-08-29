import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { DeliveryService } from "./delivery.service";

@Controller("delivery")
export class DeliveryController {
  constructor(private service: DeliveryService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
