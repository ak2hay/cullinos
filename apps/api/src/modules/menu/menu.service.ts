import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { toPaise, toRupees } from "../../common/money.util";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Admin/clients send & expect paise; DB stores rupees. */
function withPaisePrice<T extends { basePrice: unknown }>(item: T) {
  return { ...item, basePrice: toPaise(item.basePrice as never) };
}

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.menuItem
      .findMany({
        where: { organizationId: orgId, isActive: true },
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
    // Soft-delete: hard delete fails when menu items still reference the category.
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
        include: { category: true },
        orderBy: { sortOrder: "asc" },
      })
      .then((items) => items.map(withPaisePrice));
  }

  async createItem(
    orgId: string,
    data: {
      categoryId: string;
      name: string;
      description?: string;
      basePrice: number;
      isVeg?: boolean;
      allergens?: string[];
    },
  ) {
    const slug = slugify(data.name);
    const created = await this.prisma.menuItem.create({
      data: {
        organizationId: orgId,
        categoryId: data.categoryId,
        name: data.name,
        slug,
        description: data.description,
        basePrice: toRupees(data.basePrice),
        isVeg: data.isVeg ?? false,
        allergens: data.allergens ?? [],
      },
    });
    return withPaisePrice(created);
  }

  async updateItem(
    orgId: string,
    id: string,
    data: Partial<{
      name: string;
      description: string;
      basePrice: number;
      isActive: boolean;
      isAvailable: boolean;
      isVeg: boolean;
      allergens: string[];
      categoryId: string;
    }>,
  ) {
    const existing = await this.prisma.menuItem.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Menu item not found");
    const { isAvailable, ...rest } = data;
    const update: Record<string, unknown> = { ...rest };
    if (data.name) update.slug = slugify(data.name);
    if (data.basePrice != null) {
      update.basePrice = toRupees(data.basePrice);
    }
    if (isAvailable != null) update.isActive = isAvailable;
    const updated = await this.prisma.menuItem.update({ where: { id }, data: update });
    return withPaisePrice(updated);
  }

  async deleteItem(orgId: string, id: string) {
    const existing = await this.prisma.menuItem.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!existing) throw new NotFoundException("Menu item not found");
    // Soft-delete so order history FKs remain valid; list endpoints exclude inactive.
    await this.prisma.menuItem.update({
      where: { id },
      data: { isActive: false },
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

  async setOutletPrice(
    orgId: string,
    outletId: string,
    menuItemId: string,
    price: number,
    priceType: "retail" | "wholesale" = "retail",
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
      update: { price: priceRupees },
      create: { outletId, menuItemId, price: priceRupees, priceType },
    });
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
      },
      orderBy: { sortOrder: "asc" },
    });

    return {
      outletId,
      operatingMode: outlet.operatingMode,
      activeSchedule: activeSchedule?.name ?? null,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      })),
      items: items.map((item) => {
        const outletPrice = item.outletPrices[0];
        const priceRupees = outletPrice
          ? Number(outletPrice.price)
          : Number(item.basePrice);
        return {
          id: item.id,
          name: item.name,
          description: item.description,
          price: toPaise(priceRupees),
          isAvailable: outletPrice ? outletPrice.isAvailable : true,
          categoryId: item.categoryId,
          imageUrl: item.imageUrl,
          isVeg: item.isVeg,
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
        };
      }),
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
