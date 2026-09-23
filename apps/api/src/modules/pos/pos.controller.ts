import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser, OrgId, RequireModule } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { JwtPayload } from "@cullinos/auth";
import { OrdersService } from "../orders/orders.service";
import { PosShiftsService } from "./pos-shifts.service";

@Controller("pos")
export class PosController {
  constructor(
    private ordersService: OrdersService,
    private shifts: PosShiftsService,
  ) {}

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
      customerId: body.customerId as string | undefined,
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

  @Get("shifts/open")
  @RequireModule("pos")
  openShiftStatus(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Query("outletId") outletId: string,
  ) {
    return this.shifts.getOpenShift(orgId, outletId, user.sub);
  }

  @Post("shifts/open")
  @RequireModule("pos")
  @RequirePermissions("pos:shift:open", "pos:access")
  openShift(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { outletId?: string; openingCash?: number },
  ) {
    return this.shifts.openShift(
      orgId,
      user.sub,
      body.outletId ?? "",
      body.openingCash,
    );
  }

  @Post("shifts/:id/close")
  @RequireModule("pos")
  @RequirePermissions("pos:shift:close", "pos:access")
  closeShift(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { closingCash?: number },
  ) {
    return this.shifts.closeShift(orgId, user.sub, id, body.closingCash);
  }

  @Post("shifts/:id/movements")
  @RequireModule("pos")
  @RequirePermissions("pos:shift:open", "pos:access")
  addMovement(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { type?: string; amount?: number; reason?: string },
  ) {
    return this.shifts.addMovement(orgId, user.sub, id, {
      type: body.type ?? "cash_in",
      amount: Number(body.amount),
      reason: body.reason,
    });
  }
}
