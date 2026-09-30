import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import {
  deductRecipeIngredients,
  lineStockQuantity,
  netOrderStockToRestore,
  orderStockReference,
  weightedAverageCost,
} from "../../common/recipe-stock.util";

type Tx = Prisma.TransactionClient;

type StockLine = { menuItemId: string | null; variantId?: string | null; quantity: number };

const STOCK_TX_OPTIONS = { timeout: 30_000 } as const;

type IngredientInput = {
  inventoryItemId?: string | null;
  subRecipeId?: string | null;
  quantity: number;
  unit?: string;
};

const recipeInclude = {
  menuItem: { select: { id: true, name: true } },
  parentRecipe: { select: { id: true, menuItem: { select: { name: true } } } },
  ingredients: {
    include: {
      inventoryItem: { select: { id: true, name: true, unit: true } },
      subRecipe: {
        select: {
          id: true,
          menuItem: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.recipe.findMany({
      where: { menuItem: { organizationId: orgId } },
      include: recipeInclude,
      take: 200,
    });
  }

  async get(orgId: string, id: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, menuItem: { organizationId: orgId } },
      include: recipeInclude,
    });
    if (!recipe) throw new NotFoundException("Recipe not found");
    return recipe;
  }

  async create(
    orgId: string,
    data: {
      menuItemId: string;
      name?: string;
      yieldQty?: number;
      parentRecipeId?: string | null;
      ingredients: IngredientInput[];
    },
  ) {
    if (!data.menuItemId) throw new BadRequestException("menuItemId is required");
    if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) {
      throw new BadRequestException("at least one ingredient is required");
    }

    const menuItem = await this.prisma.menuItem.findFirst({
      where: { id: data.menuItemId, organizationId: orgId },
    });
    if (!menuItem) throw new NotFoundException("Menu item not found");

    const existing = await this.prisma.recipe.findUnique({
      where: { menuItemId: data.menuItemId },
    });
    if (existing) {
      throw new ConflictException("Recipe already exists for this menu item");
    }

    await this.validateIngredients(orgId, data.ingredients);
    if (data.parentRecipeId) {
      await this.assertRecipeInOrg(orgId, data.parentRecipeId);
    }

    return this.prisma.recipe.create({
      data: {
        menuItemId: data.menuItemId,
        yield: data.yieldQty ?? 1,
        parentRecipeId: data.parentRecipeId || null,
        ingredients: {
          create: data.ingredients.map((ing) => ({
            inventoryItemId: ing.inventoryItemId || null,
            subRecipeId: ing.subRecipeId || null,
            quantity: Number(ing.quantity),
          })),
        },
      },
      include: recipeInclude,
    });
  }

  async update(
    orgId: string,
    id: string,
    data: {
      yieldQty?: number;
      parentRecipeId?: string | null;
      ingredients?: IngredientInput[];
    },
  ) {
    await this.get(orgId, id);

    if (data.ingredients) {
      if (data.ingredients.length === 0) {
        throw new BadRequestException("at least one ingredient is required");
      }
      await this.validateIngredients(orgId, data.ingredients);
    }
    if (data.parentRecipeId) {
      await this.assertRecipeInOrg(orgId, data.parentRecipeId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.ingredients) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        await tx.recipeIngredient.createMany({
          data: data.ingredients.map((ing) => ({
            recipeId: id,
            inventoryItemId: ing.inventoryItemId || null,
            subRecipeId: ing.subRecipeId || null,
            quantity: Number(ing.quantity),
          })),
        });
      }

      return tx.recipe.update({
        where: { id },
        data: {
          ...(data.yieldQty !== undefined ? { yield: data.yieldQty } : {}),
          ...(data.parentRecipeId !== undefined
            ? { parentRecipeId: data.parentRecipeId || null }
            : {}),
        },
        include: recipeInclude,
      });
    });
  }

  async delete(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.recipe.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Deduct recipe stock when an order is served/completed. The order row is locked so
   * concurrent status changes cannot deduct twice; deducted line ids are kept in metadata.
   */
  deductForOrder(orgId: string, orderId: string): Promise<boolean> {
    return this.applyOrderStock(orgId, orderId, "start");
  }

  /** Deduct lines added after the order's stock was already deducted (no-op otherwise). */
  deductNewOrderItems(orgId: string, orderId: string): Promise<boolean> {
    return this.applyOrderStock(orgId, orderId, "incremental");
  }

  /** Put back everything still deducted for this order (cancel / void / merge). */
  async restoreForOrder(orgId: string, orderId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orgId, orderId);
      if (!order?.metadata.stockDeductedAt) return false;

      const reference = orderStockReference(orderId);
      const restockReference = `${reference}:restock`;
      const movements = await tx.stockMovement.findMany({
        where: {
          reference: { in: [reference, restockReference] },
          inventoryItem: { organizationId: orgId },
        },
        select: { inventoryItemId: true, lotId: true, quantity: true, reference: true },
      });
      const restores = netOrderStockToRestore(
        movements.map((m) => ({
          inventoryItemId: m.inventoryItemId,
          lotId: m.lotId,
          quantity: Number(m.quantity),
          restock: m.reference === restockReference,
        })),
      );

      const touched = new Set<string>();
      for (const r of restores) {
        if (r.lotId) {
          await tx.inventoryLot.updateMany({
            where: { id: r.lotId, inventoryItemId: r.inventoryItemId },
            data: { qtyRemaining: { increment: r.quantity } },
          });
        }
        await tx.inventoryItem.update({
          where: { id: r.inventoryItemId },
          data: { currentStock: { increment: r.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            inventoryItemId: r.inventoryItemId,
            lotId: r.lotId,
            type: "return",
            quantity: r.quantity,
            reference: restockReference,
            notes: r.lotId ? `lot:${r.lotId}` : "no-lot",
          },
        });
        touched.add(r.inventoryItemId);
      }

      for (const inventoryItemId of touched) {
        const lots = await tx.inventoryLot.findMany({
          where: { inventoryItemId, qtyRemaining: { gt: 0 } },
          orderBy: { receivedAt: "asc" },
        });
        const avg = weightedAverageCost(
          lots.map((l) => ({ qtyRemaining: Number(l.qtyRemaining), unitCost: Number(l.unitCost) })),
        );
        if (avg != null) {
          await tx.inventoryItem.update({
            where: { id: inventoryItemId },
            data: { costPerUnit: avg },
          });
        }
      }

      const metadata: Record<string, unknown> = {
        ...order.metadata,
        stockRestoredAt: new Date().toISOString(),
      };
      delete metadata.stockDeductedAt;
      delete metadata.stockDeductedItemIds;
      await tx.order.update({
        where: { id: orderId },
        data: {
          metadata: metadata as Prisma.InputJsonValue,
          ...(restores.length
            ? {
                timeline: {
                  create: {
                    event: "order.stock_restored",
                    metadata: { source: "recipe", lines: restores.length },
                  },
                },
              }
            : {}),
        },
      });
      return restores.length > 0;
    }, STOCK_TX_OPTIONS);
  }

  private async applyOrderStock(
    orgId: string,
    orderId: string,
    mode: "start" | "incremental",
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, orgId, orderId);
      if (!order) return false;

      const meta = order.metadata;
      const started = Boolean(meta.stockDeductedAt);
      if (mode === "start" && started) return false;
      if (mode === "incremental" && (!started || !Array.isArray(meta.stockDeductedItemIds))) {
        return false;
      }

      const done = new Set(
        mode === "incremental" ? (meta.stockDeductedItemIds as unknown[]).map(String) : [],
      );
      const pending = order.items.filter((i) => !done.has(i.id));
      if (mode === "incremental" && !pending.length) return false;

      const deducted = await this.deductLines(
        tx,
        orgId,
        order.outletId,
        pending,
        orderStockReference(orderId),
      );

      const metadata: Record<string, unknown> = {
        ...meta,
        stockDeductedAt: started ? meta.stockDeductedAt : new Date().toISOString(),
        stockDeductedItemIds: order.items.map((i) => i.id),
      };
      delete metadata.stockRestoredAt;
      await tx.order.update({
        where: { id: orderId },
        data: {
          metadata: metadata as Prisma.InputJsonValue,
          ...(deducted
            ? {
                timeline: {
                  create: {
                    event: "order.stock_deducted",
                    metadata: { source: "recipe", itemIds: pending.map((i) => i.id) },
                  },
                },
              }
            : {}),
        },
      });
      return deducted;
    }, STOCK_TX_OPTIONS);
  }

  private async lockOrder(tx: Tx, orgId: string, orderId: string) {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} AND organization_id = ${orgId} FOR UPDATE`;
    const order = await tx.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      select: {
        id: true,
        outletId: true,
        metadata: true,
        items: { select: { id: true, menuItemId: true, variantId: true, quantity: true } },
      },
    });
    if (!order) return null;
    const metadata =
      order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
        ? (order.metadata as Record<string, unknown>)
        : {};
    return { ...order, metadata };
  }

  private async deductLines(
    tx: Tx,
    orgId: string,
    outletId: string | null,
    lines: StockLine[],
    reference: string,
  ): Promise<boolean> {
    const menuItemIds = [...new Set(lines.map((i) => i.menuItemId).filter(Boolean))] as string[];
    if (!menuItemIds.length) return false;

    const recipes = await tx.recipe.findMany({
      where: { menuItemId: { in: menuItemIds }, menuItem: { organizationId: orgId } },
      include: { ingredients: true },
    });
    if (!recipes.length) return false;
    const recipeByMenuItem = new Map(recipes.map((r) => [r.menuItemId, r]));

    const variantIds = [...new Set(lines.map((i) => i.variantId).filter(Boolean))] as string[];
    const variants = variantIds.length
      ? await tx.menuItemVariant.findMany({
          where: { id: { in: variantIds }, menuItem: { organizationId: orgId } },
          select: { id: true, stockMultiplier: true },
        })
      : [];
    const multiplierByVariant = new Map(variants.map((v) => [v.id, v.stockMultiplier]));

    const outletItemCache = new Map<string, string>();
    let deducted = false;
    for (const item of lines) {
      if (!item.menuItemId) continue;
      const recipe = recipeByMenuItem.get(item.menuItemId);
      if (!recipe?.ingredients.length) continue;

      const servings = lineStockQuantity(
        item.quantity,
        item.variantId ? multiplierByVariant.get(item.variantId) : null,
      );
      if (servings <= 0) continue;

      await this.deductRecipeRecursive(tx, orgId, outletId, outletItemCache, {
        recipeId: recipe.id,
        ingredients: recipe.ingredients,
        recipeYield: Number(recipe.yield),
        quantity: servings,
        reference,
        visited: new Set(),
      });
      deducted = true;
    }
    return deducted;
  }

  private async deductRecipeRecursive(
    tx: Tx,
    orgId: string,
    outletId: string | null,
    outletItemCache: Map<string, string>,
    params: {
      recipeId: string;
      ingredients: Array<{
        inventoryItemId: string | null;
        subRecipeId: string | null;
        quantity: unknown;
      }>;
      recipeYield: number;
      quantity: number;
      reference: string;
      visited: Set<string>;
    },
  ): Promise<void> {
    const { recipeId, ingredients, recipeYield, quantity, reference, visited } = params;
    if (visited.has(recipeId)) {
      throw new BadRequestException("Circular sub-recipe reference detected");
    }
    visited.add(recipeId);

    const inventoryIngredients = ingredients.filter((i) => i.inventoryItemId);
    if (inventoryIngredients.length) {
      const resolved = [];
      for (const ing of inventoryIngredients) {
        resolved.push({
          inventoryItemId: await this.resolveOutletItemId(
            tx,
            orgId,
            outletId,
            ing.inventoryItemId!,
            outletItemCache,
          ),
          quantity: Number(ing.quantity),
        });
      }
      await deductRecipeIngredients(tx, {
        ingredients: resolved,
        recipeYield,
        quantity,
        reference,
        movementType: "sale",
      });
    }

    for (const ing of ingredients) {
      if (!ing.subRecipeId) continue;
      const sub = await tx.recipe.findFirst({
        where: { id: ing.subRecipeId, menuItem: { organizationId: orgId } },
        include: { ingredients: true },
      });
      if (!sub?.ingredients.length) continue;

      const subQty =
        Number(ing.quantity) * (quantity / (recipeYield > 0 ? recipeYield : 1));
      await this.deductRecipeRecursive(tx, orgId, outletId, outletItemCache, {
        recipeId: sub.id,
        ingredients: sub.ingredients,
        recipeYield: Number(sub.yield),
        quantity: subQty,
        reference,
        visited: new Set(visited),
      });
    }
  }

  /**
   * Recipes link one inventory row, but multi-outlet orgs keep per-outlet copies (created by
   * stock transfer). Prefer the selling outlet's copy; fall back to the linked row.
   */
  private async resolveOutletItemId(
    tx: Tx,
    orgId: string,
    outletId: string | null,
    inventoryItemId: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const cached = cache.get(inventoryItemId);
    if (cached) return cached;

    let resolved = inventoryItemId;
    if (outletId) {
      const item = await tx.inventoryItem.findFirst({
        where: { id: inventoryItemId, organizationId: orgId },
        select: { outletId: true, name: true, sku: true, unit: true, catalogKey: true },
      });
      if (item && item.outletId !== outletId) {
        const match = await tx.inventoryItem.findFirst({
          where: {
            organizationId: orgId,
            outletId,
            unit: item.unit,
            OR: [
              { name: item.name, sku: item.sku },
              ...(item.catalogKey ? [{ catalogKey: item.catalogKey }] : []),
            ],
          },
          select: { id: true },
        });
        if (match) resolved = match.id;
      }
    }
    cache.set(inventoryItemId, resolved);
    return resolved;
  }

  private async assertRecipeInOrg(orgId: string, recipeId: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, menuItem: { organizationId: orgId } },
      select: { id: true },
    });
    if (!recipe) throw new NotFoundException("Parent/sub-recipe not found");
  }

  private async validateIngredients(orgId: string, ingredients: IngredientInput[]) {
    for (const ing of ingredients) {
      const hasInv = Boolean(ing.inventoryItemId);
      const hasSub = Boolean(ing.subRecipeId);
      if (hasInv === hasSub) {
        throw new BadRequestException(
          "Each ingredient must have exactly one of inventoryItemId or subRecipeId",
        );
      }
      if (!Number.isFinite(Number(ing.quantity)) || Number(ing.quantity) <= 0) {
        throw new BadRequestException("ingredient quantity must be positive");
      }
    }

    const invIds = ingredients
      .map((i) => i.inventoryItemId)
      .filter((id): id is string => Boolean(id));
    if (invIds.length) {
      const invItems = await this.prisma.inventoryItem.findMany({
        where: { organizationId: orgId, id: { in: invIds } },
      });
      if (invItems.length !== new Set(invIds).size) {
        throw new NotFoundException("One or more inventory items not found");
      }
    }

    const subIds = ingredients
      .map((i) => i.subRecipeId)
      .filter((id): id is string => Boolean(id));
    if (subIds.length) {
      const subs = await this.prisma.recipe.findMany({
        where: { id: { in: subIds }, menuItem: { organizationId: orgId } },
      });
      if (subs.length !== new Set(subIds).size) {
        throw new NotFoundException("One or more sub-recipes not found");
      }
    }
  }
}
