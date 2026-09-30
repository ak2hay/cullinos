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
import { releaseMergedTables, repointMergedTables } from "./table-merge.util";
import { businessTypeUsesTables } from "./business-type-tables.util";

const GUEST_APP_BASE =
  process.env.GUEST_APP_URL ?? "https://guest.cullinos.com";

const CLOSED_ORDER_STATUSES: readonly string[] = ["completed", "cancelled", "voided"];

@Injectable()
export class TableSessionsService {
  constructor(
    private prisma: PrismaService,
    private ws: WebsocketGateway,
    private ordersService: OrdersService,
  ) {}

  async transferTable(
    orgId: string,
    outletId: string,
    fromTableId: string,
    toTableId: string,
  ) {
    if (fromTableId === toTableId) {
      throw new BadRequestException("Cannot transfer a table to itself");
    }
    const fromTable = await this.assertTable(orgId, outletId, fromTableId);
    const toTable = await this.assertTable(orgId, outletId, toTableId);
    if (fromTable.mergedIntoTableId) {
      throw new BadRequestException(
        `${fromTable.name} is merged with ${fromTable.mergedInto?.name ?? "another table"} — transfer that table instead`,
      );
    }
    if (toTable.mergedIntoTableId) {
      throw new BadRequestException(`${toTable.name} is merged with another table`);
    }

    const fromSession = await this.findActiveSession(fromTableId);
    const fromOrders = await this.openOrdersForTable(orgId, outletId, fromTableId);
    if (!fromSession && fromOrders.length === 0) {
      throw new BadRequestException("Source table has no active session or open order");
    }

    const toBusy = await this.findActiveSession(toTableId);
    if (toBusy) throw new BadRequestException("Target table already has an active session");
    const toOrders = await this.openOrdersForTable(orgId, outletId, toTableId);
    if (toOrders.length > 0) {
      throw new BadRequestException("Target table already has an open order");
    }
    if (toTable.status !== "available") {
      throw new BadRequestException(`${toTable.name} is not free`);
    }

    const orderIds = new Set(fromOrders.map((o) => o.id));
    if (fromSession?.order) orderIds.add(fromSession.order.id);

    const movedChildren = await this.prisma.$transaction(async (tx) => {
      if (fromSession) {
        await tx.tableSession.update({
          where: { id: fromSession.id },
          data: { tableId: toTableId },
        });
      }
      if (orderIds.size > 0) {
        await tx.order.updateMany({
          where: { id: { in: [...orderIds] }, organizationId: orgId },
          data: { tableId: toTableId },
        });
      }
      await tx.table.update({ where: { id: fromTableId }, data: { status: "available" } });
      await tx.table.update({ where: { id: toTableId }, data: { status: "occupied" } });
      return repointMergedTables(tx, fromTableId, toTableId);
    });

    this.emitTable(outletId, fromTableId, "AVAILABLE");
    this.emitTable(outletId, toTableId, "OCCUPIED");
    for (const id of movedChildren) {
      this.emitTable(outletId, id, "OCCUPIED", { id: toTableId, name: toTable.name });
    }

    return this.getActiveSession(orgId, outletId, toTableId);
  }

  async mergeTables(
    orgId: string,
    outletId: string,
    primaryTableId: string,
    tableIds: string[],
  ) {
    const unique = [...new Set(tableIds.filter((id) => id !== primaryTableId))];
    if (unique.length === 0) {
      throw new BadRequestException("Select at least one other table to merge");
    }
    const primary = await this.assertTable(orgId, outletId, primaryTableId);
    if (primary.mergedIntoTableId) {
      throw new BadRequestException(
        `${primary.name} is merged with ${primary.mergedInto?.name ?? "another table"} — pick that table as the main table`,
      );
    }
    const toLink: string[] = [];
    for (const id of unique) {
      const t = await this.assertTable(orgId, outletId, id);
      if (t.mergedIntoTableId === primaryTableId) continue;
      if (t.mergedIntoTableId) {
        throw new BadRequestException(
          `${t.name} is already merged with ${t.mergedInto?.name ?? "another table"}`,
        );
      }
      toLink.push(id);
    }
    if (toLink.length === 0) {
      throw new BadRequestException(`Selected tables are already merged with ${primary.name}`);
    }

    const secondaries: Array<{
      tableId: string;
      sessionId: string | null;
      orders: Awaited<ReturnType<TableSessionsService["openOrdersForTable"]>>;
    }> = [];
    for (const secondaryId of toLink) {
      const session = await this.findActiveSession(secondaryId);
      const orders = await this.openOrdersForTable(orgId, outletId, secondaryId);
      const sessionOrder = session?.order;
      if (
        sessionOrder &&
        !CLOSED_ORDER_STATUSES.includes(sessionOrder.status) &&
        !orders.some((o) => o.id === sessionOrder.id)
      ) {
        const extra = await this.prisma.order.findFirst({
          where: { id: sessionOrder.id, organizationId: orgId },
          include: { items: true },
        });
        if (extra) orders.push(extra);
      }
      secondaries.push({ tableId: secondaryId, sessionId: session?.id ?? null, orders });
    }

    let primarySession = await this.findActiveSession(primaryTableId);
    const primaryOrders = await this.openOrdersForTable(orgId, outletId, primaryTableId);
    if (!primarySession && primaryOrders.length === 0) {
      await this.startSession(orgId, outletId, primaryTableId);
      primarySession = await this.findActiveSession(primaryTableId);
    }

    let target: { id: string; orderNumber: string } | null =
      primarySession?.order && !CLOSED_ORDER_STATUSES.includes(primarySession.order.status)
        ? primarySession.order
        : (primaryOrders[0] ?? null);

    for (const secondary of secondaries) {
      for (const order of secondary.orders) {
        if (!target) {
          const linkToPrimarySession = primarySession && !primarySession.order;
          const moved = await this.prisma.order.update({
            where: { id: order.id },
            data: {
              tableId: primaryTableId,
              tableSessionId: linkToPrimarySession ? primarySession!.id : null,
            },
          });
          target = { id: moved.id, orderNumber: moved.orderNumber };
          if (linkToPrimarySession) {
            primarySession = await this.findActiveSession(primaryTableId);
          }
          continue;
        }
        if (order.id === target.id) continue;

        await this.ordersService.absorbOrder(orgId, order.id, target.id);
      }

      const secondaryId = secondary.tableId;
      const secondarySessionId = secondary.sessionId;
      const linked = await this.prisma.$transaction(async (tx) => {
        if (secondarySessionId) {
          await tx.tableSession.update({
            where: { id: secondarySessionId },
            data: { status: "closed", endedAt: new Date() },
          });
        }
        await tx.table.update({
          where: { id: secondaryId },
          data: { status: "occupied", mergedIntoTableId: primaryTableId },
        });
        const moved = await repointMergedTables(tx, secondaryId, primaryTableId);
        return [secondaryId, ...moved];
      });

      for (const id of linked) {
        this.emitTable(outletId, id, "OCCUPIED", { id: primaryTableId, name: primary.name });
      }
    }

    await this.prisma.table.update({
      where: { id: primaryTableId },
      data: { status: "occupied" },
    });
    this.emitTable(outletId, primaryTableId, "OCCUPIED");

    return this.getActiveSession(orgId, outletId, primaryTableId);
  }

  /** Detach one merged table from its primary and free it. */
  async unmergeTable(orgId: string, outletId: string, tableId: string) {
    const table = await this.assertTable(orgId, outletId, tableId);
    const primaryId = table.mergedIntoTableId;
    if (!primaryId) {
      throw new BadRequestException(`${table.name} is not merged with another table`);
    }
    await this.prisma.table.update({
      where: { id: tableId },
      data: { mergedIntoTableId: null, status: "available" },
    });
    this.emitTable(outletId, tableId, "AVAILABLE");
    this.ws.emitToOutlet(outletId, "table.updated", { id: primaryId, outletId });
    return { success: true, tableId };
  }

  private emitTable(
    outletId: string,
    id: string,
    status: string,
    mergedInto?: { id: string; name: string },
  ) {
    this.ws.emitToOutlet(outletId, "table.updated", {
      id,
      outletId,
      status,
      mergedIntoTableId: mergedInto?.id ?? null,
      mergedIntoTableName: mergedInto?.name ?? null,
    });
  }

  private async assertTable(orgId: string, outletId: string, tableId: string) {
    const table = await this.prisma.table.findFirst({
      where: {
        id: tableId,
        section: { floor: { outletId, outlet: { organizationId: orgId } } },
      },
      include: {
        section: { include: { floor: { include: { outlet: { include: { organization: true } } } } } },
        mergedInto: { select: { id: true, name: true } },
      },
    });
    if (!table) throw new NotFoundException("Table not found");
    return table;
  }

  private findActiveSession(tableId: string) {
    return this.prisma.tableSession.findFirst({
      where: { tableId, status: "active" },
      include: { order: true },
    });
  }

  /** Open orders on a table, newest first — includes POS/waiter orders that have no TableSession. */
  private openOrdersForTable(orgId: string, outletId: string, tableId: string) {
    return this.prisma.order.findMany({
      where: {
        tableId,
        organizationId: orgId,
        outletId,
        status: { notIn: ["completed", "cancelled", "voided"] },
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async startSession(
    orgId: string,
    outletId: string,
    tableId: string,
    guestCount?: number,
  ) {
    const table = await this.assertTable(orgId, outletId, tableId);
    if (!businessTypeUsesTables(table.section.floor.outlet.organization?.businessType)) {
      throw new BadRequestException("This business type does not use tables");
    }
    if (table.mergedIntoTableId) {
      throw new BadRequestException(
        `${table.name} is merged with ${table.mergedInto?.name ?? "another table"} — use that table`,
      );
    }

    const existing = await this.prisma.tableSession.findFirst({
      where: { tableId, status: "active" },
      include: { order: true },
    });
    if (existing) {
      const sessionToken = randomUUID().replace(/-/g, "");
      const rotated = await this.prisma.tableSession.update({
        where: { id: existing.id },
        data: { sessionToken },
        include: { order: true },
      });
      const org = table.section.floor.outlet.organization;
      const outlet = table.section.floor.outlet;
      return this.mapSessionResponse(rotated, table, org.slug, outlet.slug);
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

  /**
   * Guest permanent-table QR: join an active session without rotating the token,
   * or create one if none exists.
   */
  async joinOrCreateByQrCode(qrCode: string) {
    const code = qrCode?.trim();
    if (!code) throw new BadRequestException("QR code is required");

    const tableInclude = {
      section: {
        include: {
          floor: { include: { outlet: { include: { organization: true } } } },
        },
      },
    } as const;
    const scanned = await this.prisma.table.findFirst({
      where: { qrCode: code },
      include: tableInclude,
    });
    if (!scanned) throw new NotFoundException("Table not found for this QR code");

    // A merged table's sticker joins the primary table's session so the group shares one order.
    const table =
      (scanned.mergedIntoTableId
        ? await this.prisma.table.findFirst({
            where: { id: scanned.mergedIntoTableId },
            include: tableInclude,
          })
        : null) ?? scanned;

    const outlet = table.section.floor.outlet;
    const org = outlet.organization;
    if (outlet.status !== "active" || org.status === "suspended" || org.status === "cancelled") {
      throw new BadRequestException("This restaurant is not accepting QR orders right now");
    }

    const existing = await this.prisma.tableSession.findFirst({
      where: { tableId: table.id, status: "active" },
      include: { order: true },
    });
    if (existing) {
      return {
        ...this.mapSessionResponse(existing, table, org.slug, outlet.slug),
        organizationId: org.id,
        organizationSlug: org.slug,
        organizationName: org.name,
        outletId: outlet.id,
        outletSlug: outlet.slug,
        outletName: outlet.name,
        qrCode: table.qrCode,
        joinedExisting: true,
      };
    }

    const sessionToken = randomUUID().replace(/-/g, "");
    const session = await this.prisma.$transaction(async (tx) => {
      await tx.table.update({
        where: { id: table.id },
        data: { status: "occupied" },
      });
      return tx.tableSession.create({
        data: {
          tableId: table.id,
          sessionToken,
          status: "active",
        },
        include: { order: true },
      });
    });

    this.ws.emitToOutlet(outlet.id, "table.updated", {
      id: table.id,
      outletId: outlet.id,
      name: table.name,
      status: "OCCUPIED",
    });

    return {
      ...this.mapSessionResponse(session, table, org.slug, outlet.slug),
      organizationId: org.id,
      organizationSlug: org.slug,
      organizationName: org.name,
      outletId: outlet.id,
      outletSlug: outlet.slug,
      outletName: outlet.name,
      qrCode: table.qrCode,
      joinedExisting: false,
    };
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

    const openOrders = await this.prisma.order.count({
      where: {
        organizationId: orgId,
        OR: [{ tableSessionId: sessionId }, { tableId }],
        status: { notIn: ["completed", "cancelled", "voided"] },
      },
    });
    if (openOrders > 0) {
      throw new BadRequestException("Settle or cancel open orders before closing the table");
    }

    const released = await this.prisma.$transaction(async (tx) => {
      await tx.tableSession.update({
        where: { id: sessionId },
        data: { status: "closed", endedAt: new Date() },
      });
      await tx.table.update({
        where: { id: tableId },
        data: { status: "available" },
      });
      return releaseMergedTables(tx, tableId, "available");
    });

    this.emitTable(outletId, tableId, "AVAILABLE");
    for (const id of released) this.emitTable(outletId, id, "AVAILABLE");

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
    meta?: {
      customerName?: string;
      notes?: string;
      ageConfirmed?: boolean;
      /** Must already be ownership-verified by the caller. */
      customerId?: string;
    },
  ) {
    const session = await this.getActiveSessionByToken(token);
    const outlet = session.table.section.floor.outlet;
    const orgId = outlet.organizationId;

    if (!items.length) {
      throw new BadRequestException("At least one item is required");
    }

    const existingOrder = session.order;

    if (existingOrder && !["completed", "cancelled", "voided"].includes(existingOrder.status)) {
      const updated = await this.ordersService.addItems(orgId, existingOrder.id, items, {
        customerOrder: true,
        ageConfirmed: meta?.ageConfirmed === true,
      });
      const linkCustomer = !existingOrder.customerId && !!meta?.customerId;
      if (meta?.customerName || meta?.notes || linkCustomer) {
        await this.prisma.order.update({
          where: { id: existingOrder.id },
          data: {
            customerName: meta?.customerName ?? existingOrder.customerName,
            notes: meta?.notes ?? existingOrder.notes,
            ...(linkCustomer ? { customerId: meta!.customerId } : {}),
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
      customerId: meta?.customerId,
      customerName: meta?.customerName,
      notes: meta?.notes,
      items,
      autoConfirm: false,
      customerOrder: true,
      ageConfirmed: meta?.ageConfirmed === true,
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

  async organizationIdForToken(token: string): Promise<string> {
    const session = await this.getActiveSessionByToken(token);
    return session.table.section.floor.outlet.organizationId;
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
        ? `${GUEST_APP_BASE}/o/${encodeURIComponent(orgSlug)}/${encodeURIComponent(outletSlug)}?${new URLSearchParams({ session: session.sessionToken }).toString()}`
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
