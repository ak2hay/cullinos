import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";
import { OrdersService } from "../orders/orders.service";
import { OrderStatusNotifier } from "../orders/order-status.notifier";
import { RecipesService } from "../recipes/recipes.service";

type UiStatus = "NEW" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";

const DB_TO_UI: Record<string, UiStatus> = {
  pending: "NEW",
  new: "NEW",
  preparing: "PREPARING",
  ready: "READY",
  served: "SERVED",
  cancelled: "CANCELLED",
};

const UI_TO_DB: Record<string, string> = {
  NEW: "pending",
  PREPARING: "preparing",
  READY: "ready",
  SERVED: "served",
  CANCELLED: "cancelled",
};

/** KOTs of finished orders never belong on the kitchen board, even if a ticket was left open. */
const TERMINAL_ORDER_STATUSES = ["completed", "cancelled", "voided"] as const;

function toUiStatus(status: string): UiStatus {
  return DB_TO_UI[status.toLowerCase()] ?? "NEW";
}

function toDbStatus(status: string): string {
  const upper = status.toUpperCase();
  if (UI_TO_DB[upper]) return UI_TO_DB[upper];
  const lower = status.toLowerCase();
  if (["pending", "preparing", "ready", "served", "cancelled"].includes(lower)) {
    return lower;
  }
  throw new BadRequestException(`Invalid status: ${status}`);
}

@Injectable()
export class KitchenService {
  private readonly logger = new Logger(KitchenService.name);

  constructor(
    private prisma: PrismaService,
    private ws: WebsocketGateway,
    @Optional()
    private recipes?: RecipesService,
    @Optional()
    private orders?: OrdersService,
    @Optional()
    private statusNotifier?: OrderStatusNotifier,
  ) {}

  list(orgId: string) {
    return this.prisma.kOT.findMany({
      where: {
        order: { organizationId: orgId, status: { notIn: [...TERMINAL_ORDER_STATUSES] } },
        status: { in: ["pending", "preparing"] },
      },
      include: { items: true, order: true },
      take: 200,
    });
  }

  private mapKot(kot: {
    id: string;
    orderId: string;
    kotNumber: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    kitchenStationId: string | null;
    items: Array<{
      id: string;
      kotId: string;
      status: string;
      orderItem: { name: string; quantity: number; notes: string | null };
    }>;
    order: {
      orderNumber: string;
      pickupCode: string | null;
      type: string;
      tableId: string | null;
      customerName: string | null;
      table: { name: string } | null;
    };
    kitchenStation: {
      id: string;
      name: string;
      code: string | null;
      isActive: boolean;
    } | null;
  }) {
    return {
      id: kot.id,
      orderId: kot.orderId,
      kotNumber: kot.kotNumber,
      status: toUiStatus(kot.status),
      priority: 0,
      notes: null as string | null,
      createdAt: kot.createdAt.toISOString(),
      updatedAt: kot.updatedAt.toISOString(),
      items: kot.items.map((i) => ({
        id: i.id,
        kotId: i.kotId,
        kitchenStationId: kot.kitchenStationId,
        name: i.orderItem.name,
        quantity: i.orderItem.quantity,
        status: toUiStatus(i.status),
        notes: i.orderItem.notes,
        startedAt: null as string | null,
        readyAt: null as string | null,
        createdAt: kot.createdAt.toISOString(),
        kitchenStation: kot.kitchenStation
          ? {
              id: kot.kitchenStation.id,
              name: kot.kitchenStation.name,
              code: kot.kitchenStation.code,
              isActive: kot.kitchenStation.isActive,
            }
          : null,
      })),
      order: {
        orderNumber: kot.order.orderNumber,
        pickupCode: kot.order.pickupCode,
        tableId: kot.order.tableId,
        orderType: kot.order.type,
        table: kot.order.table,
      },
    };
  }

  /**
   * `stationId` narrows tickets to one station screen; `"default"` means tickets
   * not routed to any station (the main kitchen ticket).
   */
  async getOutletDisplay(orgId: string, outletId: string, stationId?: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const READY_TTL_MS = 10 * 60 * 1000;
    const readyCutoff = new Date(Date.now() - READY_TTL_MS);
    const stationFilter =
      stationId === "default"
        ? { kitchenStationId: null }
        : stationId
          ? { kitchenStationId: stationId }
          : {};

    const [stations, kitchenOrders, pickupOrders] = await Promise.all([
      this.prisma.kitchenStation.findMany({
        where: { outletId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        take: 50,
      }),
      this.prisma.kOT.findMany({
        where: {
          ...stationFilter,
          order: {
            outletId,
            organizationId: orgId,
            status: { notIn: [...TERMINAL_ORDER_STATUSES] },
          },
          status: { in: ["pending", "preparing", "ready"] },
        },
        include: {
          items: { include: { orderItem: true } },
          kitchenStation: true,
          order: {
            select: {
              orderNumber: true,
              pickupCode: true,
              customerName: true,
              type: true,
              tableId: true,
              table: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      this.prisma.order.findMany({
        where: {
          outletId,
          organizationId: orgId,
          type: { in: ["takeaway", "qr", "online", "dine_in"] },
          OR: [
            { status: { in: ["confirmed", "preparing"] } },
            {
              status: "ready",
              OR: [
                { readyAt: { gte: readyCutoff } },
                { readyAt: null, updatedAt: { gte: readyCutoff } },
              ],
            },
          ],
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          customerName: true,
          scheduledPickupAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 30,
      }),
    ]);

    const allKots = kitchenOrders.map((kot) =>
      this.mapKot({
        ...kot,
        kitchenStation: kot.kitchenStation
          ? {
              id: kot.kitchenStation.id,
              name: kot.kitchenStation.name,
              code: kot.kitchenStation.code,
              isActive: kot.kitchenStation.isActive,
            }
          : null,
      }),
    );

    const stationBuckets = stations.map((station) => ({
      station: {
        id: station.id,
        name: station.name,
        code: station.code,
        isActive: station.isActive,
      },
      kots: allKots.filter(
        (k) =>
          kitchenOrders.find((raw) => raw.id === k.id)?.kitchenStationId ===
          station.id,
      ),
    }));

    const kitchen = kitchenOrders.map((kot) => ({
      id: kot.id,
      kotNumber: kot.kotNumber,
      status: kot.status,
      orderNumber: kot.order.orderNumber,
      customerName: kot.order.customerName,
      items: kot.items.map((i) => ({
        id: i.id,
        name: i.orderItem.name,
        quantity: i.orderItem.quantity,
        status: i.status,
      })),
      createdAt: kot.createdAt,
    }));

    const pickupQueue = pickupOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      customerName: o.customerName,
      scheduledPickupAt: o.scheduledPickupAt,
      createdAt: o.createdAt,
    }));

    return {
      outletId,
      operatingMode: outlet.operatingMode,
      stations: stationBuckets,
      allKots,
      kitchen,
      pickupQueue,
    };
  }

  async updateItemStatus(orgId: string, itemId: string, status: string) {
    const dbStatus = toDbStatus(status);
    const item = await this.prisma.kOTItem.findFirst({
      where: { id: itemId, kot: { order: { organizationId: orgId } } },
      select: { kotId: true },
    });
    if (!item) throw new NotFoundException("Kitchen item not found");
    const kot = await this.loadKot(orgId, item.kotId);
    const [mappedItem] = await this.applyItemStatuses(orgId, kot, [itemId], dbStatus);
    return mappedItem;
  }

  /** Bumps every open item on a ticket in one round trip (KDS "Mark …" button). */
  async updateKotStatus(orgId: string, kotId: string, status: string) {
    const dbStatus = toDbStatus(status);
    const kot = await this.loadKot(orgId, kotId);
    const itemIds = kot.items
      .filter((i) => !["served", "cancelled"].includes(i.status.toLowerCase()))
      .map((i) => i.id);
    if (!itemIds.length) return { kotId, items: [] };
    const items = await this.applyItemStatuses(orgId, kot, itemIds, dbStatus);
    return { kotId, items };
  }

  private async loadKot(orgId: string, kotId: string) {
    const kot = await this.prisma.kOT.findFirst({
      where: { id: kotId, order: { organizationId: orgId } },
      include: {
        items: { include: { orderItem: true } },
        order: { include: { table: { select: { name: true } } } },
      },
    });
    if (!kot) throw new NotFoundException("Kitchen ticket not found");
    return kot;
  }

  private async applyItemStatuses(
    orgId: string,
    kot: Awaited<ReturnType<KitchenService["loadKot"]>>,
    itemIds: string[],
    dbStatus: string,
  ) {
    const changed = new Set(itemIds);
    const statusOf = (i: { id: string; status: string }) =>
      changed.has(i.id) ? dbStatus : i.status.toLowerCase();
    const kotStatus = rollUpKotStatus(kot.items.map(statusOf));
    const order = kot.order;
    const orderId = kot.orderId;
    const outletId = order.outletId;

    const [, , otherItems] = await Promise.all([
      this.prisma.kOTItem.updateMany({
        where: { id: { in: itemIds }, kotId: kot.id },
        data: { status: dbStatus as never },
      }),
      kotStatus !== kot.status
        ? this.prisma.kOT.update({ where: { id: kot.id }, data: { status: kotStatus } })
        : Promise.resolve(null),
      this.prisma.kOTItem.findMany({
        where: { kot: { orderId, id: { not: kot.id } } },
        select: { status: true },
      }),
    ]);

    // Roll up parent order for CDS board
    const allItemStatuses = [
      ...kot.items.map(statusOf),
      ...otherItems.map((i) => i.status.toLowerCase()),
    ];
    const orderStatus = rollUpOrderStatus(allItemStatuses);

    if (
      orderStatus &&
      orderStatus !== order.status &&
      ["confirmed", "preparing", "ready"].includes(order.status)
    ) {
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: orderStatus as never,
          ...(orderStatus === "ready" ? { readyAt: new Date() } : {}),
          timeline: {
            create: {
              event: "order.status_changed",
              metadata: { status: orderStatus, source: "kds" },
            },
          },
        },
        select: { id: true, orderNumber: true, status: true, tableId: true, metadata: true },
      });
      this.statusNotifier?.changed({
        organizationId: orgId,
        id: updatedOrder.id,
        outletId,
        status: updatedOrder.status,
        metadata: updatedOrder.metadata,
      });
      const tableName = order.table?.name ?? null;
      this.ws.emitToOutlet(outletId, "order.updated", {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        tableId: updatedOrder.tableId,
        tableName,
      });
      if (orderStatus === "ready") {
        this.ws.emitToOutlet(outletId, "order.ready", {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          tableId: updatedOrder.tableId,
          tableName,
          status: "READY",
        });
      }
      if (orderStatus === "served") this.finishServedOrder(orgId, orderId);
    }

    const mappedItems = kot.items
      .filter((i) => changed.has(i.id))
      .map((i) => ({
        id: i.id,
        kotId: i.kotId,
        kitchenStationId: kot.kitchenStationId,
        name: i.orderItem.name,
        quantity: i.orderItem.quantity,
        status: toUiStatus(dbStatus),
        notes: i.orderItem.notes,
        startedAt: null as string | null,
        readyAt: null as string | null,
        createdAt: kot.createdAt.toISOString(),
      }));

    this.ws.emitToOutlet(outletId, "kot.updated", {
      kotId: kot.id,
      status: toUiStatus(kotStatus),
      item: mappedItems[0],
      items: mappedItems,
      orgId,
    });

    return mappedItems;
  }

  /** Stock deduction and auto-complete are slow; the kitchen shouldn't wait on them. */
  private finishServedOrder(orgId: string, orderId: string) {
    void (async () => {
      try {
        await this.recipes?.deductForOrder(orgId, orderId);
        await this.orders?.completeAfterKitchenServe(orgId, orderId);
      } catch (err) {
        this.logger.warn(
          `Post-serve processing failed for ${orderId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    })();
  }
}

type KotStatus = "pending" | "preparing" | "ready" | "served" | "cancelled";

export function rollUpKotStatus(statuses: string[]): KotStatus {
  const ranks: Record<string, number> = { pending: 0, preparing: 1, ready: 2, served: 3 };
  const live = statuses.filter((s) => s !== "cancelled");
  if (!live.length) return "cancelled";
  if (live.every((s) => s === "served")) return "served";
  if (live.every((s) => s === "ready" || s === "served")) return "ready";
  if (Math.min(...live.map((s) => ranks[s] ?? 0)) >= 1) return "preparing";
  return "pending";
}

/** Cancelled lines don't count as fulfilment; an all-cancelled order needs a staff cancel/void. */
export function rollUpOrderStatus(statuses: string[]): string | null {
  const live = statuses.filter((s) => s !== "cancelled");
  if (!live.length) return null;
  if (live.every((s) => s === "served")) return "served";
  if (live.every((s) => s === "ready" || s === "served")) return "ready";
  if (statuses.some((s) => s === "preparing" || s === "ready" || s === "served")) return "preparing";
  return null;
}
