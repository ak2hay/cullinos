import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { OutletsService } from "./outlets.service";

@Controller("outlets")
export class OutletsController {
  constructor(private service: OutletsService) {}

  @Get()
  list(@OrgId() orgId: string, @Query("brandId") brandId?: string) {
    return this.service.list(orgId, brandId);
  }

  @Patch(":id")
  @RequireModule("settings")
  update(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.update(orgId, id, body);
  }
}
