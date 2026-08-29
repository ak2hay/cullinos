import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { KitchenService } from "./kitchen.service";

@Controller("kitchen")
export class KitchenController {
  constructor(private service: KitchenService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
