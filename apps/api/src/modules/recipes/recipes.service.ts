import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface RecipeIngredientInput {
  inventoryItemId: string;
  quantity: number;
  unit: string;
}

export interface CreateRecipeInput {
  menuItemId: string;
  yield?: number;
  notes?: string;
  ingredients: RecipeIngredientInput[];
}

export interface UpdateRecipeInput {
  yield?: number;
  notes?: string;
  ingredients?: RecipeIngredientInput[];
}

@Injectable()
export class RecipesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.client.recipe.findMany({
      where: { menuItem: { organizationId } },
      include: {
        menuItem: true,
        ingredients: { include: { inventoryItem: true } },
      },
    });
  }

  async findOne(id: string, organizationId: string) {
    const recipe = await this.prisma.client.recipe.findFirst({
      where: { id, menuItem: { organizationId } },
      include: {
        menuItem: true,
        ingredients: { include: { inventoryItem: true } },
        versions: { orderBy: { version: 'desc' }, take: 5 },
      },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');
    return recipe;
  }

  async findByMenuItem(menuItemId: string, organizationId: string) {
    const recipe = await this.prisma.client.recipe.findFirst({
      where: { menuItemId, menuItem: { organizationId } },
      include: {
        ingredients: { include: { inventoryItem: true } },
      },
    });
    if (!recipe) throw new NotFoundException('Recipe not found for menu item');
    return recipe;
  }

  async create(
    organizationId: string,
    userId: string,
    input: CreateRecipeInput,
  ) {
    const menuItem = await this.prisma.client.menuItem.findFirst({
      where: { id: input.menuItemId, organizationId },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found');

    const existing = await this.prisma.client.recipe.findUnique({
      where: { menuItemId: input.menuItemId },
    });
    if (existing) {
      throw new BadRequestException('Recipe already exists for this menu item');
    }

    const recipe = await this.prisma.client.recipe.create({
      data: {
        menuItemId: input.menuItemId,
        yield: input.yield ?? 1,
        notes: input.notes,
        ingredients: {
          create: input.ingredients,
        },
        versions: {
          create: { version: 1, notes: input.notes },
        },
      },
      include: {
        menuItem: true,
        ingredients: { include: { inventoryItem: true } },
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'RECIPE_CREATED',
      entityType: 'Recipe',
      entityId: recipe.id,
    });

    return recipe;
  }

  async update(
    id: string,
    organizationId: string,
    userId: string,
    input: UpdateRecipeInput,
  ) {
    const existing = await this.findOne(id, organizationId);

    const recipe = await this.prisma.client.$transaction(async (tx) => {
      if (input.ingredients) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
        await tx.recipeIngredient.createMany({
          data: input.ingredients.map((i) => ({ recipeId: id, ...i })),
        });
      }

      const newVersion = existing.version + 1;
      await tx.recipeVersion.create({
        data: { recipeId: id, version: newVersion, notes: input.notes },
      });

      return tx.recipe.update({
        where: { id },
        data: {
          yield: input.yield,
          notes: input.notes,
          version: newVersion,
        },
        include: {
          menuItem: true,
          ingredients: { include: { inventoryItem: true } },
        },
      });
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'RECIPE_UPDATED',
      entityType: 'Recipe',
      entityId: id,
    });

    return recipe;
  }

  async delete(id: string, organizationId: string, userId: string) {
    await this.findOne(id, organizationId);
    await this.prisma.client.recipe.delete({ where: { id } });

    await this.audit.log({
      organizationId,
      userId,
      action: 'RECIPE_DELETED',
      entityType: 'Recipe',
      entityId: id,
    });

    return { success: true };
  }

  async calculateFoodCost(
    recipeId: string,
    organizationId: string,
    outletId?: string,
  ) {
    const recipe = await this.findOne(recipeId, organizationId);
    const sellingPrice = recipe.menuItem.basePrice;

    let ingredientCost = 0;
    for (const ing of recipe.ingredients) {
      ingredientCost += Math.round(ing.quantity * ing.inventoryItem.costPerUnit);
    }

    const foodCostPct =
      sellingPrice > 0 ? (ingredientCost / sellingPrice) * 100 : 0;
    const grossMargin = sellingPrice - ingredientCost;

    const snapshot = await this.prisma.client.foodCostSnapshot.create({
      data: {
        menuItemId: recipe.menuItemId,
        outletId,
        ingredientCost,
        sellingPrice,
        foodCostPct,
        grossMargin,
      },
    });

    return {
      recipeId,
      menuItemId: recipe.menuItemId,
      ingredientCost,
      sellingPrice,
      foodCostPct: Math.round(foodCostPct * 100) / 100,
      grossMargin,
      yield: recipe.yield,
      costPerServing: Math.round(ingredientCost / recipe.yield),
      snapshot,
    };
  }
}
