import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import { HappyHoursService } from "./happy-hours.service";

@Controller("happy-hours")
export class HappyHoursController {
  constructor(private service: HappyHoursService) {}

  @Get()
  @RequireModule("menu")
  @RequirePermissions("menu:read")
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Get("active")
  @RequireModule("menu")
  @RequirePermissions("menu:read")
  active(@OrgId() orgId: string, @Query("outletId") outletId: string) {
    return this.service.active(orgId, outletId ?? "");
  }

  @Post()
  @RequireModule("menu")
  @RequirePermissions("menu:create", "menu:update")
  create(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.create(orgId, body);
  }

  @Patch(":id")
  @RequireModule("menu")
  @RequirePermissions("menu:update")
  update(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.update(orgId, id, body);
  }

  @Delete(":id")
  @RequireModule("menu")
  @RequirePermissions("menu:delete", "menu:update")
  remove(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.remove(orgId, id);
  }
}
