import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateFloorDto,
  UpdateFloorDto,
  CreateSectionDto,
  UpdateSectionDto,
  CreateTableDto,
  UpdateTableDto,
  UpdateTableStatusDto,
  MergeTablesDto,
  TransferTableDto,
} from './dto/tables.dto';

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Floors ---

  async listFloors(outletId: string, organizationId?: string) {
    await this.ensureOutlet(outletId, organizationId);
    return this.prisma.client.floor.findMany({
      where: { outletId },
      include: {
        sections: {
          include: { tables: { where: { isActive: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createFloor(
    organizationId: string,
    outletId: string,
    userId: string,
    dto: CreateFloorDto,
  ) {
    await this.ensureOutlet(outletId, organizationId);
    const floor = await this.prisma.client.floor.create({
      data: { outletId, ...dto },
    });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'CREATE',
      entityType: 'Floor',
      entityId: floor.id,
      newValue: floor as unknown as Record<string, unknown>,
    });
    return floor;
  }

  async updateFloor(
    organizationId: string,
    outletId: string,
    userId: string,
    id: string,
    dto: UpdateFloorDto,
  ) {
    await this.ensureFloor(outletId, id, organizationId);
    const floor = await this.prisma.client.floor.update({ where: { id }, data: dto });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'UPDATE',
      entityType: 'Floor',
      entityId: id,
      newValue: floor as unknown as Record<string, unknown>,
    });
    return floor;
  }

  async deleteFloor(organizationId: string, outletId: string, userId: string, id: string) {
    await this.ensureFloor(outletId, id, organizationId);
    await this.prisma.client.floor.delete({ where: { id } });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'DELETE',
      entityType: 'Floor',
      entityId: id,
    });
    return { deleted: true };
  }

  // --- Sections ---

  async listSections(floorId: string) {
    return this.prisma.client.section.findMany({
      where: { floorId },
      include: { tables: { where: { isActive: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createSection(
    organizationId: string,
    outletId: string,
    floorId: string,
    userId: string,
    dto: CreateSectionDto,
  ) {
    await this.ensureFloor(outletId, floorId, organizationId);
    const section = await this.prisma.client.section.create({
      data: { floorId, ...dto },
    });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'CREATE',
      entityType: 'Section',
      entityId: section.id,
      newValue: section as unknown as Record<string, unknown>,
    });
    return section;
  }

  async updateSection(
    organizationId: string,
    outletId: string,
    userId: string,
    id: string,
    dto: UpdateSectionDto,
  ) {
    const section = await this.ensureSection(outletId, id, organizationId);
    const updated = await this.prisma.client.section.update({ where: { id }, data: dto });
    await this.audit.log({
      organizationId,
      userId,
      outletId: section.floor.outletId,
      action: 'UPDATE',
      entityType: 'Section',
      entityId: id,
      newValue: updated as unknown as Record<string, unknown>,
    });
    return updated;
  }

  async deleteSection(organizationId: string, outletId: string, userId: string, id: string) {
    await this.ensureSection(outletId, id, organizationId);
    await this.prisma.client.section.delete({ where: { id } });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'DELETE',
      entityType: 'Section',
      entityId: id,
    });
    return { deleted: true };
  }

  // --- Tables ---

  async listTables(outletId: string, organizationId?: string) {
    await this.ensureOutlet(outletId, organizationId);
    return this.prisma.client.table.findMany({
      where: { outletId, isActive: true },
      include: { section: true },
      orderBy: { name: 'asc' },
    });
  }

  async createTable(
    organizationId: string,
    outletId: string,
    userId: string,
    dto: CreateTableDto,
  ) {
    await this.ensureOutlet(outletId, organizationId);
    if (dto.sectionId) {
      await this.ensureSection(outletId, dto.sectionId, organizationId);
    }

    const table = await this.prisma.client.table.create({
      data: { outletId, ...dto },
    });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'CREATE',
      entityType: 'Table',
      entityId: table.id,
      newValue: table as unknown as Record<string, unknown>,
    });
    return table;
  }

  async updateTable(
    organizationId: string,
    outletId: string,
    userId: string,
    id: string,
    dto: UpdateTableDto,
  ) {
    await this.ensureTable(outletId, id, organizationId);
    const table = await this.prisma.client.table.update({ where: { id }, data: dto });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'UPDATE',
      entityType: 'Table',
      entityId: id,
      newValue: table as unknown as Record<string, unknown>,
    });
    return table;
  }

  async deleteTable(organizationId: string, outletId: string, userId: string, id: string) {
    await this.ensureTable(outletId, id, organizationId);
    const table = await this.prisma.client.table.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'DELETE',
      entityType: 'Table',
      entityId: id,
    });
    return table;
  }

  async updateTableStatus(
    organizationId: string,
    outletId: string,
    userId: string,
    id: string,
    dto: UpdateTableStatusDto,
  ) {
    const existing = await this.ensureTable(outletId, id, organizationId);
    const table = await this.prisma.client.table.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'STATUS_CHANGE',
      entityType: 'Table',
      entityId: id,
      previousValue: { status: existing.status },
      newValue: { status: dto.status },
    });
    return table;
  }

  async generateQrCode(
    organizationId: string,
    outletId: string,
    userId: string,
    id: string,
  ) {
    await this.ensureTable(outletId, id, organizationId);
    const qrCode = uuidv4();
    const table = await this.prisma.client.table.update({
      where: { id },
      data: { qrCode },
    });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'QR_GENERATED',
      entityType: 'Table',
      entityId: id,
      newValue: { qrCode },
    });
    return { tableId: id, qrCode, table };
  }

  async mergeTables(
    organizationId: string,
    outletId: string,
    userId: string,
    dto: MergeTablesDto,
  ) {
    if (!dto.tableIds.includes(dto.primaryTableId)) {
      dto.tableIds.push(dto.primaryTableId);
    }

    const tables = await this.prisma.client.table.findMany({
      where: { id: { in: dto.tableIds }, outletId, isActive: true },
    });

    if (tables.length !== dto.tableIds.length) {
      throw new BadRequestException('One or more tables not found');
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      await tx.table.updateMany({
        where: {
          id: { in: dto.tableIds.filter((t) => t !== dto.primaryTableId) },
        },
        data: { status: 'MERGED', isActive: false },
      });

      const primary = await tx.table.update({
        where: { id: dto.primaryTableId },
        data: { status: 'OCCUPIED' },
      });

      const activeOrders = await tx.order.findMany({
        where: {
          tableId: { in: dto.tableIds.filter((t) => t !== dto.primaryTableId) },
          status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] },
        },
      });

      for (const order of activeOrders) {
        await tx.order.update({
          where: { id: order.id },
          data: { tableId: dto.primaryTableId },
        });
      }

      return { primary, mergedCount: dto.tableIds.length - 1, ordersMoved: activeOrders.length };
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'MERGE',
      entityType: 'Table',
      entityId: dto.primaryTableId,
      newValue: { mergedTableIds: dto.tableIds },
    });

    return result;
  }

  async transferTable(
    organizationId: string,
    outletId: string,
    userId: string,
    dto: TransferTableDto,
  ) {
    if (dto.fromTableId === dto.toTableId) {
      throw new BadRequestException('Source and destination tables must differ');
    }

    const [fromTable, toTable] = await Promise.all([
      this.ensureTable(outletId, dto.fromTableId, organizationId),
      this.ensureTable(outletId, dto.toTableId, organizationId),
    ]);

    if (fromTable.status !== 'OCCUPIED' && fromTable.status !== 'BILLING') {
      throw new BadRequestException('Source table has no active session');
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      const orders = await tx.order.updateMany({
        where: {
          tableId: dto.fromTableId,
          status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] },
        },
        data: { tableId: dto.toTableId },
      });

      await tx.table.update({
        where: { id: dto.fromTableId },
        data: { status: 'AVAILABLE' },
      });

      await tx.table.update({
        where: { id: dto.toTableId },
        data: { status: 'OCCUPIED' },
      });

      return { ordersTransferred: orders.count, fromTable, toTable };
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'TRANSFER',
      entityType: 'Table',
      entityId: dto.fromTableId,
      newValue: { toTableId: dto.toTableId, ordersTransferred: result.ordersTransferred },
    });

    return result;
  }

  private async ensureOutlet(outletId: string, organizationId?: string) {
    const outlet = await this.prisma.client.outlet.findFirst({
      where: {
        id: outletId,
        deletedAt: null,
        ...(organizationId ? { organizationId } : {}),
      },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');
    return outlet;
  }

  private async ensureFloor(outletId: string, id: string, organizationId?: string) {
    const floor = await this.prisma.client.floor.findFirst({
      where: { id, outletId },
      include: { outlet: true },
    });
    if (!floor) throw new NotFoundException('Floor not found');
    if (organizationId && floor.outlet.organizationId !== organizationId) {
      throw new BadRequestException('Floor does not belong to organization');
    }
    return floor;
  }

  private async ensureSection(outletId: string, id: string, organizationId?: string) {
    const section = await this.prisma.client.section.findFirst({
      where: { id },
      include: { floor: { include: { outlet: true } } },
    });
    if (!section || section.floor.outletId !== outletId) {
      throw new NotFoundException('Section not found');
    }
    if (organizationId && section.floor.outlet.organizationId !== organizationId) {
      throw new BadRequestException('Section does not belong to organization');
    }
    return section;
  }

  private async ensureTable(outletId: string, id: string, organizationId?: string) {
    const table = await this.prisma.client.table.findFirst({
      where: { id, outletId, isActive: true },
      include: { outlet: true },
    });
    if (!table) throw new NotFoundException('Table not found');
    if (organizationId && table.outlet.organizationId !== organizationId) {
      throw new BadRequestException('Table does not belong to organization');
    }
    return table;
  }
}
