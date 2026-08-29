import { Body, Controller, Get, Post } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { InventoryService } from "./inventory.service";

@Controller("inventory")
export class InventoryController {
  constructor(private service: InventoryService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("items")
  @RequireModule("inventory")
  listItems(@OrgId() orgId: string) {
    return this.service.listItems(orgId);
  }

  @Post("transfers")
  @RequireModule("inventory")
  transfer(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.transfer(orgId, body as never);
  }
}
