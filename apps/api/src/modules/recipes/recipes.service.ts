import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { deductRecipeIngredients } from "../../common/recipe-stock.util";

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

  /** Deduct recipe stock for order line items (idempotent via order metadata). */
  async deductForOrder(
    orgId: string,
    order: {
      id: string;
      metadata: unknown;
      items: Array<{ menuItemId: string | null; quantity: number }>;
    },
  ): Promise<boolean> {
    const metadata =
      order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
        ? (order.metadata as Record<string, unknown>)
        : {};
    if (metadata.stockDeductedAt) return false;

    const menuItemIds = [
      ...new Set(order.items.map((i) => i.menuItemId).filter(Boolean)),
    ] as string[];
    if (!menuItemIds.length) return false;

    const recipes = await this.prisma.recipe.findMany({
      where: { menuItemId: { in: menuItemIds }, menuItem: { organizationId: orgId } },
      include: { ingredients: true },
    });
    const recipeByMenuItem = new Map(recipes.map((r) => [r.menuItemId, r]));
    if (!recipes.length) return false;

    for (const item of order.items) {
      if (!item.menuItemId) continue;
      const recipe = recipeByMenuItem.get(item.menuItemId);
      if (!recipe?.ingredients.length) continue;

      await this.deductRecipeRecursive(
        orgId,
        recipe.id,
        recipe.ingredients,
        Number(recipe.yield),
        item.quantity,
        `order:${order.id}`,
        new Set(),
      );
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        metadata: {
          ...metadata,
          stockDeductedAt: new Date().toISOString(),
        },
        timeline: {
          create: { event: "order.stock_deducted", metadata: { source: "recipe" } },
        },
      },
    });

    return true;
  }

  private async deductRecipeRecursive(
    orgId: string,
    recipeId: string,
    ingredients: Array<{
      inventoryItemId: string | null;
      subRecipeId: string | null;
      quantity: unknown;
    }>,
    recipeYield: number,
    quantity: number,
    reference: string,
    visited: Set<string>,
  ): Promise<void> {
    if (visited.has(recipeId)) {
      throw new BadRequestException("Circular sub-recipe reference detected");
    }
    visited.add(recipeId);

    const inventoryIngredients = ingredients.filter((i) => i.inventoryItemId);
    if (inventoryIngredients.length) {
      await deductRecipeIngredients(this.prisma, {
        ingredients: inventoryIngredients.map((i) => ({
          inventoryItemId: i.inventoryItemId!,
          quantity: Number(i.quantity),
        })),
        recipeYield,
        quantity,
        reference,
        movementType: "sale",
      });
    }

    for (const ing of ingredients) {
      if (!ing.subRecipeId) continue;
      const sub = await this.prisma.recipe.findFirst({
        where: { id: ing.subRecipeId, menuItem: { organizationId: orgId } },
        include: { ingredients: true },
      });
      if (!sub?.ingredients.length) continue;

      const subQty =
        Number(ing.quantity) * (quantity / (recipeYield > 0 ? recipeYield : 1));
      await this.deductRecipeRecursive(
        orgId,
        sub.id,
        sub.ingredients,
        Number(sub.yield),
        subQty,
        reference,
        new Set(visited),
      );
    }
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
