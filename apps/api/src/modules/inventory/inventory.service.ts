import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const ALLOWED_INVENTORY_UNITS = new Set([
  "kg",
  "g",
  "L",
  "mL",
  "pieces",
  "bottles",
]);

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  private resolveUnit(unit?: string): string {
    const value = unit?.trim() || "kg";
    if (!ALLOWED_INVENTORY_UNITS.has(value)) {
      throw new BadRequestException(
        "Unit must be one of: kg, g, L, mL, pieces, bottles",
      );
    }
    return value;
  }

  list(orgId: string) {
    return this.prisma.inventoryItem.findMany({
      where: { organizationId: orgId },
      take: 200,
    });
  }

  listItems(orgId: string) {
    return this.prisma.inventoryItem
      .findMany({
        where: { organizationId: orgId },
        orderBy: { name: "asc" },
        take: 500,
      })
      .then((items) =>
        items.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          currentStock: Number(item.currentStock),
          reorderLevel: Number(item.reorderLevel),
          outletId: item.outletId,
        })),
      );
  }

  async createItem(
    orgId: string,
    data: {
      outletId?: string;
      name: string;
      sku?: string;
      unit?: string;
      currentStock?: number;
      reorderLevel?: number;
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Item name is required");

    if (data.outletId) {
      const outlet = await this.prisma.outlet.findFirst({
        where: { id: data.outletId, organizationId: orgId },
      });
      if (!outlet) throw new NotFoundException("Outlet not found");
    }

    const item = await this.prisma.inventoryItem.create({
      data: {
        organizationId: orgId,
        outletId: data.outletId || null,
        name: data.name.trim(),
        sku: data.sku?.trim() || null,
        unit: this.resolveUnit(data.unit),
        currentStock: data.currentStock ?? 0,
        reorderLevel: data.reorderLevel ?? 0,
      },
    });

    return {
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      currentStock: Number(item.currentStock),
      reorderLevel: Number(item.reorderLevel),
      outletId: item.outletId,
    };
  }

  async lowStock(orgId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      take: 500,
    });

    return items
      .filter((item) => Number(item.currentStock) <= Number(item.reorderLevel))
      .map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        currentStock: Number(item.currentStock),
        reorderLevel: Number(item.reorderLevel),
        outletId: item.outletId,
      }));
  }

  async adjust(
    orgId: string,
    itemId: string,
    data: { quantity: number; type: "in" | "out" | "waste"; notes?: string },
  ) {
    const qty = Number(data.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException("quantity must be a positive number");
    }
    if (!["in", "out", "waste"].includes(data.type)) {
      throw new BadRequestException("type must be in, out, or waste");
    }

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, organizationId: orgId },
    });
    if (!item) throw new NotFoundException("Inventory item not found");

    const current = Number(item.currentStock);
    if (data.type !== "in" && current < qty) {
      throw new BadRequestException("Insufficient stock");
    }

    const movementType =
      data.type === "in" ? "purchase" : data.type === "waste" ? "wastage" : "sale";
    const delta = data.type === "in" ? qty : -qty;

    const [updated, movement] = await this.prisma.$transaction(async (tx) => {
      const next = await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: { increment: delta } },
      });
      const mov = await tx.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          type: movementType,
          quantity: qty,
          notes: data.notes?.trim() || null,
        },
      });
      return [next, mov] as const;
    });

    return {
      id: updated.id,
      name: updated.name,
      sku: updated.sku,
      unit: updated.unit,
      currentStock: Number(updated.currentStock),
      reorderLevel: Number(updated.reorderLevel),
      outletId: updated.outletId,
      movement: {
        id: movement.id,
        type: movement.type,
        quantity: Number(movement.quantity),
        notes: movement.notes,
      },
    };
  }

  async transfer(
    orgId: string,
    payload: {
      fromOutletId: string;
      toOutletId: string;
      inventoryItemId: string;
      quantity: number;
      notes?: string;
    },
  ) {
    if (payload.fromOutletId === payload.toOutletId) {
      throw new BadRequestException("Source and destination outlets must differ");
    }

    const [fromOutlet, toOutlet, item] = await Promise.all([
      this.prisma.outlet.findFirst({
        where: { id: payload.fromOutletId, organizationId: orgId },
      }),
      this.prisma.outlet.findFirst({
        where: { id: payload.toOutletId, organizationId: orgId },
      }),
      this.prisma.inventoryItem.findFirst({
        where: { id: payload.inventoryItemId, organizationId: orgId },
      }),
    ]);

    if (!fromOutlet || !toOutlet) throw new NotFoundException("Outlet not found");
    if (!item) throw new NotFoundException("Inventory item not found");
    if (Number(item.currentStock) < payload.quantity) {
      throw new BadRequestException("Insufficient stock at source outlet");
    }

    const reference = `transfer:${payload.fromOutletId}->${payload.toOutletId}`;

    const movement = await this.prisma.$transaction(async (tx) => {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: { decrement: payload.quantity } },
      });

      let destItem = await tx.inventoryItem.findFirst({
        where: {
          organizationId: orgId,
          outletId: payload.toOutletId,
          sku: item.sku,
          name: item.name,
        },
      });

      if (!destItem) {
        destItem = await tx.inventoryItem.create({
          data: {
            organizationId: orgId,
            outletId: payload.toOutletId,
            categoryId: item.categoryId,
            name: item.name,
            sku: item.sku,
            unit: item.unit,
            currentStock: payload.quantity,
            reorderLevel: item.reorderLevel,
            costPerUnit: item.costPerUnit,
          },
        });
      } else {
        await tx.inventoryItem.update({
          where: { id: destItem.id },
          data: { currentStock: { increment: payload.quantity } },
        });
      }

      return tx.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          type: "transfer",
          quantity: payload.quantity,
          reference,
          notes: payload.notes,
        },
      });
    });

    return { id: movement.id };
  }
}
