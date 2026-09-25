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
import { StorefrontService } from "../storefront/storefront.service";

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
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const parsedPage = page ? Number(page) : undefined;
    return this.service.list(orgId, {
      outletId,
      tableId,
      status,
      from,
      to,
      page: parsedPage && Number.isFinite(parsedPage) ? Math.floor(parsedPage) : undefined,
      limit:
        parsedLimit && Number.isFinite(parsedLimit)
          ? Math.min(Math.max(1, Math.floor(parsedLimit)), 100)
          : undefined,
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

  @Patch(":id/items/:itemId")
  @RequireModule("orders")
  updateItem(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() body: { quantity?: number },
  ) {
    return this.service.updateItem(orgId, id, itemId, body);
  }

  @Post(":id/items/:itemId/remove")
  @RequireModule("orders")
  removeItem(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
  ) {
    return this.service.removeItem(orgId, id, itemId);
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

  @Post(":id/discount")
  @RequireModule("orders")
  applyDiscount(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: { discountAmount?: number; reason?: string; couponCode?: string },
  ) {
    return this.service.applyDiscount(orgId, id, body);
  }

  @Post(":id/split")
  @RequireModule("orders")
  split(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { itemIds?: string[] },
  ) {
    return this.service.splitOrder(orgId, id, body.itemIds ?? [], user.sub);
  }

  @Post(":id/ebill")
  @RequireModule("pos")
  sendEbill(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: { channel?: "email" | "sms" },
  ) {
    const channel = body.channel === "email" ? "email" : "sms";
    return this.service.sendEbill(orgId, id, channel);
  }

  @Post(":id/cancel")
  @RequireModule("orders")
  cancel(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body?: { notes?: string },
  ) {
    return this.service.cancel(orgId, id, body?.notes);
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
  constructor(
    private service: OrdersService,
    private storefront: StorefrontService,
  ) {}

  @Public()
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const orgSlug = typeof body.orgSlug === "string" ? body.orgSlug.trim() : "";
    const outletSlug =
      typeof body.outletSlug === "string" ? body.outletSlug.trim() : "";
    if (!orgSlug || !outletSlug) {
      throw new BadRequestException("orgSlug and outletSlug are required");
    }

    const { organization, outlet } = await this.storefront.resolveActiveOutlet(
      orgSlug,
      outletSlug,
    );

    const dto = { ...body };
    delete dto.organizationId;
    delete dto.orgSlug;
    delete dto.outletSlug;
    // Always use server-resolved outlet — never trust client outletId alone.
    dto.outletId = outlet.id;

    return this.service.create(organization.id, null, {
      ...(dto as Record<string, unknown>),
      autoConfirm: true,
      publicOrder: true,
    } as never);
  }

  /**
   * Public pickup queue for customer-facing displays (no auth required).
   * Requires orgSlug + outletSlug so tenant identity is not guessed from opaque IDs alone.
   */
  @Public()
  @Get("pickup-queue")
  async pickupQueue(
    @Query("orgSlug") orgSlug: string,
    @Query("outletSlug") outletSlug: string,
  ) {
    if (!orgSlug?.trim() || !outletSlug?.trim()) {
      throw new BadRequestException("orgSlug and outletSlug are required");
    }
    const { organization, outlet } = await this.storefront.resolveActiveOutlet(
      orgSlug.trim(),
      outletSlug.trim(),
    );
    return this.service.getPickupQueue(organization.id, outlet.id);
  }
}
