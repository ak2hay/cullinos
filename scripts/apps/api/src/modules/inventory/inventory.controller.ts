import { Controller, Get } from "@nestjs/common";
import { OrgId } from "../../common/decorators";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
export class InventoryController {
  constructor(private service: InventoryService) {}
  @Get() list(@OrgId() orgId: string) { return this.service.list(orgId); }
}
