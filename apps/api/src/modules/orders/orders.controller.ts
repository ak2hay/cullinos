import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser, OrgId, Public, RequireModule } from "../../common/decorators";
import type { JwtPayload } from "@cullinos/auth";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Get()
  @RequireModule("orders")
  list(
    @OrgId() orgId: string,
    @Query("outletId") outletId?: string,
    @Query("tableId") tableId?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.service.list(orgId, {
      outletId,
      tableId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("pickup-queue")
  @RequireModule("orders")
  pickupQueue(@OrgId() orgId: string, @Query("outletId") outletId: string) {
    return this.service.getPickupQueue(orgId, outletId);
  }

  @Get(":id")
  @RequireModule("orders")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.get(orgId, id);
  }

  @Post()
  @RequireModule("orders")
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.create(orgId, user.sub, body as never);
  }

  @Post(":id/items")
  @RequireModule("orders")
  addItems(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body("items") items: unknown[],
  ) {
    return this.service.addItems(orgId, id, (items ?? []) as never);
  }

  @Post(":id/confirm")
  @RequireModule("orders")
  confirm(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.confirm(orgId, id);
  }

  @Patch(":id/status")
  @RequireModule("orders")
  updateStatus(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    return this.service.updateStatus(orgId, id, status);
  }

  @Post(":id/hold")
  @RequireModule("orders")
  hold(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.hold(orgId, id);
  }

  @Post(":id/resume")
  @RequireModule("orders")
  resume(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.resume(orgId, id);
  }
}

/** Public customer ordering — no staff JWT required. */
@Controller("public/orders")
export class PublicOrdersController {
  constructor(private service: OrdersService) {}

  @Public()
  @Post()
  create(@Body() body: Record<string, unknown>) {
    const organizationId = body.organizationId as string | undefined;
    if (!organizationId) {
      throw new BadRequestException("organizationId is required");
    }
    const dto = { ...body };
    delete dto.organizationId;
    return this.service.create(organizationId, null, {
      ...(dto as Record<string, unknown>),
      autoConfirm: true,
    } as never);
  }
}
