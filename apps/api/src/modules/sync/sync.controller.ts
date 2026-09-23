import { Body, Controller, Get, Headers, Post } from "@nestjs/common";
import { OrgId, Public } from "../../common/decorators";
import type { SyncEventPayload } from "@cullinos/sync";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
  constructor(private sync: SyncService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.sync.list(orgId);
  }

  @Public()
  @Post()
  async receive(
    @Headers("x-idempotency-key") headerKey: string,
    @Body() body: Record<string, unknown>,
  ) {
    const payload: SyncEventPayload = {
      type: String(body.type || "sync"),
      idempotencyKey: String(body.idempotencyKey || headerKey || ""),
      organizationId: String(body.organizationId || ""),
      deviceId: body.deviceId ? String(body.deviceId) : undefined,
      data: (body.data as Record<string, unknown>) ?? {},
      createdAt: String(body.createdAt || new Date().toISOString()),
    };

    return this.sync.processEvent(payload);
  }

  @Public()
  @Post("batch")
  async receiveBatch(@Body() body: { events?: SyncEventPayload[] }) {
    const events = Array.isArray(body.events) ? body.events : [];
    return this.sync.processBatch(events);
  }
}
