import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { toPaise, toRupees } from "../../common/money.util";
import { normalizePublicAssetUrl } from "../../common/public-asset-url.util";
import { MarketingUploadService } from "../marketing/marketing-upload.service";

const MAX_SPECIALS_PER_ORG = 5;

type VariantInput = {
  name: string;
  price: number;
  sku?: string;
  isDefault?: boolean;
  sortOrder?: number;
};

type ModifierInput = {
  name: string;
  price?: number;
  isDefault?: boolean;
  sortOrder?: number;
};

type ModifierGroupInput = {
  name: string;
  minSelect?: number;
  maxSelect?: number;
  isRequired?: boolean;
  modifiers?: ModifierInput[];
};

const ITEM_DETAIL_INCLUDE = {
  category: true,
  variants: { orderBy: { sortOrder: "asc" as const } },
  modifierGroups: {
    include: {
      modifierGroup: {
        include: { modifiers: { orderBy: { sortOrder: "asc" as const } } },
      },
    },
  },
} as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function withPaisePrice<T extends { basePrice: unknown }>(item: T) {
  return { ...item, basePrice: toPaise(item.basePrice as never) };
}

function mapItemDetail(item: {
  basePrice: unknown;
  packagingCharge?: unknown;
  variants: Array<{ price: unknown } & Record<string, unknown>>;
  modifierGroups: Array<{
    modifierGroup: {
      id: string;
      name: string;
      minSelect: number;
      maxSelect: number;
      isRequired: boolean;
      modifiers: Array<{ price: unknown } & Record<string, unknown>>;
    };
  }>;
  [key: string]: unknown;
}) {
  return {
    ...withPaisePrice(item),
    imageUrl: normalizePublicAssetUrl(
      typeof item.imageUrl === "string" ? item.imageUrl : null,
    ),
    packagingCharge: toPaise(Number(item.packagingCharge ?? 0)),
    variants: item.variants.map((v) => ({
      ...v,
      price: toPaise(Number(v.price)),
    })),
    modifierGroups: item.modifierGroups.map((mg) => ({
      id: mg.modifierGroup.id,
      name: mg.modifierGroup.name,
      minSelect: mg.modifierGroup.minSelect,
      maxSelect: mg.modifierGroup.maxSelect,
      isRequired: mg.modifierGroup.isRequired,
      modifiers: mg.modifierGroup.modifiers.map((m) => ({
        ...m,
        price: toPaise(Number(m.price)),
      })),
    })),
  };
}

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    private upload: MarketingUploadService,
  ) {}

  list(orgId: string) {
    return this.prisma.menuItem
      .findMany({
        where: { organizationId: orgId, isActive: true, onlineAvailable: true },
        take: 200,
      })
      .then((items) => items.map(withPaisePrice));
  }

  listCategories(orgId: string) {
    return this.prisma.menuCategory.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createCategory(
    orgId: string,
    data: { name: string; description?: string; sortOrder?: number },
  ) {
    const slug = slugify(data.name);
    return this.prisma.menuCategory.create({
      data: {
        organizationId: orgId,
        name: data.name,
        slug,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(
    orgId: string,
    id: string,
    data: Partial<{ name: string; description: string; isActive: boolean; sortOrder: number }>,
  ) {
    const existing = await this.prisma.menuCategory.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Category not found");
    return this.prisma.menuCategory.update({
      where: { id },
      data: {
        ...data,
        ...(data.name ? { slug: slugify(data.name) } : {}),
      },
    });
  }

  async deleteCategory(orgId: string, id: string) {
    const existing = await this.prisma.menuCategory.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Category not found");
    await this.prisma.$transaction([
      this.prisma.menuItem.updateMany({
        where: { categoryId: id, organizationId: orgId },
        data: { isActive: false },
      }),
      this.prisma.menuCategory.update({
        where: { id },
        data: { isActive: false },
      }),
    ]);
  }

  listItems(orgId: string) {
    return this.prisma.menuItem
      .findMany({
        where: { organizationId: orgId, isActive: true },
        include: ITEM_DETAIL_INCLUDE,
        orderBy: { sortOrder: "asc" },
      })
      .then((items) => items.map(mapItemDetail));
  }

  async getItem(orgId: string, id: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, organizationId: orgId, isActive: true },
      include: ITEM_DETAIL_INCLUDE,
    });
    if (!item) throw new NotFoundException("Menu item not found");
    return mapItemDetail(item);
  }

  private async syncVariants(menuItemId: string, variants?: VariantInput[]) {
    if (variants == null) return;
    await this.prisma.menuItemVariant.deleteMany({ where: { menuItemId } });
    if (variants.length === 0) return;
    await this.prisma.menuItemVariant.createMany({
      data: variants.map((v, idx) => ({
        menuItemId,
        name: v.name,
        price: toRupees(v.price),
        sku: v.sku,
        isDefault: v.isDefault ?? idx === 0,
        sortOrder: v.sortOrder ?? idx,
      })),
    });
  }

  private async syncModifierGroups(
    orgId: string,
    menuItemId: string,
    groups?: ModifierGroupInput[],
  ) {
    if (groups == null) return;

    const existingLinks = await this.prisma.menuItemModifierGroup.findMany({
      where: { menuItemId },
    });
    const oldGroupIds = existingLinks.map((l) => l.modifierGroupId);

    await this.prisma.menuItemModifierGroup.deleteMany({ where: { menuItemId } });

    for (const groupId of oldGroupIds) {
      const otherLinks = await this.prisma.menuItemModifierGroup.count({
        where: { modifierGroupId: groupId },
      });
      if (otherLinks === 0) {
        await this.prisma.modifierGroup.delete({ where: { id: groupId } });
      }
    }

    for (const g of groups) {
      const created = await this.prisma.modifierGroup.create({
        data: {
          organizationId: orgId,
          name: g.name,
          minSelect: g.minSelect ?? 0,
          maxSelect: g.maxSelect ?? 1,
          isRequired: g.isRequired ?? false,
          modifiers: {
            create: (g.modifiers ?? []).map((m, idx) => ({
              name: m.name,
              price: toRupees(m.price ?? 0),
              isDefault: m.isDefault ?? false,
              sortOrder: m.sortOrder ?? idx,
            })),
          },
        },
      });
      await this.prisma.menuItemModifierGroup.create({
        data: { menuItemId, modifierGroupId: created.id },
      });
    }
  }

  async createItem(
    orgId: string,
    data: {
      categoryId: string;
      name: string;
      description?: string;
      imageUrl?: string | null;
      basePrice: number;
      isVeg?: boolean;
      isSpecial?: boolean;
      allergens?: string[];
      packagingCharge?: number;
      onlineAvailable?: boolean;
      stockBasedAvailability?: boolean;
      taxGroupId?: string | null;
      hsnCode?: string | null;
      variants?: VariantInput[];
      modifierGroups?: ModifierGroupInput[];
    },
  ) {
    if (data.isSpecial) {
      await this.assertSpecialsLimit(orgId);
    }
    if (data.taxGroupId) {
      const group = await this.prisma.taxGroup.findFirst({
        where: { id: data.taxGroupId, organizationId: orgId },
      });
      if (!group) throw new BadRequestException("Invalid taxGroupId");
    }
    const slug = slugify(data.name);
    const created = await this.prisma.menuItem.create({
      data: {
        organizationId: orgId,
        categoryId: data.categoryId,
        name: data.name,
        slug,
        description: data.description,
        imageUrl: data.imageUrl?.trim() || null,
        basePrice: toRupees(data.basePrice),
        isVeg: data.isVeg ?? false,
        isSpecial: data.isSpecial ?? false,
        allergens: data.allergens ?? [],
        packagingCharge: toRupees(data.packagingCharge ?? 0),
        onlineAvailable: data.onlineAvailable ?? true,
        stockBasedAvailability: data.stockBasedAvailability ?? false,
        taxGroupId: data.taxGroupId || null,
        hsnCode: data.hsnCode?.trim() || null,
      },
    });

    await this.syncVariants(created.id, data.variants);
    await this.syncModifierGroups(orgId, created.id, data.modifierGroups);

    return this.getItem(orgId, created.id);
  }

  async updateItem(
    orgId: string,
    id: string,
    data: Partial<{
      name: string;
      description: string;
      imageUrl: string | null;
      basePrice: number;
      isActive: boolean;
      onlineAvailable: boolean;
      stockBasedAvailability: boolean;
      packagingCharge: number;
      isVeg: boolean;
      isSpecial: boolean;
      allergens: string[];
      categoryId: string;
      taxGroupId: string | null;
      hsnCode: string | null;
      variants: VariantInput[];
      modifierGroups: ModifierGroupInput[];
    }>,
  ) {
    const existing = await this.prisma.menuItem.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Menu item not found");

    if (data.isSpecial === true && !existing.isSpecial) {
      await this.assertSpecialsLimit(orgId, id);
    }

    if (data.taxGroupId) {
      const group = await this.prisma.taxGroup.findFirst({
        where: { id: data.taxGroupId, organizationId: orgId },
      });
      if (!group) throw new BadRequestException("Invalid taxGroupId");
    }

    const { variants, modifierGroups, ...rest } = data;
    const update: Record<string, unknown> = { ...rest };
    if (data.name) update.slug = slugify(data.name);
    if (data.basePrice != null) update.basePrice = toRupees(data.basePrice);
    if (data.packagingCharge != null) {
      update.packagingCharge = toRupees(data.packagingCharge);
    }
    if (data.hsnCode !== undefined) {
      update.hsnCode = data.hsnCode?.trim() || null;
    }
    if (data.taxGroupId !== undefined) {
      update.taxGroupId = data.taxGroupId || null;
    }
    if (data.imageUrl !== undefined) {
      const next = data.imageUrl?.trim() || null;
      if (next !== existing.imageUrl) {
        await this.upload.deleteManagedUrl(existing.imageUrl);
      }
      update.imageUrl = next;
    }

    await this.prisma.menuItem.update({ where: { id }, data: update });
    await this.syncVariants(id, variants);
    await this.syncModifierGroups(orgId, id, modifierGroups);

    return this.getItem(orgId, id);
  }

  async setItemImageUrl(orgId: string, id: string, imageUrl: string) {
    return this.updateItem(orgId, id, { imageUrl });
  }

  private async assertSpecialsLimit(orgId: string, excludeId?: string) {
    const count = await this.prisma.menuItem.count({
      where: {
        organizationId: orgId,
        isActive: true,
        isSpecial: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (count >= MAX_SPECIALS_PER_ORG) {
      throw new BadRequestException(
        `Maximum ${MAX_SPECIALS_PER_ORG} special dishes allowed per organization.`,
      );
    }
  }

  async deleteItem(orgId: string, id: string) {
    const existing = await this.prisma.menuItem.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Menu item not found");
    await this.upload.deleteManagedUrl(existing.imageUrl);
    await this.prisma.menuItem.update({
      where: { id },
      data: { isActive: false, imageUrl: null },
    });
  }

  listSchedules(orgId: string) {
    return this.prisma.menuSchedule.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    });
  }

  createSchedule(
    orgId: string,
    data: {
      name: string;
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
      categoryIds: string[];
    },
  ) {
    return this.prisma.menuSchedule.create({
      data: { organizationId: orgId, ...data },
    });
  }

  async updateSchedule(
    orgId: string,
    id: string,
    data: Partial<{
      name: string;
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
      categoryIds: string[];
      isActive: boolean;
    }>,
  ) {
    const existing = await this.prisma.menuSchedule.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Schedule not found");
    return this.prisma.menuSchedule.update({ where: { id }, data });
  }

  async deleteSchedule(orgId: string, id: string) {
    const existing = await this.prisma.menuSchedule.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Schedule not found");
    await this.prisma.menuSchedule.delete({ where: { id } });
  }

  listCombos(orgId: string) {
    return this.prisma.combo
      .findMany({
        where: { organizationId: orgId },
        include: {
          items: {
            include: { menuItem: { select: { id: true, name: true } } },
          },
        },
        orderBy: { name: "asc" },
      })
      .then((combos) =>
        combos.map((c) => ({
          ...c,
          price: toPaise(c.price),
          items: c.items.map((i) => ({
            id: i.id,
            menuItemId: i.menuItemId,
            menuItemName: i.menuItem.name,
            quantity: i.quantity,
          })),
        })),
      );
  }

  async createCombo(
    orgId: string,
    data: {
      name: string;
      price: number;
      isActive?: boolean;
      items: Array<{ menuItemId: string; quantity?: number }>;
    },
  ) {
    const combo = await this.prisma.combo.create({
      data: {
        organizationId: orgId,
        name: data.name,
        price: toRupees(data.price),
        isActive: data.isActive ?? true,
        items: {
          create: data.items.map((i) => ({
            menuItemId: i.menuItemId,
            quantity: i.quantity ?? 1,
          })),
        },
      },
      include: {
        items: {
          include: { menuItem: { select: { id: true, name: true } } },
        },
      },
    });
    return {
      ...combo,
      price: toPaise(combo.price),
      items: combo.items.map((i) => ({
        id: i.id,
        menuItemId: i.menuItemId,
        menuItemName: i.menuItem.name,
        quantity: i.quantity,
      })),
    };
  }

  async updateCombo(
    orgId: string,
    id: string,
    data: Partial<{
      name: string;
      price: number;
      isActive: boolean;
      items: Array<{ menuItemId: string; quantity?: number }>;
    }>,
  ) {
    const existing = await this.prisma.combo.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Combo not found");

    const { items, ...rest } = data;
    const update: Record<string, unknown> = { ...rest };
    if (data.price != null) update.price = toRupees(data.price);

    await this.prisma.$transaction(async (tx) => {
      await tx.combo.update({ where: { id }, data: update });
      if (items != null) {
        await tx.comboItem.deleteMany({ where: { comboId: id } });
        if (items.length > 0) {
          await tx.comboItem.createMany({
            data: items.map((i) => ({
              comboId: id,
              menuItemId: i.menuItemId,
              quantity: i.quantity ?? 1,
            })),
          });
        }
      }
    });

    const combo = await this.prisma.combo.findUniqueOrThrow({
      where: { id },
      include: {
        items: {
          include: { menuItem: { select: { id: true, name: true } } },
        },
      },
    });
    return {
      ...combo,
      price: toPaise(combo.price),
      items: combo.items.map((i) => ({
        id: i.id,
        menuItemId: i.menuItemId,
        menuItemName: i.menuItem.name,
        quantity: i.quantity,
      })),
    };
  }

  async deleteCombo(orgId: string, id: string) {
    const existing = await this.prisma.combo.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Combo not found");
    await this.prisma.combo.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async listOutletPrices(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const items = await this.prisma.menuItem.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        outletPrices: { where: { outletId, priceType: "retail" } },
      },
      orderBy: { name: "asc" },
    });

    return items.map((item) => {
      const outletPrice = item.outletPrices[0];
      return {
        menuItemId: item.id,
        name: item.name,
        basePrice: toPaise(item.basePrice),
        packagingCharge: toPaise(item.packagingCharge ?? 0),
        onlineAvailable: item.onlineAvailable,
        outletPrice: outletPrice ? toPaise(outletPrice.price) : null,
        isAvailable: outletPrice?.isAvailable ?? true,
      };
    });
  }

  async setOutletPrice(
    orgId: string,
    outletId: string,
    menuItemId: string,
    price: number,
    priceType: "retail" | "wholesale" = "retail",
    isAvailable?: boolean,
  ) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, organizationId: orgId },
    });
    if (!item) throw new NotFoundException("Menu item not found");

    const priceRupees = toRupees(price);
    return this.prisma.outletMenuPrice.upsert({
      where: {
        outletId_menuItemId_priceType: { outletId, menuItemId, priceType },
      },
      update: {
        price: priceRupees,
        ...(isAvailable != null ? { isAvailable } : {}),
      },
      create: {
        outletId,
        menuItemId,
        price: priceRupees,
        priceType,
        isAvailable: isAvailable ?? true,
      },
    });
  }

  private async isItemInStock(menuItemId: string): Promise<boolean> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { menuItemId },
      include: { ingredients: { include: { inventoryItem: true } } },
    });
    if (!recipe || recipe.ingredients.length === 0) return true;

    const yieldQty = Number(recipe.yield) || 1;
    for (const ing of recipe.ingredients) {
      if (!ing.inventoryItem) return false;
      const stock = Number(ing.inventoryItem.currentStock);
      const needed = Number(ing.quantity) / yieldQty;
      if (stock < needed) return false;
    }
    return true;
  }

  async getOutletMenu(orgId: string, outletId: string) {
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: outletId, organizationId: orgId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");

    const activeSchedules = await this.prisma.menuSchedule.findMany({
      where: { organizationId: orgId, isActive: true },
    });

    const now = new Date();
    const dayOfWeek = now.getDay();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const activeSchedule = activeSchedules.find(
      (s) =>
        s.daysOfWeek.includes(dayOfWeek) &&
        s.startTime <= timeStr &&
        s.endTime >= timeStr,
    );

    const categories = await this.prisma.menuCategory.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        ...(activeSchedule?.categoryIds.length
          ? { id: { in: activeSchedule.categoryIds } }
          : {}),
      },
      orderBy: { sortOrder: "asc" },
    });

    const items = await this.prisma.menuItem.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        onlineAvailable: true,
        ...(activeSchedule?.categoryIds.length
          ? { categoryId: { in: activeSchedule.categoryIds } }
          : {}),
      },
      include: {
        variants: { orderBy: { sortOrder: "asc" } },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { modifiers: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
        outletPrices: { where: { outletId, priceType: "retail" } },
        recipe: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    const mappedItems = [];
    for (const item of items) {
      const outletPrice = item.outletPrices[0];
      if (outletPrice && !outletPrice.isAvailable) continue;

      if (item.stockBasedAvailability) {
        const inStock = await this.isItemInStock(item.id);
        if (!inStock) continue;
      }

      const priceRupees = outletPrice
        ? Number(outletPrice.price)
        : Number(item.basePrice);
      mappedItems.push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: toPaise(priceRupees),
        packagingCharge: toPaise(item.packagingCharge ?? 0),
        isAvailable: true,
        categoryId: item.categoryId,
        imageUrl: normalizePublicAssetUrl(item.imageUrl),
        isVeg: item.isVeg,
        isSpecial: item.isSpecial,
        allergens: item.allergens,
        variants: item.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: toPaise(v.price),
        })),
        modifierGroups: item.modifierGroups.map((mg) => ({
          id: mg.modifierGroup.id,
          name: mg.modifierGroup.name,
          minSelect: mg.modifierGroup.minSelect,
          maxSelect: mg.modifierGroup.maxSelect,
          modifiers: mg.modifierGroup.modifiers.map((m) => ({
            id: m.id,
            name: m.name,
            price: toPaise(m.price),
          })),
        })),
      });
    }

    return {
      outletId,
      operatingMode: outlet.operatingMode,
      activeSchedule: activeSchedule?.name ?? null,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
      items: mappedItems,
    };
  }

  async getOutletMenuPublic(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
    });
    if (!outlet) throw new NotFoundException("Outlet not found");
    return this.getOutletMenu(outlet.organizationId, outletId);
  }
}
