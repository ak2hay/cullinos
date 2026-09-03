import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";
import { IncomingOrderItem } from "../../common/order-items.util";
import { OrdersService } from "../orders/orders.service";
import { toApiTableStatus } from "../../common/status.util";

const CUSTOMER_APP_BASE =
  process.env.CUSTOMER_APP_URL ?? "https://order.cullinos.com";

@Injectable()
export class TableSessionsService {
  constructor(
    private prisma: PrismaService,
    private ws: WebsocketGateway,
    private ordersService: OrdersService,
  ) {}

  private async assertTable(orgId: string, outletId: string, tableId: string) {
    const table = await this.prisma.table.findFirst({
      where: {
        id: tableId,
        section: { floor: { outletId, outlet: { organizationId: orgId } } },
      },
      include: {
        section: { include: { floor: { include: { outlet: { include: { organization: true } } } } } },
      },
    });
    if (!table) throw new NotFoundException("Table not found");
    return table;
  }

  async startSession(
    orgId: string,
    outletId: string,
    tableId: string,
    guestCount?: number,
  ) {
    const table = await this.assertTable(orgId, outletId, tableId);

    const existing = await this.prisma.tableSession.findFirst({
      where: { tableId, status: "active" },
      include: { order: true },
    });
    if (existing) {
      const org = table.section.floor.outlet.organization;
      const outlet = table.section.floor.outlet;
      return this.mapSessionResponse(existing, table, org.slug, outlet.slug);
    }

    const sessionToken = randomUUID().replace(/-/g, "");

    const session = await this.prisma.$transaction(async (tx) => {
      await tx.table.update({
        where: { id: tableId },
        data: { status: "occupied" },
      });

      return tx.tableSession.create({
        data: {
          tableId,
          sessionToken,
          guestCount,
          status: "active",
        },
        include: { order: true },
      });
    });

    const org = table.section.floor.outlet.organization;
    const outlet = table.section.floor.outlet;

    this.ws.emitToOutlet(outletId, "table.updated", {
      id: table.id,
      outletId,
      name: table.name,
      status: "OCCUPIED",
    });

    return this.mapSessionResponse(session, table, org.slug, outlet.slug);
  }

  async getActiveSession(orgId: string, outletId: string, tableId: string) {
    const table = await this.assertTable(orgId, outletId, tableId);
    const session = await this.prisma.tableSession.findFirst({
      where: { tableId, status: "active" },
      include: { order: true },
    });
    if (!session) return null;
    const org = table.section.floor.outlet.organization;
    const outlet = table.section.floor.outlet;
    return this.mapSessionResponse(session, table, org.slug, outlet.slug);
  }

  async closeSession(
    orgId: string,
    outletId: string,
    tableId: string,
    sessionId: string,
  ) {
    await this.assertTable(orgId, outletId, tableId);

    const session = await this.prisma.tableSession.findFirst({
      where: { id: sessionId, tableId, status: "active" },
    });
    if (!session) throw new NotFoundException("Active session not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.tableSession.update({
        where: { id: sessionId },
        data: { status: "closed", endedAt: new Date() },
      });
      await tx.table.update({
        where: { id: tableId },
        data: { status: "available" },
      });
    });

    this.ws.emitToOutlet(outletId, "table.updated", {
      id: tableId,
      outletId,
      status: "AVAILABLE",
    });

    return { success: true, sessionId };
  }

  async validatePublicSession(token: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { sessionToken: token },
      include: {
        order: { select: { id: true, orderNumber: true, status: true } },
        table: {
          include: {
            section: {
              include: {
                floor: {
                  include: {
                    outlet: { include: { organization: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) throw new NotFoundException("Session not found");

    const outlet = session.table.section.floor.outlet;
    const org = outlet.organization;

    return {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      sessionActive: session.status === "active",
      tableId: session.tableId,
      tableName: session.table.name,
      organizationId: org.id,
      organizationSlug: org.slug,
      organizationName: org.name,
      outletId: outlet.id,
      outletSlug: outlet.slug,
      outletName: outlet.name,
      orderId: session.order?.id ?? null,
      orderNumber: session.order?.orderNumber ?? null,
      orderStatus: session.order?.status?.toUpperCase() ?? null,
    };
  }

  async addItemsToSession(
    token: string,
    items: IncomingOrderItem[],
    meta?: { customerName?: string; notes?: string },
  ) {
    const session = await this.getActiveSessionByToken(token);
    const outlet = session.table.section.floor.outlet;
    const orgId = outlet.organizationId;

    if (!items.length) {
      throw new BadRequestException("At least one item is required");
    }

    const existingOrder = session.order;

    if (existingOrder && !["completed", "cancelled", "voided"].includes(existingOrder.status)) {
      const updated = await this.ordersService.addItems(orgId, existingOrder.id, items);
      if (meta?.customerName || meta?.notes) {
        await this.prisma.order.update({
          where: { id: existingOrder.id },
          data: {
            customerName: meta.customerName ?? existingOrder.customerName,
            notes: meta.notes ?? existingOrder.notes,
          },
        });
      }
      return updated;
    }

    return this.ordersService.create(orgId, null, {
      outletId: outlet.id,
      source: "QR",
      tableId: session.tableId,
      tableSessionId: session.id,
      customerName: meta?.customerName,
      notes: meta?.notes,
      items,
      autoConfirm: false,
    });
  }

  async submitSessionOrder(token: string) {
    const session = await this.getActiveSessionByToken(token);
    const outlet = session.table.section.floor.outlet;
    const orgId = outlet.organizationId;

    if (!session.order) {
      throw new BadRequestException("No items in this session order yet");
    }

    const order = session.order;
    if (order.status === "draft") {
      return this.ordersService.confirm(orgId, order.id);
    }

    if (order.status === "confirmed" || order.status === "preparing") {
      return this.ordersService.createKotForOrder(orgId, order.id);
    }

    return this.ordersService.get(orgId, order.id);
  }

  private async getActiveSessionByToken(token: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { sessionToken: token },
      include: {
        order: true,
        table: {
          include: {
            section: {
              include: {
                floor: { include: { outlet: { include: { organization: true } } } },
              },
            },
          },
        },
      },
    });

    if (!session) throw new NotFoundException("Session not found");
    if (session.status !== "active") {
      throw new BadRequestException("This dining session has ended");
    }

    return session;
  }

  private mapSessionResponse(
    session: {
      id: string;
      sessionToken: string;
      status: string;
      guestCount: number | null;
      startedAt: Date;
      order?: { id: string; orderNumber: string; status: string } | null;
    },
    table: { id: string; name: string; status: string },
    orgSlug?: string,
    outletSlug?: string,
  ) {
    const qrUrl =
      orgSlug && outletSlug
        ? `${CUSTOMER_APP_BASE}/${orgSlug}/${outletSlug}?session=${session.sessionToken}`
        : null;

    return {
      id: session.id,
      sessionToken: session.sessionToken,
      status: session.status.toUpperCase(),
      guestCount: session.guestCount,
      startedAt: session.startedAt.toISOString(),
      tableId: table.id,
      tableName: table.name,
      tableStatus: toApiTableStatus(table.status as never),
      orderId: session.order?.id ?? null,
      orderNumber: session.order?.orderNumber ?? null,
      qrUrl,
    };
  }
}
