import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.recipe.findMany({
      where: { menuItem: { organizationId: orgId } },
      include: {
        menuItem: { select: { id: true, name: true } },
        ingredients: {
          include: {
            inventoryItem: { select: { id: true, name: true, unit: true } },
          },
        },
      },
      take: 200,
    });
  }

  async create(
    orgId: string,
    data: {
      menuItemId: string;
      name?: string;
      yieldQty?: number;
      ingredients: Array<{
        inventoryItemId: string;
        quantity: number;
        unit?: string;
      }>;
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

    const invIds = data.ingredients.map((i) => i.inventoryItemId);
    const invItems = await this.prisma.inventoryItem.findMany({
      where: { organizationId: orgId, id: { in: invIds } },
    });
    if (invItems.length !== new Set(invIds).size) {
      throw new NotFoundException("One or more inventory items not found");
    }

    for (const ing of data.ingredients) {
      if (!Number.isFinite(Number(ing.quantity)) || Number(ing.quantity) <= 0) {
        throw new BadRequestException("ingredient quantity must be positive");
      }
    }

    // Schema: Recipe has menuItemId + yield only (name/unit ignored if provided)
    return this.prisma.recipe.create({
      data: {
        menuItemId: data.menuItemId,
        yield: data.yieldQty ?? 1,
        ingredients: {
          create: data.ingredients.map((ing) => ({
            inventoryItemId: ing.inventoryItemId,
            quantity: Number(ing.quantity),
          })),
        },
      },
      include: {
        menuItem: { select: { id: true, name: true } },
        ingredients: {
          include: {
            inventoryItem: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });
  }
}
