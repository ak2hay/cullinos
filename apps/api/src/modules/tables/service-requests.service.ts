import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";

type ServiceRequestType = "waiter" | "bill" | "water" | "cutlery" | "napkins" | "other";
type ServiceRequestStatus = "open" | "acknowledged" | "resolved" | "cancelled";

const ACTIVE_STATUSES: ServiceRequestStatus[] = ["open", "acknowledged"];
/** Freeze between re-notifies for the same table + type while still open. */
export const SERVICE_REQUEST_COOLDOWN_MS = 60_000;

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private ws: WebsocketGateway,
  ) {}

  private mapRequest(row: {
    id: string;
    organizationId: string;
    outletId: string;
    tableId: string;
    tableSessionId: string | null;
    type: string;
    status: string;
    note: string | null;
    acknowledgedById: string | null;
    acknowledgedAt: Date | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    table?: { name: string } | null;
  }) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      outletId: row.outletId,
      tableId: row.tableId,
      tableName: row.table?.name ?? null,
      tableSessionId: row.tableSessionId,
      type: row.type,
      status: row.status,
      note: row.note,
      acknowledgedById: row.acknowledgedById,
      acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      lastNotifiedAt: row.updatedAt.toISOString(),
    };
  }

  private emit(
    outletId: string,
    event: "service_request.created" | "service_request.updated",
    payload: unknown,
  ) {
    this.ws.emitToOutlet(outletId, event, payload);
  }

  private throwCooldown(remainingMs: number): never {
    throw new HttpException(
      {
        code: "SERVICE_REQUEST_COOLDOWN",
        message: "Please wait before calling again",
        details: {
          cooldownRemainingMs: remainingMs,
          cooldownMs: SERVICE_REQUEST_COOLDOWN_MS,
        },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async createFromSession(
    token: string,
    input?: { type?: ServiceRequestType; note?: string },
  ) {
    const session = await this.prisma.tableSession.findUnique({
      where: { sessionToken: token },
      include: {
        table: {
          include: {
            section: {
              include: {
                floor: { include: { outlet: true } },
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

    const outlet = session.table.section.floor.outlet;
    const type: ServiceRequestType = input?.type ?? "waiter";
    const note = input?.note?.trim() || null;

    const existing = await this.prisma.serviceRequest.findFirst({
      where: {
        tableId: session.tableId,
        status: { in: ACTIVE_STATUSES },
        type,
      },
      include: { table: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      const elapsed = Date.now() - existing.updatedAt.getTime();
      if (elapsed < SERVICE_REQUEST_COOLDOWN_MS) {
        this.throwCooldown(SERVICE_REQUEST_COOLDOWN_MS - elapsed);
      }

      const updated = await this.prisma.serviceRequest.update({
        where: { id: existing.id },
        data: {
          note: note ?? existing.note,
          // Touch updatedAt as last-notified timestamp
          updatedAt: new Date(),
          tableSessionId: session.id,
        },
        include: { table: { select: { name: true } } },
      });

      const mapped = {
        ...this.mapRequest(updated),
        reused: true as const,
        reminded: true as const,
      };
      this.emit(outlet.id, "service_request.updated", mapped);
      return mapped;
    }

    const created = await this.prisma.serviceRequest.create({
      data: {
        organizationId: outlet.organizationId,
        outletId: outlet.id,
        tableId: session.tableId,
        tableSessionId: session.id,
        type,
        note,
        status: "open",
      },
      include: { table: { select: { name: true } } },
    });

    const mapped = this.mapRequest(created);
    this.emit(outlet.id, "service_request.created", mapped);
    return { ...mapped, reused: false as const, reminded: false as const };
  }

  async listForOutlet(
    orgId: string,
    outletId: string,
    status?: string,
  ) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const statusFilter = status
      ? status.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : ACTIVE_STATUSES;

    const rows = await this.prisma.serviceRequest.findMany({
      where: {
        organizationId: orgId,
        outletId,
        status: { in: statusFilter as ServiceRequestStatus[] },
      },
      include: { table: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });

    return rows.map((row) => this.mapRequest(row));
  }

  private async getOwnedRequest(orgId: string, outletId: string, id: string) {
    const row = await this.prisma.serviceRequest.findFirst({
      where: { id, organizationId: orgId, outletId },
      include: { table: { select: { name: true } } },
    });
    if (!row) throw new NotFoundException("Service request not found");
    return row;
  }

  async acknowledge(orgId: string, outletId: string, id: string, userId: string) {
    const row = await this.getOwnedRequest(orgId, outletId, id);
    if (row.status === "resolved" || row.status === "cancelled") {
      throw new BadRequestException("Service request is already closed");
    }

    if (row.status === "acknowledged") {
      return this.mapRequest(row);
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id: row.id },
      data: {
        status: "acknowledged",
        acknowledgedById: userId,
        acknowledgedAt: new Date(),
      },
      include: { table: { select: { name: true } } },
    });

    const mapped = this.mapRequest(updated);
    this.emit(outletId, "service_request.updated", mapped);
    return mapped;
  }

  async resolve(orgId: string, outletId: string, id: string, userId: string) {
    const row = await this.getOwnedRequest(orgId, outletId, id);
    if (row.status === "resolved" || row.status === "cancelled") {
      throw new BadRequestException("Service request is already closed");
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id: row.id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        acknowledgedById: row.acknowledgedById ?? userId,
        acknowledgedAt: row.acknowledgedAt ?? new Date(),
      },
      include: { table: { select: { name: true } } },
    });

    const mapped = this.mapRequest(updated);
    this.emit(outletId, "service_request.updated", mapped);
    return mapped;
  }
}
