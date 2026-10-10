import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../common/redis/redis.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";
import {
  outletOpsSettings,
  qrSessionExpiryAction,
} from "../../common/outlet-ops-settings.util";
import { OrdersService } from "../orders/orders.service";
import { releaseMergedTables } from "./table-merge.util";

const INTERVAL_MS = 5 * 60 * 1000;
const LOCK_KEY = "job-lock:table-session-expiry";
const BATCH = 500;
const TERMINAL = ["completed", "cancelled", "voided"] as const;

/** Expires idle QR table sessions so abandoned tables do not stay occupied forever. */
@Injectable()
export class TableSessionExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TableSessionExpiryService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private prisma: PrismaService,
    private ws: WebsocketGateway,
    private orders: OrdersService,
    @Optional() private redis?: RedisService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === "test") return;
    setTimeout(() => {
      void this.runScheduledPass();
    }, 60_000);
    this.timer = setInterval(() => {
      void this.runScheduledPass();
    }, INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runScheduledPass() {
    const leased = await (this.redis?.acquireLock(LOCK_KEY, INTERVAL_MS - 30_000) ??
      Promise.resolve(true)).catch(() => false);
    if (!leased) return;
    try {
      await this.expireIdleSessions();
    } catch (err) {
      this.logger.error(
        `Table session expiry failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async expireIdleSessions(now = new Date()) {
    const candidates = await this.prisma.tableSession.findMany({
      where: { status: "active", lastActivityAt: { lt: new Date(now.getTime() - 60_000) } },
      orderBy: { lastActivityAt: "asc" },
      take: BATCH,
      select: {
        id: true,
        tableId: true,
        lastActivityAt: true,
        staleAlertedAt: true,
        table: {
          select: {
            name: true,
            section: {
              select: {
                floor: {
                  select: {
                    outlet: {
                      select: { id: true, organizationId: true, settings: { select: { settings: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const counts = { closed: 0, cancelled: 0, alerted: 0 };
    for (const session of candidates) {
      const outlet = session.table.section.floor.outlet;
      const { qrSessionTimeoutMinutes } = outletOpsSettings(outlet.settings?.settings);
      if (qrSessionTimeoutMinutes <= 0) continue;
      const idleMs = now.getTime() - session.lastActivityAt.getTime();
      if (idleMs < qrSessionTimeoutMinutes * 60_000) continue;

      try {
        const openOrders = await this.prisma.order.findMany({
          where: {
            organizationId: outlet.organizationId,
            OR: [{ tableSessionId: session.id }, { tableId: session.tableId }],
            status: { notIn: [...TERMINAL] },
          },
          select: { id: true, status: true, source: true },
        });
        const action = qrSessionExpiryAction(openOrders, Boolean(session.staleAlertedAt));

        if (action === "cancel_drafts") {
          for (const order of openOrders) {
            await this.orders.cancel(outlet.organizationId, order.id, "QR session expired");
            counts.cancelled++;
          }
        }
        if (action === "close" || action === "cancel_drafts") {
          await this.closeSession(session.id, session.tableId, outlet.id);
          counts.closed++;
        } else if (action === "alert") {
          await this.alertStaff(session, outlet, Math.round(idleMs / 60_000), now);
          counts.alerted++;
        }
      } catch (err) {
        this.logger.warn(
          `Session ${session.id} expiry skipped: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (counts.closed || counts.alerted) {
      this.logger.log(
        `QR session expiry: closed=${counts.closed} draftsCancelled=${counts.cancelled} staleAlerts=${counts.alerted}`,
      );
    }
    return counts;
  }

  private async closeSession(sessionId: string, tableId: string, outletId: string) {
    const released = await this.prisma.$transaction(async (tx) => {
      await tx.tableSession.updateMany({
        where: { id: sessionId, status: "active" },
        data: { status: "closed", endedAt: new Date() },
      });
      const stillActive = await tx.tableSession.count({ where: { tableId, status: "active" } });
      if (stillActive > 0) return null;
      await tx.table.updateMany({
        where: { id: tableId, status: "occupied" },
        data: { status: "available" },
      });
      return releaseMergedTables(tx, tableId, "available");
    });
    if (!released) return;
    for (const id of [tableId, ...released]) {
      this.ws.emitToOutlet(outletId, "table.updated", { id, outletId, status: "AVAILABLE" });
    }
  }

  private async alertStaff(
    session: { id: string; tableId: string; table: { name: string } },
    outlet: { id: string; organizationId: string },
    idleMinutes: number,
    now: Date,
  ) {
    const claimed = await this.prisma.tableSession.updateMany({
      where: { id: session.id, status: "active", staleAlertedAt: null },
      data: { staleAlertedAt: now },
    });
    if (claimed.count !== 1) return;
    this.ws.emitToOutlet(outlet.id, "table.stale", {
      id: session.tableId,
      outletId: outlet.id,
      sessionId: session.id,
      tableName: session.table.name,
      idleMinutes,
    });
    await this.prisma.notification.create({
      data: {
        organizationId: outlet.organizationId,
        title: `${session.table.name} idle for ${idleMinutes} min`,
        body: "The QR session has an open order. Settle or close the table.",
        metadata: { type: "table.stale", outletId: outlet.id, tableId: session.tableId, sessionId: session.id },
      },
    });
  }
}
