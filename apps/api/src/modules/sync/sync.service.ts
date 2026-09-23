import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  SYNC_EVENT_TYPES,
  type SyncEventPayload,
  type SyncOrderCreateData,
  type SyncPaymentCashData,
  type SyncResult,
} from "@cullinos/sync";
import { PrismaService } from "../../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
    private payments: PaymentsService,
  ) {}

  list(orgId: string) {
    return this.prisma.syncEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /** Process a single offline sync envelope into domain services. */
  async processEvent(payload: SyncEventPayload): Promise<SyncResult> {
    const key = payload.idempotencyKey?.trim();
    if (!key) {
      return { idempotencyKey: "", status: "failed", error: "Missing idempotency key" };
    }

    const orgId = payload.organizationId?.trim();
    if (!orgId) {
      return { idempotencyKey: key, status: "failed", error: "Missing organizationId" };
    }

    const existing = await this.prisma.syncEvent.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing?.status === "synced") {
      return {
        idempotencyKey: key,
        status: "synced",
        serverId: existing.id,
      };
    }

    const eventType = String(payload.type || "sync");
    let serverId: string | undefined;
    let error: string | undefined;

    try {
      serverId = await this.applyDomainEvent(orgId, eventType, payload);
      await this.prisma.syncEvent.upsert({
        where: { idempotencyKey: key },
        create: {
          organizationId: orgId,
          deviceId: payload.deviceId,
          eventType,
          payload: payload.data as object,
          idempotencyKey: key,
          status: "synced",
          syncedAt: new Date(),
        },
        update: {
          status: "synced",
          syncedAt: new Date(),
          payload: payload.data as object,
        },
      });
      return { idempotencyKey: key, status: "synced", serverId };
    } catch (err) {
      error = err instanceof Error ? err.message : "Sync failed";
      this.logger.warn(`Sync ${key} (${eventType}): ${error}`);
      await this.prisma.syncEvent.upsert({
        where: { idempotencyKey: key },
        create: {
          organizationId: orgId,
          deviceId: payload.deviceId,
          eventType,
          payload: payload.data as object,
          idempotencyKey: key,
          status: "failed",
        },
        update: { status: "failed", payload: payload.data as object },
      });
      return { idempotencyKey: key, status: "failed", error };
    }
  }

  async processBatch(events: SyncEventPayload[]): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    for (const event of events) {
      results.push(await this.processEvent(event));
    }
    return results;
  }

  private async applyDomainEvent(
    orgId: string,
    eventType: string,
    payload: SyncEventPayload,
  ): Promise<string> {
    switch (eventType) {
      case SYNC_EVENT_TYPES.ORDER_CREATE:
        return this.processOrderCreate(orgId, payload);
      case SYNC_EVENT_TYPES.PAYMENT_CASH:
        return this.processPaymentCash(orgId, payload);
      default:
        throw new BadRequestException(`Unsupported sync event type: ${eventType}`);
    }
  }

  private async processOrderCreate(
    orgId: string,
    payload: SyncEventPayload,
  ): Promise<string> {
    const data = payload.data as SyncOrderCreateData;
    if (!data?.outletId) {
      throw new BadRequestException("order.create requires data.outletId");
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException("order.create requires at least one item");
    }

    const order = await this.orders.create(orgId, null, {
      outletId: data.outletId,
      type: data.type,
      source: data.source ?? "pos",
      tableId: data.tableId,
      tableSessionId: data.tableSessionId,
      customerId: data.customerId,
      customerName: data.customerName,
      guestCount: data.guestCount,
      notes: data.notes,
      tipAmount: data.tipAmount,
      items: data.items,
      autoConfirm: data.autoConfirm ?? true,
      idempotencyKey: payload.idempotencyKey,
    });

    return String(order.id);
  }

  private async processPaymentCash(
    orgId: string,
    payload: SyncEventPayload,
  ): Promise<string> {
    const data = payload.data as SyncPaymentCashData;
    if (!data?.orderId) {
      throw new BadRequestException("payment.cash requires data.orderId");
    }

    const result = await this.payments.recordCash(
      orgId,
      data.orderId,
      data.amount,
    );

    return String(result.paymentId ?? result.orderId);
  }
}
