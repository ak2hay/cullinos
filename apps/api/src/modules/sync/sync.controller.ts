import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { CurrentUser, OrgId } from "../../common/decorators";
import { RequirePermissions } from "../../common/decorators/permissions.decorator";
import type { JwtPayload } from "@cullinos/auth";
import type { SyncEventPayload } from "@cullinos/sync";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
  constructor(private sync: SyncService) {}

  @Get()
  @RequirePermissions("pos:access", "settings:read")
  list(@OrgId() orgId: string) {
    return this.sync.list(orgId);
  }

  @Post()
  @RequirePermissions("pos:access")
  async receive(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Headers("x-idempotency-key") headerKey: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.sync.processEvent(this.toPayload(orgId, body, headerKey), user?.sub);
  }

  @Post("batch")
  @RequirePermissions("pos:access")
  async receiveBatch(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { events?: unknown[] },
  ) {
    const events = Array.isArray(body.events) ? body.events : [];
    return this.sync.processBatch(
      events.map((e) => this.toPayload(orgId, (e ?? {}) as Record<string, unknown>)),
      user?.sub,
    );
  }

  /** Tenant always comes from the staff JWT, never from the envelope. */
  private toPayload(
    orgId: string,
    body: Record<string, unknown>,
    headerKey?: string,
  ): SyncEventPayload {
    return {
      type: String(body.type || "sync"),
      idempotencyKey: String(body.idempotencyKey || headerKey || ""),
      organizationId: orgId,
      deviceId: body.deviceId ? String(body.deviceId) : undefined,
      data: (body.data as Record<string, unknown>) ?? {},
      createdAt: String(body.createdAt || new Date().toISOString()),
    };
  }
}
