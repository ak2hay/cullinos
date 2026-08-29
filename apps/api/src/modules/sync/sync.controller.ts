import { Body, Controller, Post, Headers } from "@nestjs/common";
import { Public } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("sync")
export class SyncController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Post()
  async receive(
    @Headers("x-idempotency-key") headerKey: string,
    @Body() body: Record<string, unknown>
  ) {
    const key = String(body.idempotencyKey || headerKey || "");
    if (!key) return { status: "failed", error: "Missing idempotency key" };

    const existing = await this.prisma.syncEvent.findUnique({ where: { idempotencyKey: key } });
    if (existing?.status === "synced") {
      return { idempotencyKey: key, status: "synced", serverId: existing.id };
    }

    const event = await this.prisma.syncEvent.create({
      data: {
        organizationId: String(body.organizationId || ""),
        deviceId: body.deviceId ? String(body.deviceId) : undefined,
        eventType: String(body.type || "sync"),
        payload: (body.data as object) ?? {},
        idempotencyKey: key,
        status: "synced",
        syncedAt: new Date(),
      },
    });

    return { idempotencyKey: key, status: "synced", serverId: event.id };
  }
}
