import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WebsocketGateway } from "../../websocket/websocket.gateway";
import { fromApiTableStatus, toApiTableStatus } from "../../common/status.util";

const GUEST_APP_BASE =
  process.env.GUEST_APP_URL ?? "https://guest.cullinos.com";

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService, private ws: WebsocketGateway) {}

  /** Cullinos App deep link (App Links on guest.cullinos.com). */
  private buildQrUrl(orgSlug: string, outletSlug: string, qrCode: string) {
    const q = new URLSearchParams({ table: qrCode });
    return `${GUEST_APP_BASE}/o/${encodeURIComponent(orgSlug)}/${encodeURIComponent(outletSlug)}?${q.toString()}`;
  }

  private newQrCode() {
    return `tbl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  async create(
    orgId: string,
    data: {
      outletId: string;
      name: string;
      capacity?: number;
      sectionName?: string;
      floorId?: string;
      sectionId?: string;
      floorName?: string;
    },
  ) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: data.outletId, organizationId: orgId },
      include: { organization: true },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    if (!data.name?.trim()) throw new BadRequestException("Table name is required");

    let section =
      data.sectionId
        ? await this.prisma.section.findFirst({
            where: {
              id: data.sectionId,
              floor: { outletId: data.outletId, outlet: { organizationId: orgId } },
            },
          })
        : null;

    if (!section) {
      let floor =
        data.floorId
          ? await this.prisma.floor.findFirst({
              where: {
                id: data.floorId,
                outletId: data.outletId,
                outlet: { organizationId: orgId },
              },
            })
          : null;
      if (!floor) {
        const floorName = data.floorName?.trim() || "Main";
        floor = await this.prisma.floor.findFirst({
          where: { outletId: data.outletId, name: floorName },
          orderBy: { sortOrder: "asc" },
        });
        if (!floor) {
          floor = await this.prisma.floor.create({
            data: {
              outletId: data.outletId,
              name: floorName,
              sortOrder: 0,
            },
          });
        }
      }

      const sectionName = data.sectionName?.trim() || "Dining";
      section = await this.prisma.section.findFirst({
        where: { floorId: floor.id, name: sectionName },
        orderBy: { sortOrder: "asc" },
      });
      if (!section) {
        section = await this.prisma.section.create({
          data: { floorId: floor.id, name: sectionName, sortOrder: 0 },
        });
      }
    }

    const qrCode = this.newQrCode();
    const table = await this.prisma.table.create({
      data: {
        sectionId: section.id,
        name: data.name.trim(),
        capacity: data.capacity && data.capacity > 0 ? data.capacity : 4,
        qrCode,
        status: "available",
      },
      include: {
        section: { include: { floor: true } },
      },
    });

    return this.mapTable(table, data.outletId, outlet.organization.slug, outlet.slug);
  }

  private mapTable(
    table: {
      id: string;
      sectionId: string;
      name: string;
      capacity: number;
      status: string;
      qrCode: string | null;
      section: {
        id: string;
        name: string;
        floor?: { id: string; name: string; sortOrder: number } | null;
      } | null;
    },
    outletId: string,
    orgSlug: string,
    outletSlug: string,
  ) {
    return {
      id: table.id,
      outletId,
      sectionId: table.sectionId,
      name: table.name,
      capacity: table.capacity,
      status: toApiTableStatus(table.status),
      qrCode: table.qrCode,
      qrUrl: table.qrCode
        ? this.buildQrUrl(orgSlug, outletSlug, table.qrCode)
        : null,
      section: table.section
        ? {
            id: table.section.id,
            name: table.section.name,
            floor: table.section.floor
              ? {
                  id: table.section.floor.id,
                  name: table.section.floor.name,
                  sortOrder: table.section.floor.sortOrder,
                }
              : null,
          }
        : null,
    };
  }

  async listByOutlet(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
      include: { organization: true },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const tables = await this.prisma.table.findMany({
      where: { section: { floor: { outletId } } },
      include: { section: { include: { floor: true } } },
      orderBy: [
        { section: { floor: { sortOrder: "asc" } } },
        { section: { sortOrder: "asc" } },
        { sortOrder: "asc" },
      ],
    });

    return tables.map((table) =>
      this.mapTable(table, outletId, outlet.organization.slug, outlet.slug),
    );
  }

  async listFloors(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const floors = await this.prisma.floor.findMany({
      where: { outletId },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: { _count: { select: { tables: true } } },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return floors.map((f) => ({
      id: f.id,
      outletId: f.outletId,
      name: f.name,
      sortOrder: f.sortOrder,
      sections: f.sections.map((s) => ({
        id: s.id,
        name: s.name,
        sortOrder: s.sortOrder,
        tableCount: s._count.tables,
      })),
    }));
  }

  async createFloor(
    orgId: string,
    outletId: string,
    data: { name: string; sortOrder?: number },
  ) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    const name = data.name?.trim();
    if (!name) throw new BadRequestException("Floor name is required");
    await this.assertFloorNameAvailable(outletId, name);

    const floor = await this.prisma.floor.create({
      data: {
        outletId,
        name,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    // Default section so tables can be placed immediately
    await this.prisma.section.create({
      data: { floorId: floor.id, name: "Dining", sortOrder: 0 },
    });
    return this.listFloors(orgId, outletId).then((floors) =>
      floors.find((f) => f.id === floor.id),
    );
  }

  private async assertFloorNameAvailable(
    outletId: string,
    name: string,
    excludeFloorId?: string,
  ) {
    const clash = await this.prisma.floor.findFirst({
      where: {
        outletId,
        name: { equals: name, mode: "insensitive" },
        ...(excludeFloorId ? { id: { not: excludeFloorId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException(`A floor named "${name}" already exists in this outlet`);
    }
  }

  private async findScopedFloor(orgId: string, outletId: string, floorId: string) {
    const floor = await this.prisma.floor.findFirst({
      where: { id: floorId, outletId, outlet: { organizationId: orgId } },
    });
    if (!floor) throw new NotFoundException("Floor not found");
    return floor;
  }

  async updateFloor(
    orgId: string,
    outletId: string,
    floorId: string,
    data: { name?: string; sortOrder?: number },
  ) {
    await this.findScopedFloor(orgId, outletId, floorId);

    const patch: { name?: string; sortOrder?: number } = {};
    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name) throw new BadRequestException("Floor name is required");
      if (name.length > 80) throw new BadRequestException("Floor name is too long");
      await this.assertFloorNameAvailable(outletId, name, floorId);
      patch.name = name;
    }
    if (data.sortOrder !== undefined) {
      const sortOrder = Number(data.sortOrder);
      if (!Number.isInteger(sortOrder)) {
        throw new BadRequestException("sortOrder must be an integer");
      }
      patch.sortOrder = sortOrder;
    }

    if (Object.keys(patch).length > 0) {
      await this.prisma.floor.update({ where: { id: floorId }, data: patch });
    }
    return this.listFloors(orgId, outletId).then((floors) =>
      floors.find((f) => f.id === floorId),
    );
  }

  /** Sections cascade-delete their tables, so refuse while any table remains on the floor. */
  async deleteFloor(orgId: string, outletId: string, floorId: string) {
    await this.findScopedFloor(orgId, outletId, floorId);
    const tableCount = await this.prisma.table.count({
      where: { section: { floorId } },
    });
    if (tableCount > 0) {
      throw new BadRequestException(
        `This floor still has ${tableCount} table${tableCount === 1 ? "" : "s"}. Move or delete its tables first.`,
      );
    }
    await this.prisma.floor.delete({ where: { id: floorId } });
    return { id: floorId, deleted: true };
  }

  async createSection(
    orgId: string,
    outletId: string,
    floorId: string,
    data: { name: string; sortOrder?: number },
  ) {
    const floor = await this.prisma.floor.findFirst({
      where: {
        id: floorId,
        outletId,
        outlet: { organizationId: orgId },
      },
    });
    if (!floor) throw new NotFoundException("Floor not found");
    const name = data.name?.trim();
    if (!name) throw new BadRequestException("Section name is required");

    const section = await this.prisma.section.create({
      data: {
        floorId,
        name,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    return {
      id: section.id,
      floorId: section.floorId,
      name: section.name,
      sortOrder: section.sortOrder,
    };
  }

  /** Public list for QR ordering — no auth. */
  async listByOutletPublic(outletId: string) {
    const tables = await this.prisma.table.findMany({
      where: { section: { floor: { outletId } } },
      select: { id: true, name: true, qrCode: true },
    });
    return tables;
  }

  /** Resolve permanent table sticker without starting a session. */
  async resolveByQrCode(qrCode: string) {
    const code = qrCode?.trim();
    if (!code) throw new BadRequestException("QR code is required");

    const table = await this.prisma.table.findFirst({
      where: { qrCode: code },
      include: {
        section: {
          include: {
            floor: { include: { outlet: { include: { organization: true } } } },
          },
        },
      },
    });
    if (!table) throw new NotFoundException("Table not found for this QR code");

    const outlet = table.section.floor.outlet;
    const org = outlet.organization;
    return {
      tableId: table.id,
      tableName: table.name,
      qrCode: table.qrCode,
      qrUrl: table.qrCode
        ? this.buildQrUrl(org.slug, outlet.slug, table.qrCode)
        : null,
      organizationId: org.id,
      organizationSlug: org.slug,
      organizationName: org.name,
      outletId: outlet.id,
      outletSlug: outlet.slug,
      outletName: outlet.name,
    };
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
      include: {
        section: {
          include: { floor: { include: { outlet: { include: { organization: true } } } } },
        },
      },
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

    const org = table.section.floor.outlet.organization;
    const outlet = table.section.floor.outlet;

    const payload = {
      id: updated.id,
      outletId,
      sectionId: updated.sectionId,
      name: updated.name,
      capacity: updated.capacity,
      status: toApiTableStatus(updated.status),
      qrCode: updated.qrCode,
      qrUrl: updated.qrCode
        ? this.buildQrUrl(org.slug, outlet.slug, updated.qrCode)
        : null,
      section: updated.section
        ? { id: updated.section.id, name: updated.section.name }
        : null,
    };

    this.ws.emitToOutlet(outletId, "table.updated", payload);
    return payload;
  }

  async regenerateQr(orgId: string, outletId: string, tableId: string) {
    const table = await this.prisma.table.findFirst({
      where: {
        id: tableId,
        section: { floor: { outletId, outlet: { organizationId: orgId } } },
      },
      include: {
        section: {
          include: { floor: { include: { outlet: { include: { organization: true } } } } },
        },
      },
    });
    if (!table) throw new NotFoundException("Table not found");

    const qrCode = this.newQrCode();
    const updated = await this.prisma.table.update({
      where: { id: tableId },
      data: { qrCode },
      include: { section: true },
    });

    const org = table.section.floor.outlet.organization;
    const outlet = table.section.floor.outlet;
    const qrUrl = this.buildQrUrl(org.slug, outlet.slug, qrCode);

    return {
      id: updated.id,
      outletId,
      sectionId: updated.sectionId,
      name: updated.name,
      capacity: updated.capacity,
      status: toApiTableStatus(updated.status),
      qrCode: updated.qrCode,
      qrUrl,
      section: updated.section
        ? { id: updated.section.id, name: updated.section.name }
        : null,
    };
  }

  async update(
    orgId: string,
    outletId: string,
    tableId: string,
    data: {
      name?: string;
      capacity?: number;
      floorId?: string;
      sectionId?: string;
      sectionName?: string;
      floorName?: string;
    },
  ) {
    const existing = await this.prisma.table.findFirst({
      where: {
        id: tableId,
        section: { floor: { outletId, outlet: { organizationId: orgId } } },
      },
      include: {
        section: {
          include: { floor: { include: { outlet: { include: { organization: true } } } } },
        },
      },
    });
    if (!existing) throw new NotFoundException("Table not found");

    let sectionId = existing.sectionId;
    if (
      data.sectionId !== undefined ||
      data.floorId !== undefined ||
      data.sectionName !== undefined ||
      data.floorName !== undefined
    ) {
      let section =
        data.sectionId
          ? await this.prisma.section.findFirst({
              where: {
                id: data.sectionId,
                floor: { outletId, outlet: { organizationId: orgId } },
              },
            })
          : null;

      if (!section) {
        let floor =
          data.floorId
            ? await this.prisma.floor.findFirst({
                where: {
                  id: data.floorId,
                  outletId,
                  outlet: { organizationId: orgId },
                },
              })
            : existing.section.floor;

        if (!floor && data.floorName?.trim()) {
          const floorName = data.floorName.trim();
          floor =
            (await this.prisma.floor.findFirst({
              where: { outletId, name: floorName },
            })) ??
            (await this.prisma.floor.create({
              data: { outletId, name: floorName, sortOrder: 0 },
            }));
        }
        if (!floor) throw new BadRequestException("Floor is required");

        const sectionName = data.sectionName?.trim() || existing.section.name || "Dining";
        section =
          (await this.prisma.section.findFirst({
            where: { floorId: floor.id, name: sectionName },
          })) ??
          (await this.prisma.section.create({
            data: { floorId: floor.id, name: sectionName, sortOrder: 0 },
          }));
      }
      sectionId = section.id;
    }

    if (data.name !== undefined && !data.name.trim()) {
      throw new BadRequestException("Table name is required");
    }
    if (data.capacity !== undefined && data.capacity < 1) {
      throw new BadRequestException("Capacity must be at least 1");
    }

    const updated = await this.prisma.table.update({
      where: { id: tableId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(sectionId !== existing.sectionId ? { sectionId } : {}),
      },
      include: { section: { include: { floor: true } } },
    });

    const org = existing.section.floor.outlet.organization;
    const outlet = existing.section.floor.outlet;
    const payload = this.mapTable(updated, outletId, org.slug, outlet.slug);
    this.ws.emitToOutlet(outletId, "table.updated", payload);
    return payload;
  }

  async remove(orgId: string, outletId: string, tableId: string) {
    const table = await this.prisma.table.findFirst({
      where: {
        id: tableId,
        section: { floor: { outletId, outlet: { organizationId: orgId } } },
      },
    });
    if (!table) throw new NotFoundException("Table not found");

    const activeSession = await this.prisma.tableSession.findFirst({
      where: { tableId, status: "active" },
    });
    if (activeSession) {
      throw new BadRequestException(
        "Cannot delete a table with an active session. Close the session first.",
      );
    }

    const openOrder = await this.prisma.order.findFirst({
      where: {
        tableId,
        status: {
          notIn: ["completed", "cancelled", "voided"],
        },
      },
    });
    if (openOrder) {
      throw new BadRequestException(
        "Cannot delete a table with open orders. Complete or cancel them first.",
      );
    }

    await this.prisma.table.delete({ where: { id: tableId } });
    this.ws.emitToOutlet(outletId, "table.deleted", { id: tableId, outletId });
    return { success: true, id: tableId };
  }
}
