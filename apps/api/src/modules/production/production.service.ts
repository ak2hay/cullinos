import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ProductionService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, outletId?: string) {
    return this.prisma.productionBatch.findMany({
      where: {
        organizationId: orgId,
        ...(outletId ? { outletId } : {}),
      },
      include: { recipe: { include: { ingredients: { include: { inventoryItem: true } } } } },
      orderBy: { scheduledFor: "asc" },
      take: 200,
    });
  }

  async get(orgId: string, id: string) {
    const batch = await this.prisma.productionBatch.findFirst({
      where: { id, organizationId: orgId },
      include: { recipe: { include: { ingredients: { include: { inventoryItem: true } } } } },
    });
    if (!batch) throw new NotFoundException("Production batch not found");
    return batch;
  }

  create(
    orgId: string,
    data: {
      outletId: string;
      recipeId?: string;
      name: string;
      plannedQty: number;
      scaleFactor?: number;
      batchNumber?: string;
      scheduledFor: string;
      notes?: string;
    },
  ) {
    return this.prisma.productionBatch.create({
      data: {
        organizationId: orgId,
        outletId: data.outletId,
        recipeId: data.recipeId,
        name: data.name,
        plannedQty: data.plannedQty,
        scaleFactor: data.scaleFactor ?? 1,
        batchNumber: data.batchNumber,
        scheduledFor: new Date(data.scheduledFor),
        notes: data.notes,
      },
      include: { recipe: { include: { ingredients: { include: { inventoryItem: true } } } } },
    });
  }

  async update(orgId: string, id: string, data: Record<string, unknown>) {
    await this.get(orgId, id);
    const update: Record<string, unknown> = { ...data };
    if (data.scheduledFor) update.scheduledFor = new Date(data.scheduledFor as string);
    if (data.completedAt) update.completedAt = new Date(data.completedAt as string);
    return this.prisma.productionBatch.update({
      where: { id },
      data: update,
      include: { recipe: { include: { ingredients: { include: { inventoryItem: true } } } } },
    });
  }

  async complete(orgId: string, id: string, actualQty?: number) {
    const batch = await this.get(orgId, id);
    if (batch.status === "completed") {
      throw new BadRequestException("Batch already completed");
    }

    const scale = Number(batch.scaleFactor);
    const qty = actualQty ?? Number(batch.plannedQty);

    if (batch.recipe?.ingredients.length) {
      for (const ing of batch.recipe.ingredients) {
        const deductQty = Number(ing.quantity) * scale * (qty / Number(batch.recipe.yield));
        await this.prisma.inventoryItem.update({
          where: { id: ing.inventoryItemId },
          data: {
            currentStock: { decrement: deductQty },
            batchNumber: batch.batchNumber ?? undefined,
          },
        });
        await this.prisma.stockMovement.create({
          data: {
            inventoryItemId: ing.inventoryItemId,
            type: "sale",
            quantity: deductQty,
            reference: `production:${batch.id}`,
          },
        });
      }
    }

    return this.prisma.productionBatch.update({
      where: { id },
      data: {
        status: "completed",
        actualQty: qty,
        completedAt: new Date(),
      },
      include: { recipe: { include: { ingredients: { include: { inventoryItem: true } } } } },
    });
  }

  async scaleRecipe(orgId: string, recipeId: string, scaleFactor: number) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { menuItem: { organizationId: orgId }, id: recipeId },
      include: { ingredients: { include: { inventoryItem: true } }, menuItem: true },
    });
    if (!recipe) throw new NotFoundException("Recipe not found");

    return {
      recipeId: recipe.id,
      menuItem: recipe.menuItem.name,
      yield: Number(recipe.yield),
      scaleFactor,
      scaledYield: Number(recipe.yield) * scaleFactor,
      ingredients: recipe.ingredients.map((ing) => ({
        inventoryItemId: ing.inventoryItemId,
        name: ing.inventoryItem.name,
        unit: ing.inventoryItem.unit,
        baseQuantity: Number(ing.quantity),
        scaledQuantity: Number(ing.quantity) * scaleFactor,
      })),
    };
  }

  async delete(orgId: string, id: string) {
    await this.get(orgId, id);
    await this.prisma.productionBatch.delete({ where: { id } });
  }
}
