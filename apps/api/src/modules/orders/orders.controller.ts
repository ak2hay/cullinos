import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CurrentUser, OrgId, RequireModule } from "../../common/decorators";
import type { JwtPayload } from "@cullinos/auth";
import { OrdersService } from "./orders.service";

@Controller("orders")
@RequireModule("orders")
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Get()
  list(@OrgId() orgId: string, @Query("outletId") outletId?: string) {
    return this.service.list(orgId, outletId);
  }

  @Post()
  create(@OrgId() orgId: string, @CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.service.create(orgId, user.sub, body as never);
  }

  @Patch(":id/status")
  updateStatus(@OrgId() orgId: string, @Param("id") id: string, @Body("status") status: string) {
    return this.service.updateStatus(orgId, id, status);
  }
}
