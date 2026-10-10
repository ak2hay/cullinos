import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { CurrentUser, OrgId, Public, RequireModule } from "../../common/decorators";
import {
  provePublicCustomerId,
  resolvePublicCustomerByPhone,
} from "../../common/public-customer.util";
import type { JwtPayload } from "@cullinos/auth";
import { PrismaService } from "../../prisma/prisma.service";
import { OrdersService } from "./orders.service";
import { AuditService } from "../audit/audit.service";
import { StorefrontService } from "../storefront/storefront.service";
import {
  assertCanSetOrderStatus,
  pickPublicOrderFields,
  sanitizeStaffOrderBody,
} from "./order-input.util";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";

@Controller("orders")
@RequirePermissions("order:update")
export class OrdersController {
  constructor(
    private service: OrdersService,
    private audit: AuditService,
  ) {}

  /** Money-reducing actions (cancel, void, discount) keep a record of who did them. */
  private auditOrder(
    orgId: string,
    user: JwtPayload,
    action: string,
    orderId: string,
    metadata: Record<string, unknown> = {},
  ) {
    return this.audit.log({
      organizationId: orgId,
      userId: user.sub,
      action,
      entityType: "order",
      entityId: orderId,
      metadata: { ...metadata, ...(user.impersonatedBy ? { impersonatedBy: user.impersonatedBy } : {}) },
    });
  }

  @Get()
  @RequireModule("orders")
  @RequirePermissions("order:read")
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
  @RequirePermissions("order:read")
  pickupQueue(@OrgId() orgId: string, @Query("outletId") outletId: string) {
    return this.service.getPickupQueue(orgId, outletId);
  }

  @Get(":id")
  @RequireModule("orders")
  @RequirePermissions("order:read")
  get(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.get(orgId, id);
  }

  @Post()
  @RequireModule("orders")
  @RequirePermissions("order:create")
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: Record<string, unknown>,
    @Headers("idempotency-key") idempotencyHeader?: string,
  ) {
    const dto = sanitizeStaffOrderBody(body);
    if (!dto.idempotencyKey && idempotencyHeader?.trim()) {
      dto.idempotencyKey = idempotencyHeader.trim();
    }
    return this.service.create(orgId, user.sub, dto as never);
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
  async removeItem(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
  ) {
    const result = await this.service.removeItem(orgId, id, itemId);
    await this.auditOrder(orgId, user, "order.item_void", id, { itemId });
    return result;
  }

  @Post(":id/confirm")
  @RequireModule("orders")
  confirm(@OrgId() orgId: string, @Param("id") id: string) {
    return this.service.confirm(orgId, id);
  }

  @Patch(":id/status")
  @RequireModule("orders")
  @RequirePermissions("order:update", "kitchen:update")
  async updateStatus(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    assertCanSetOrderStatus(user, status);
    const result = await this.service.updateStatus(orgId, id, status, {
      // Managers/owners may close a bill with a balance (credit / complimentary); cashiers may not.
      allowUnpaidComplete: Boolean(user?.permissions?.includes("order:discount:approve")),
    });
    const normalized = String(status ?? "").toLowerCase();
    if (normalized === "cancelled" || normalized === "voided") {
      await this.auditOrder(orgId, user, `order.${normalized}`, id, { via: "status" });
    }
    return result;
  }

  @Post(":id/discount")
  @RequireModule("orders")
  @RequirePermissions("order:discount")
  async applyDiscount(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body: { discountAmount?: number; reason?: string; couponCode?: string },
  ) {
    const result = await this.service.applyDiscount(orgId, id, body);
    await this.auditOrder(orgId, user, "order.discount", id, {
      discountAmount: body.discountAmount ?? null,
      couponCode: body.couponCode ?? null,
      reason: body.reason?.slice(0, 200) ?? null,
    });
    return result;
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
  @RequirePermissions("pos:access", "order:update")
  sendEbill(
    @OrgId() orgId: string,
    @Param("id") id: string,
    @Body() body: { channel?: "email" | "sms" | "whatsapp" },
  ) {
    const channel =
      body.channel === "email"
        ? "email"
        : body.channel === "whatsapp"
          ? "whatsapp"
          : "sms";
    return this.service.sendEbill(orgId, id, channel);
  }

  @Post(":id/cancel")
  @RequireModule("orders")
  @RequirePermissions("order:cancel")
  async cancel(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() body?: { notes?: string },
  ) {
    const result = await this.service.cancel(orgId, id, body?.notes);
    await this.auditOrder(orgId, user, "order.cancelled", id, {
      notes: body?.notes?.slice(0, 200) ?? null,
    });
    return result;
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
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  @Public()
  @Post()
  async create(
    @Body() body: Record<string, unknown>,
    @Headers("authorization") authorization?: string,
  ) {
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

    const customerId =
      (await provePublicCustomerId(
        this.jwt,
        this.prisma,
        organization.id,
        typeof body.customerId === "string" ? body.customerId : undefined,
        authorization,
      )) ??
      (await resolvePublicCustomerByPhone(
        this.prisma,
        organization.id,
        body.customerPhone,
        body.customerName,
      ));

    return this.service.create(organization.id, null, {
      ...pickPublicOrderFields(body),
      // Always use server-resolved outlet — never trust client outletId alone.
      outletId: outlet.id,
      customerId,
      autoConfirm: true,
      publicOrder: true,
    });
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
