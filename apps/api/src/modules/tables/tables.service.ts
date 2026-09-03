import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";
import { fromApiTableStatus, toApiTableStatus } from "../../common/status.util";

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService, private ws: WebsocketGateway) {}

  async create(
    orgId: string,
    data: {
      outletId: string;
      name: string;
      capacity?: number;
      sectionName?: string;
    },
  ) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: data.outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    if (!data.name?.trim()) throw new BadRequestException("Table name is required");

    let floor = await this.prisma.floor.findFirst({
      where: { outletId: data.outletId, name: "Main" },
      orderBy: { sortOrder: "asc" },
    });
    if (!floor) {
      floor = await this.prisma.floor.create({
        data: { outletId: data.outletId, name: "Main", sortOrder: 0 },
      });
    }

    const sectionName = data.sectionName?.trim() || "Dining";
    let section = await this.prisma.section.findFirst({
      where: { floorId: floor.id, name: sectionName },
      orderBy: { sortOrder: "asc" },
    });
    if (!section) {
      section = await this.prisma.section.create({
        data: { floorId: floor.id, name: sectionName, sortOrder: 0 },
      });
    }

    const qrCode = `tbl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const table = await this.prisma.table.create({
      data: {
        sectionId: section.id,
        name: data.name.trim(),
        capacity: data.capacity && data.capacity > 0 ? data.capacity : 4,
        qrCode,
        status: "available",
      },
      include: { section: true },
    });

    return {
      id: table.id,
      outletId: data.outletId,
      sectionId: table.sectionId,
      name: table.name,
      capacity: table.capacity,
      status: toApiTableStatus(table.status),
      qrCode: table.qrCode,
      section: table.section
        ? { id: table.section.id, name: table.section.name }
        : null,
    };
  }

  async listByOutlet(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const tables = await this.prisma.table.findMany({
      where: { section: { floor: { outletId } } },
      include: { section: true },
      orderBy: [{ section: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    });

    return tables.map((table) => ({
      id: table.id,
      outletId,
      sectionId: table.sectionId,
      name: table.name,
      capacity: table.capacity,
      status: toApiTableStatus(table.status),
      qrCode: table.qrCode,
      section: table.section ? { id: table.section.id, name: table.section.name } : null,
    }));
  }

  /** Public list for QR ordering — no auth. */
  async listByOutletPublic(outletId: string) {
    const tables = await this.prisma.table.findMany({
      where: { section: { floor: { outletId } } },
      select: { id: true, name: true, qrCode: true },
    });
    return tables;
  }

  async updateStatus(
    orgId: string,
    outletId: string,
    tableId: string,
    status: string,
  ) {
    const table = await this.prisma.table.findFirst({
      where: {
        id: tableId,
        section: { floor: { outletId, outlet: { organizationId: orgId } } },
      },
      include: { section: true },
    });
    if (!table) throw new NotFoundException("Table not found");

    const normalized = fromApiTableStatus(status);
    const valid = ["available", "occupied", "reserved", "cleaning", "billing"];
    if (!valid.includes(normalized)) {
      throw new BadRequestException(`Invalid table status: ${status}`);
    }

    const updated = await this.prisma.table.update({
      where: { id: tableId },
      data: { status: normalized as never },
      include: { section: true },
    });

    if (normalized === "available") {
      await this.prisma.tableSession.updateMany({
        where: { tableId, status: "active" },
        data: { status: "closed", endedAt: new Date() },
      });
    }

    const payload = {
      id: updated.id,
      outletId,
      sectionId: updated.sectionId,
      name: updated.name,
      capacity: updated.capacity,
      status: toApiTableStatus(updated.status),
      qrCode: updated.qrCode,
      section: updated.section
        ? { id: updated.section.id, name: updated.section.name }
        : null,
    };

    this.ws.emitToOutlet(outletId, "table.updated", payload);
    return payload;
  }
}
