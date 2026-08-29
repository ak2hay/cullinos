import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface CreateInventoryItemInput {
  name: string;
  sku?: string;
  unit?: string;
  category?: string;
  minStock?: number;
  reorderLevel?: number;
  costPerUnit?: number;
}

export interface UpdateInventoryItemInput {
  name?: string;
  sku?: string;
  unit?: string;
  category?: string;
  minStock?: number;
  reorderLevel?: number;
  costPerUnit?: number;
  isActive?: boolean;
}

export interface StockAdjustmentInput {
  outletId: string;
  inventoryItemId: string;
  quantity: number;
  notes?: string;
}

export interface StockTransferInput {
  inventoryItemId: string;
  fromOutletId: string;
  toOutletId: string;
  quantity: number;
  notes?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAllItems(organizationId: string) {
    return this.prisma.client.inventoryItem.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findItem(id: string, organizationId: string) {
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async createItem(
    organizationId: string,
    userId: string,
    input: CreateInventoryItemInput,
  ) {
    const item = await this.prisma.client.inventoryItem.create({
      data: { organizationId, ...input },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'INVENTORY_ITEM_CREATED',
      entityType: 'InventoryItem',
      entityId: item.id,
      newValue: { name: item.name },
    });

    return item;
  }

  async updateItem(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateInventoryItemInput,
  ) {
    await this.findItem(id, organizationId);
    const item = await this.prisma.client.inventoryItem.update({
      where: { id },
      data: input,
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'INVENTORY_ITEM_UPDATED',
      entityType: 'InventoryItem',
      entityId: id,
    });

    return item;
  }

  async deleteItem(id: string, organizationId: string, userId: string) {
    await this.findItem(id, organizationId);
    await this.prisma.client.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'INVENTORY_ITEM_DELETED',
      entityType: 'InventoryItem',
      entityId: id,
    });

    return { success: true };
  }

  async getStockLevels(outletId: string, organizationId: string) {
    return this.prisma.client.stock.findMany({
      where: {
        outletId,
        inventoryItem: { organizationId, deletedAt: null },
      },
      include: { inventoryItem: true },
    });
  }

  async getStockMovements(outletId: string, inventoryItemId?: string) {
    return this.prisma.client.stockMovement.findMany({
      where: {
        outletId,
        ...(inventoryItemId ? { inventoryItemId } : {}),
      },
      include: { inventoryItem: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async adjustStock(
    organizationId: string,
    userId: string,
    input: StockAdjustmentInput,
  ) {
    await this.findItem(input.inventoryItemId, organizationId);

    const result = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.stock.findFirst({
        where: {
          outletId: input.outletId,
          inventoryItemId: input.inventoryItemId,
          batchNumber: null,
        },
      });

      let stock;
      if (existing) {
        const newQty = existing.quantity + input.quantity;
        if (newQty < 0) {
          throw new BadRequestException('Insufficient stock');
        }
        stock = await tx.stock.update({
          where: { id: existing.id },
          data: { quantity: newQty },
        });
      } else {
        if (input.quantity < 0) {
          throw new BadRequestException('Insufficient stock');
        }
        stock = await tx.stock.create({
          data: {
            outletId: input.outletId,
            inventoryItemId: input.inventoryItemId,
            quantity: input.quantity,
          },
        });
      }

      const movement = await tx.stockMovement.create({
        data: {
          inventoryItemId: input.inventoryItemId,
          outletId: input.outletId,
          type: 'ADJUSTMENT',
          quantity: input.quantity,
          referenceType: 'ADJUSTMENT',
          notes: input.notes,
          createdBy: userId,
        },
      });

      return { stock, movement };
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.outletId,
      action: 'STOCK_ADJUSTED',
      entityType: 'StockMovement',
      entityId: result.movement.id,
      newValue: { quantity: input.quantity },
    });

    return result;
  }

  async transferStock(
    organizationId: string,
    userId: string,
    input: StockTransferInput,
  ) {
    if (input.fromOutletId === input.toOutletId) {
      throw new BadRequestException('Source and destination outlets must differ');
    }
    if (input.quantity <= 0) {
      throw new BadRequestException('Transfer quantity must be positive');
    }

    await this.findItem(input.inventoryItemId, organizationId);

    const result = await this.prisma.client.$transaction(async (tx) => {
      const fromStock = await tx.stock.findFirst({
        where: {
          outletId: input.fromOutletId,
          inventoryItemId: input.inventoryItemId,
          batchNumber: null,
        },
      });
      if (!fromStock || fromStock.quantity < input.quantity) {
        throw new BadRequestException('Insufficient stock at source outlet');
      }

      await tx.stock.update({
        where: { id: fromStock.id },
        data: { quantity: fromStock.quantity - input.quantity },
      });

      const toStock = await tx.stock.findFirst({
        where: {
          outletId: input.toOutletId,
          inventoryItemId: input.inventoryItemId,
          batchNumber: null,
        },
      });

      if (toStock) {
        await tx.stock.update({
          where: { id: toStock.id },
          data: { quantity: toStock.quantity + input.quantity },
        });
      } else {
        await tx.stock.create({
          data: {
            outletId: input.toOutletId,
            inventoryItemId: input.inventoryItemId,
            quantity: input.quantity,
          },
        });
      }

      const outMovement = await tx.stockMovement.create({
        data: {
          inventoryItemId: input.inventoryItemId,
          outletId: input.fromOutletId,
          type: 'TRANSFER_OUT',
          quantity: -input.quantity,
          referenceType: 'TRANSFER',
          notes: input.notes,
          createdBy: userId,
        },
      });

      const inMovement = await tx.stockMovement.create({
        data: {
          inventoryItemId: input.inventoryItemId,
          outletId: input.toOutletId,
          type: 'TRANSFER_IN',
          quantity: input.quantity,
          referenceType: 'TRANSFER',
          referenceId: outMovement.id,
          notes: input.notes,
          createdBy: userId,
        },
      });

      return { outMovement, inMovement };
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId: input.fromOutletId,
      action: 'STOCK_TRANSFERRED',
      entityType: 'StockMovement',
      entityId: result.outMovement.id,
      newValue: {
        quantity: input.quantity,
        toOutletId: input.toOutletId,
      },
    });

    return result;
  }
}
