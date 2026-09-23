import type { Prisma, StockMovementType } from "@prisma/client";

export type RecipeIngredientRow = {
  inventoryItemId?: string | null;
  subRecipeId?: string | null;
  quantity: Prisma.Decimal | number;
};

export type LotRow = {
  id: string;
  qtyRemaining: number;
  unitCost: number;
  receivedAt: Date | string;
};

/** Allocate deduction across lots oldest-first (FIFO). */
export function allocateFifoLots(
  lots: LotRow[],
  deductQty: number,
): Array<{ lotId: string; qty: number; unitCost: number }> {
  if (deductQty <= 0) return [];
  const ordered = [...lots].sort(
    (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
  );
  const allocations: Array<{ lotId: string; qty: number; unitCost: number }> = [];
  let remaining = deductQty;
  for (const lot of ordered) {
    if (remaining <= 0) break;
    const available = Number(lot.qtyRemaining);
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    allocations.push({ lotId: lot.id, qty: take, unitCost: Number(lot.unitCost) });
    remaining -= take;
  }
  return allocations;
}

/** Remaining-lot weighted average unit cost, or null if no positive qty. */
export function weightedAverageCost(
  lots: Array<{ qtyRemaining: number; unitCost: number }>,
): number | null {
  let totalQty = 0;
  let totalValue = 0;
  for (const lot of lots) {
    const qty = Number(lot.qtyRemaining);
    if (qty <= 0) continue;
    totalQty += qty;
    totalValue += qty * Number(lot.unitCost);
  }
  if (totalQty <= 0) return null;
  return Math.round((totalValue / totalQty) * 100) / 100;
}

/** Weighted average when receiving new stock against existing on-hand. */
export function blendUnitCost(
  currentStock: number,
  currentCost: number,
  receivedQty: number,
  receivedCost: number,
): number {
  const onHand = Math.max(0, Number(currentStock));
  const qty = Number(receivedQty);
  if (qty <= 0) return Number(currentCost) || 0;
  if (onHand <= 0) return Number(receivedCost) || 0;
  return (
    Math.round(
      ((onHand * Number(currentCost) + qty * Number(receivedCost)) / (onHand + qty)) * 100,
    ) / 100
  );
}

type DbClient = {
  inventoryItem: {
    findUnique: (args: {
      where: { id: string };
      select?: { currentStock?: boolean; costPerUnit?: boolean };
    }) => Promise<{ currentStock: Prisma.Decimal | number; costPerUnit?: Prisma.Decimal | number } | null>;
    update: (args: {
      where: { id: string };
      data: {
        currentStock?: { decrement: number } | { increment: number } | number;
        costPerUnit?: number;
        batchNumber?: string;
      };
    }) => Promise<unknown>;
  };
  inventoryLot: {
    findMany: (args: {
      where: { inventoryItemId: string; qtyRemaining: { gt: number } };
      orderBy: { receivedAt: "asc" };
    }) => Promise<
      Array<{
        id: string;
        qtyRemaining: Prisma.Decimal | number;
        unitCost: Prisma.Decimal | number;
        receivedAt: Date;
      }>
    >;
    update: (args: {
      where: { id: string };
      data: { qtyRemaining: { decrement: number } };
    }) => Promise<unknown>;
  };
  stockMovement: {
    create: (args: {
      data: {
        inventoryItemId: string;
        lotId?: string | null;
        type: StockMovementType;
        quantity: number;
        reference?: string;
        notes?: string;
      };
    }) => Promise<unknown>;
  };
};

/** Deduct recipe ingredients from inventory using FIFO lots when present. */
export async function deductRecipeIngredients(
  db: DbClient,
  params: {
    ingredients: RecipeIngredientRow[];
    recipeYield: number;
    quantity: number;
    scaleFactor?: number;
    reference: string;
    movementType?: StockMovementType;
    batchNumber?: string | null;
  },
): Promise<void> {
  const scale = params.scaleFactor ?? 1;
  const qty = params.quantity;
  const recipeYield = params.recipeYield > 0 ? params.recipeYield : 1;
  const movementType = params.movementType ?? "sale";

  for (const ing of params.ingredients) {
    if (!ing.inventoryItemId) continue;
    const deductQty = Number(ing.quantity) * scale * (qty / recipeYield);
    if (deductQty <= 0) continue;

    const lots = await db.inventoryLot.findMany({
      where: { inventoryItemId: ing.inventoryItemId, qtyRemaining: { gt: 0 } },
      orderBy: { receivedAt: "asc" },
    });

    const lotRows: LotRow[] = lots.map((l) => ({
      id: l.id,
      qtyRemaining: Number(l.qtyRemaining),
      unitCost: Number(l.unitCost),
      receivedAt: l.receivedAt,
    }));
    const allocations = allocateFifoLots(lotRows, deductQty);
    let allocated = 0;

    for (const alloc of allocations) {
      await db.inventoryLot.update({
        where: { id: alloc.lotId },
        data: { qtyRemaining: { decrement: alloc.qty } },
      });
      await db.stockMovement.create({
        data: {
          inventoryItemId: ing.inventoryItemId,
          lotId: alloc.lotId,
          type: movementType,
          quantity: alloc.qty,
          reference: params.reference,
          notes: `lot:${alloc.lotId}`,
        },
      });
      allocated += alloc.qty;
    }

    const remainder = deductQty - allocated;
    if (remainder > 0.0005) {
      await db.stockMovement.create({
        data: {
          inventoryItemId: ing.inventoryItemId,
          type: movementType,
          quantity: remainder,
          reference: params.reference,
          notes: "no-lot",
        },
      });
    }

    const updateData: {
      currentStock: { decrement: number };
      batchNumber?: string;
      costPerUnit?: number;
    } = {
      currentStock: { decrement: deductQty },
      ...(params.batchNumber ? { batchNumber: params.batchNumber } : {}),
    };

    const remainingLots = await db.inventoryLot.findMany({
      where: { inventoryItemId: ing.inventoryItemId, qtyRemaining: { gt: 0 } },
      orderBy: { receivedAt: "asc" },
    });
    const avg = weightedAverageCost(
      remainingLots.map((l) => ({
        qtyRemaining: Number(l.qtyRemaining),
        unitCost: Number(l.unitCost),
      })),
    );
    if (avg != null) updateData.costPerUnit = avg;

    await db.inventoryItem.update({
      where: { id: ing.inventoryItemId },
      data: updateData,
    });
  }
}
