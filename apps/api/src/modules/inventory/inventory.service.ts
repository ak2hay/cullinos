import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { InventoryItem } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { allocateFifoLots, packsToBaseUnits } from "../../common/recipe-stock.util";
import { LIQUID_UNITS, buildStockRegister } from "./stock-register.util";

function toClientItem(item: InventoryItem) {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    unit: item.unit,
    currentStock: Number(item.currentStock),
    reorderLevel: Number(item.reorderLevel),
    costPerUnit: Number(item.costPerUnit),
    outletId: item.outletId,
    packLabel: item.packLabel,
    packSize: item.packSize == null ? null : Number(item.packSize),
    catalogKey: item.catalogKey,
  };
}

function resolvePack(
  packLabel: string | null | undefined,
  packSize: number | null | undefined,
): { packLabel?: string | null; packSize?: number | null } {
  const out: { packLabel?: string | null; packSize?: number | null } = {};
  if (packLabel !== undefined) out.packLabel = packLabel?.trim().slice(0, 40) || null;
  if (packSize !== undefined) {
    if (packSize === null || packSize === 0) {
      out.packSize = null;
    } else {
      const size = Number(packSize);
      if (!Number.isFinite(size) || size <= 0) {
        throw new BadRequestException("packSize must be a positive number");
      }
      out.packSize = size;
    }
  }
  return out;
}

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
      .then((items) => items.map(toClientItem));
  }

  async listLots(orgId: string, itemId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, organizationId: orgId },
      select: { id: true },
    });
    if (!item) throw new NotFoundException("Inventory item not found");

    const lots = await this.prisma.inventoryLot.findMany({
      where: { inventoryItemId: itemId, qtyRemaining: { gt: 0 } },
      orderBy: { receivedAt: "asc" },
      take: 100,
    });

    return lots.map((lot) => ({
      id: lot.id,
      qtyRemaining: Number(lot.qtyRemaining),
      unitCost: Number(lot.unitCost),
      receivedAt: lot.receivedAt.toISOString(),
      expiryDate: lot.expiryDate?.toISOString() ?? null,
      grnItemId: lot.grnItemId,
    }));
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
      packLabel?: string | null;
      packSize?: number | null;
    },
  ) {
    if (!data.name?.trim()) throw new BadRequestException("Item name is required");
    const pack = resolvePack(data.packLabel, data.packSize);

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
        ...pack,
      },
    });

    return toClientItem(item);
  }

  /** Opening / received / sold / wasted / transferred / closing per item for [from, to). */
  async stockRegister(
    orgId: string,
    query: { from?: string; to?: string; outletId?: string; liquidOnly?: string },
  ) {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? new Date(query.to) : null;
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException("from and to must be valid ISO dates");
    }
    if (to <= from) throw new BadRequestException("to must be after from");
    if (to.getTime() - from.getTime() > 93 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException("Register range cannot exceed 93 days");
    }

    if (query.outletId) {
      const outlet = await this.prisma.outlet.findFirst({
        where: { id: query.outletId, organizationId: orgId },
        select: { id: true },
      });
      if (!outlet) throw new NotFoundException("Outlet not found");
    }

    const liquidOnly = query.liquidOnly === "true" || query.liquidOnly === "1";
    const items = await this.prisma.inventoryItem.findMany({
      where: {
        organizationId: orgId,
        ...(query.outletId ? { OR: [{ outletId: query.outletId }, { outletId: null }] } : {}),
        ...(liquidOnly ? { unit: { in: [...LIQUID_UNITS] } } : {}),
      },
      orderBy: { name: "asc" },
      take: 1000,
    });
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) {
      return { from: from.toISOString(), to: to.toISOString(), rows: [] };
    }

    const [periodGroups, afterGroups] = await Promise.all([
      this.prisma.stockMovement.groupBy({
        by: ["inventoryItemId", "type"],
        where: { inventoryItemId: { in: itemIds }, createdAt: { gte: from, lt: to } },
        _sum: { quantity: true },
      }),
      this.prisma.stockMovement.groupBy({
        by: ["inventoryItemId", "type"],
        where: { inventoryItemId: { in: itemIds }, createdAt: { gte: to } },
        _sum: { quantity: true },
      }),
    ]);
    const toSums = (groups: typeof periodGroups) =>
      groups.map((g) => ({
        inventoryItemId: g.inventoryItemId,
        type: g.type,
        quantity: Number(g._sum.quantity ?? 0),
      }));

    const rows = buildStockRegister(
      items.map((i) => ({
        id: i.id,
        name: i.name,
        sku: i.sku,
        unit: i.unit,
        currentStock: Number(i.currentStock),
        costPerUnit: Number(i.costPerUnit),
      })),
      toSums(periodGroups),
      toSums(afterGroups),
    );
    return { from: from.toISOString(), to: to.toISOString(), rows };
  }

  async lowStock(orgId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      take: 500,
    });

    return items
      .filter((item) => Number(item.currentStock) <= Number(item.reorderLevel))
      .map(toClientItem);
  }

  async adjust(
    orgId: string,
    itemId: string,
    data: { quantity: number; type: "in" | "out" | "waste"; notes?: string; inPacks?: boolean },
  ) {
    const entered = Number(data.quantity);
    if (!Number.isFinite(entered) || entered <= 0) {
      throw new BadRequestException("quantity must be a positive number");
    }
    if (!["in", "out", "waste"].includes(data.type)) {
      throw new BadRequestException("type must be in, out, or waste");
    }

    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, organizationId: orgId },
    });
    if (!item) throw new NotFoundException("Inventory item not found");

    let qty = entered;
    if (data.inPacks) {
      try {
        qty = packsToBaseUnits(entered, item.packSize);
      } catch (e) {
        throw new BadRequestException((e as Error).message);
      }
    }

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
      const packNote =
        data.inPacks && item.packLabel ? `${entered} ${item.packLabel}` : data.inPacks ? `${entered} pack(s)` : "";
      const notes = [packNote, data.notes?.trim()].filter(Boolean).join(" · ");
      const mov = await tx.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          type: movementType,
          quantity: qty,
          notes: notes || null,
        },
      });
      return [next, mov] as const;
    });

    return {
      ...toClientItem(updated),
      movement: {
        id: movement.id,
        type: movement.type,
        quantity: Number(movement.quantity),
        notes: movement.notes,
      },
    };
  }

  async updateItem(
    orgId: string,
    itemId: string,
    data: {
      name?: string;
      sku?: string;
      unit?: string;
      currentStock?: number;
      reorderLevel?: number;
      packLabel?: string | null;
      packSize?: number | null;
    },
  ) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, organizationId: orgId },
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    const pack = resolvePack(data.packLabel, data.packSize);

    const updated = await this.prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        ...(data.name?.trim() ? { name: data.name.trim() } : {}),
        ...(data.sku !== undefined ? { sku: data.sku?.trim() || null } : {}),
        ...(data.unit ? { unit: this.resolveUnit(data.unit) } : {}),
        ...(data.currentStock !== undefined ? { currentStock: data.currentStock } : {}),
        ...(data.reorderLevel !== undefined ? { reorderLevel: data.reorderLevel } : {}),
        ...pack,
      },
    });

    return toClientItem(updated);
  }

  async removeItem(orgId: string, itemId: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, organizationId: orgId },
    });
    if (!item) throw new NotFoundException("Inventory item not found");

    await this.prisma.inventoryItem.delete({ where: { id: item.id } });
    return { id: item.id, deleted: true };
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
    const quantity = Number(payload.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException("quantity must be greater than zero");
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
    if (item.outletId && item.outletId !== payload.fromOutletId) {
      throw new BadRequestException("Inventory item does not belong to the source outlet");
    }

    const reference = `transfer:${payload.fromOutletId}->${payload.toOutletId}`;

    const movement = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.inventoryItem.updateMany({
        where: { id: item.id, currentStock: { gte: quantity } },
        data: { currentStock: { decrement: quantity } },
      });
      if (claimed.count === 0) {
        throw new BadRequestException("Insufficient stock at source outlet");
      }

      const sourceLots = await tx.inventoryLot.findMany({
        where: { inventoryItemId: item.id, qtyRemaining: { gt: 0 } },
        orderBy: { receivedAt: "asc" },
      });
      const allocations = allocateFifoLots(
        sourceLots.map((l) => ({
          id: l.id,
          qtyRemaining: Number(l.qtyRemaining),
          unitCost: Number(l.unitCost),
          receivedAt: l.receivedAt,
        })),
        quantity,
      );

      let destItem = await tx.inventoryItem.findFirst({
        where: {
          organizationId: orgId,
          outletId: payload.toOutletId,
          ...(item.catalogKey ? { catalogKey: item.catalogKey } : { sku: item.sku, name: item.name }),
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
            currentStock: quantity,
            reorderLevel: item.reorderLevel,
            costPerUnit: item.costPerUnit,
            packLabel: item.packLabel,
            packSize: item.packSize,
            catalogKey: item.catalogKey,
          },
        });
      } else {
        if (destItem.unit !== item.unit) {
          throw new BadRequestException(
            `Destination item uses ${destItem.unit}, source uses ${item.unit}`,
          );
        }
        await tx.inventoryItem.update({
          where: { id: destItem.id },
          data: { currentStock: { increment: quantity } },
        });
      }

      for (const alloc of allocations) {
        const lot = sourceLots.find((l) => l.id === alloc.lotId)!;
        await tx.inventoryLot.update({
          where: { id: lot.id },
          data: { qtyRemaining: { decrement: alloc.qty } },
        });
        await tx.inventoryLot.create({
          data: {
            inventoryItemId: destItem.id,
            qtyRemaining: alloc.qty,
            unitCost: lot.unitCost,
            receivedAt: lot.receivedAt,
            expiryDate: lot.expiryDate,
          },
        });
      }

      // `transfer` counts as stock out in the register, so the inbound side is an adjustment.
      await tx.stockMovement.create({
        data: {
          inventoryItemId: destItem.id,
          type: "adjustment",
          quantity,
          reference,
          notes: `transfer in from ${fromOutlet.name}`,
        },
      });

      return tx.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          type: "transfer",
          quantity,
          reference,
          notes: payload.notes,
        },
      });
    });

    return { id: movement.id };
  }
}
