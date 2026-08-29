import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface RecordWastageInput {
  inventoryItemId: string;
  outletId: string;
  quantity: number;
  reason: string;
  notes?: string;
}

export interface WastageReportQuery {
  outletId?: string;
  from?: Date;
  to?: Date;
  inventoryItemId?: string;
}

@Injectable()
export class WastageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async recordWastage(
    organizationId: string,
    userId: string,
    input: RecordWastageInput,
  ) {
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: input.inventoryItemId, organizationId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    const value = Math.round(input.quantity * item.costPerUnit);

    const result = await this.prisma.client.$transaction(async (tx) => {
      const record = await tx.wastageRecord.create({
        data: {
          inventoryItemId: input.inventoryItemId,
          outletId: input.outletId,
          quantity: input.quantity,
          reason: input.reason,
          value,
          notes: input.notes,
          recordedBy: userId,
        },
        include: { inventoryItem: true },
      });

      const stock = await tx.stock.findFirst({
        where: {
          outletId: input.outletId,
          inventoryItemId: input.inventoryItemId,
          batchNumber: null,
        },
      });

      if (stock) {
        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: Math.max(0, stock.quantity - input.quantity) },
        });
      }

      await tx.stockMovement.create({
        data: {
          inventoryItemId: input.inventoryItemId,
          outletId: input.outletId,
          type: 'WASTAGE',
          quantity: -input.quantity,
          referenceType: 'WastageRecord',
          referenceId: record.id,
          notes: input.reason,
          createdBy: userId,
        },
      });

      return record;
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId,
      action: 'WASTAGE_RECORDED',
      entityType: 'WastageRecord',
      entityId: result.id,
      newValue: { quantity: input.quantity, reason: input.reason, value },
    });

    return result;
  }

  async getReports(organizationId: string, query: WastageReportQuery) {
    const where: Record<string, unknown> = {
      inventoryItem: { organizationId },
    };

    if (query.outletId) where.outletId = query.outletId;
    if (query.inventoryItemId) where.inventoryItemId = query.inventoryItemId;
    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }

    const records = await this.prisma.client.wastageRecord.findMany({
      where,
      include: { inventoryItem: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalQuantity = records.reduce((sum, r) => sum + r.quantity, 0);
    const totalValue = records.reduce((sum, r) => sum + r.value, 0);

    const byReason = records.reduce<Record<string, { count: number; value: number; quantity: number }>>(
      (acc, r) => {
        if (!acc[r.reason]) acc[r.reason] = { count: 0, value: 0, quantity: 0 };
        acc[r.reason].count += 1;
        acc[r.reason].value += r.value;
        acc[r.reason].quantity += r.quantity;
        return acc;
      },
      {},
    );

    return {
      records,
      summary: {
        totalRecords: records.length,
        totalQuantity,
        totalValue,
        byReason,
      },
    };
  }
}
