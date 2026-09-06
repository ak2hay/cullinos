import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";

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
  constructor(
    private prisma: PrismaService,
    private ws: WebsocketGateway,
  ) {}

  list(orgId: string) {
    return this.prisma.kOT.findMany({
      where: {
        order: { organizationId: orgId },
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
        tableId: kot.order.tableId,
        orderType: kot.order.type,
        table: kot.order.table,
      },
    };
  }

  async getOutletDisplay(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const READY_TTL_MS = 10 * 60 * 1000;
    const readyCutoff = new Date(Date.now() - READY_TTL_MS);

    await this.prisma.order.updateMany({
      where: {
        outletId,
        status: "ready",
        OR: [
          { readyAt: { lt: readyCutoff } },
          { readyAt: null, updatedAt: { lt: readyCutoff } },
        ],
      },
      data: { status: "served" },
    });

    const [stations, kitchenOrders, pickupOrders] = await Promise.all([
      this.prisma.kitchenStation.findMany({
        where: { outletId },
        orderBy: { sortOrder: "asc" },
        take: 50,
      }),
      this.prisma.kOT.findMany({
        where: {
          order: { outletId },
          status: { in: ["pending", "preparing", "ready"] },
        },
        include: {
          items: { include: { orderItem: true } },
          kitchenStation: true,
          order: {
            select: {
              orderNumber: true,
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
              isActive: true,
            }
          : null,
      }),
    );

    const stationBuckets = stations.map((station) => ({
      station: {
        id: station.id,
        name: station.name,
        code: station.code,
        isActive: true,
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

  async updateItemStatus(itemId: string, status: string) {
    const dbStatus = toDbStatus(status);
    const item = await this.prisma.kOTItem.findUnique({
      where: { id: itemId },
      include: {
        orderItem: true,
        kot: {
          include: {
            items: true,
            order: true,
            kitchenStation: true,
          },
        },
      },
    });
    if (!item) throw new NotFoundException("Kitchen item not found");

    const updatedItem = await this.prisma.kOTItem.update({
      where: { id: itemId },
      data: { status: dbStatus },
      include: { orderItem: true },
    });

    const siblings = await this.prisma.kOTItem.findMany({
      where: { kotId: item.kotId },
    });
    const ranks = { pending: 0, preparing: 1, ready: 2, served: 3, cancelled: -1 };
    const active = siblings.map((s) =>
      s.id === itemId ? dbStatus : s.status.toLowerCase(),
    );
    const minRank = Math.min(
      ...active
        .filter((s) => s !== "cancelled")
        .map((s) => ranks[s as keyof typeof ranks] ?? 0),
    );
    let kotStatus: "pending" | "preparing" | "ready" | "served" = "pending";
    if (active.every((s) => s === "served" || s === "cancelled")) {
      kotStatus = "served";
    } else if (active.every((s) => s === "ready" || s === "served" || s === "cancelled")) {
      kotStatus = "ready";
    } else if (minRank >= 1) {
      kotStatus = "preparing";
    }

    await this.prisma.kOT.update({
      where: { id: item.kotId },
      data: { status: kotStatus },
    });

    // Roll up parent order for CDS board
    const orderId = item.kot.orderId;
    const outletId = item.kot.order.outletId;
    const orgId = item.kot.order.organizationId;
    const allKots = await this.prisma.kOT.findMany({
      where: { orderId },
      include: { items: true },
    });
    const allItemStatuses = allKots.flatMap((k) =>
      k.items.map((i) => (i.id === itemId ? dbStatus : i.status.toLowerCase())),
    );
    let orderStatus: string | null = null;
    if (
      allItemStatuses.length > 0 &&
      allItemStatuses.every((s) => s === "served" || s === "cancelled")
    ) {
      orderStatus = "served";
    } else if (
      allItemStatuses.length > 0 &&
      allItemStatuses.every((s) => s === "ready" || s === "served" || s === "cancelled")
    ) {
      orderStatus = "ready";
    } else if (allItemStatuses.some((s) => s === "preparing" || s === "ready" || s === "served")) {
      orderStatus = "preparing";
    }

    if (
      orderStatus &&
      ["confirmed", "preparing", "ready"].includes(item.kot.order.status)
    ) {
      const now = new Date();
      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: orderStatus as never,
          ...(orderStatus === "ready" && item.kot.order.status !== "ready"
            ? { readyAt: now }
            : {}),
          timeline: {
            create: {
              event: "order.status_changed",
              metadata: { status: orderStatus, source: "kds" },
            },
          },
        },
        include: { items: true },
      });
      this.ws.emitToOutlet(outletId, "order.updated", {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
      });
      if (orderStatus === "ready") {
        this.ws.emitToOutlet(outletId, "order.ready", {
          id: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
        });
      }
    }

    const mappedItem = {
      id: updatedItem.id,
      kotId: updatedItem.kotId,
      kitchenStationId: item.kot.kitchenStationId,
      name: updatedItem.orderItem.name,
      quantity: updatedItem.orderItem.quantity,
      status: toUiStatus(updatedItem.status),
      notes: updatedItem.orderItem.notes,
      startedAt: null as string | null,
      readyAt: null as string | null,
      createdAt: item.kot.createdAt.toISOString(),
    };

    this.ws.emitToOutlet(outletId, "kot.updated", {
      kotId: item.kotId,
      item: mappedItem,
      orgId,
    });

    return mappedItem;
  }
}
