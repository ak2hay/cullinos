import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { OrgId, RequireModule } from "../../common/decorators";
import { CouponsService } from "./coupons.service";

@Controller("coupons")
export class CouponsController {
  constructor(private service: CouponsService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.service.list(orgId);
  }

  @Post()
  @RequireModule("loyalty")
  create(@OrgId() orgId: string, @Body() body: Record<string, unknown>) {
    return this.service.create(orgId, body as never);
  }

  @Post("validate")
  @RequireModule("loyalty")
  validate(
    @OrgId() orgId: string,
    @Body("code") code: string,
    @Query("orderTotal") orderTotal?: string,
    @Body("orderTotal") bodyTotal?: number,
  ) {
    return this.service.validate(orgId, code, Number(orderTotal ?? bodyTotal ?? 0));
  }
}
