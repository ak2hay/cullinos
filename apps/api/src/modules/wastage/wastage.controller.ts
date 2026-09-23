import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { WastageService } from "./wastage.service";

@Controller("wastage")
export class WastageController {
  constructor(private service: WastageService) {}

  @Get()
  @RequireModule("inventory")
  list(@OrgId() orgId: string, @Query("outletId") outletId?: string) {
    return this.service.list(orgId, outletId);
  }

  @Post()
  @RequireModule("inventory")
  create(
    @OrgId() orgId: string,
    @Body()
    body: {
      inventoryItemId: string;
      quantity: number;
      reason?: string;
      outletId?: string;
    },
  ) {
    return this.service.create(orgId, body);
  }
}
