import { Body, Controller, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, OrgId, RequireModule } from "../../common/decorators";
import type { JwtPayload } from "@cullinos/auth";
import { OrdersService } from "../orders/orders.service";

@Controller("pos")
export class PosController {
  constructor(private ordersService: OrdersService) {}

  @Post("quick-order")
  @RequireModule("pos")
  quickOrder(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.ordersService.create(orgId, user.sub, {
      outletId: body.outletId as string,
      source: (body.source as string) ?? "POS",
      type: (body.type as string) ?? undefined,
      tableId: body.tableId as string | undefined,
      customerName: body.customerName as string | undefined,
      tipAmount: body.tipAmount as number | undefined,
      notes: body.notes as string | undefined,
      items: body.items as never,
      autoConfirm: body.autoConfirm !== false,
    });
  }

  @Post("orders/:id/hold")
  @RequireModule("pos")
  holdOrder(@OrgId() orgId: string, @Param("id") id: string) {
    return this.ordersService.hold(orgId, id);
  }

  @Post("orders/:id/resume")
  @RequireModule("pos")
  resumeOrder(@OrgId() orgId: string, @Param("id") id: string) {
    return this.ordersService.resume(orgId, id);
  }
}
