import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateMenuItemDto,
  UpdateMenuItemDto,
  CreateKitchenStationDto,
  UpdateKitchenStationDto,
  UpsertOutletPriceDto,
} from './dto/menu.dto';

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Categories ---

  async listCategories(organizationId: string) {
    return this.prisma.client.menuCategory.findMany({
      where: { organizationId, deletedAt: null },
      include: { children: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(organizationId: string, userId: string, dto: CreateCategoryDto) {
    const category = await this.prisma.client.menuCategory.create({
      data: { organizationId, ...dto },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'MenuCategory',
      entityId: category.id,
      newValue: category as unknown as Record<string, unknown>,
    });
    return category;
  }

  async updateCategory(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ) {
    const existing = await this.findCategory(organizationId, id);
    const category = await this.prisma.client.menuCategory.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'MenuCategory',
      entityId: id,
      previousValue: existing as unknown as Record<string, unknown>,
      newValue: category as unknown as Record<string, unknown>,
    });
    return category;
  }

  async deleteCategory(organizationId: string, userId: string, id: string) {
    const existing = await this.findCategory(organizationId, id);
    const category = await this.prisma.client.menuCategory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'DELETE',
      entityType: 'MenuCategory',
      entityId: id,
      previousValue: existing as unknown as Record<string, unknown>,
    });
    return category;
  }

  private async findCategory(organizationId: string, id: string) {
    const category = await this.prisma.client.menuCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // --- Menu Items ---

  async listMenuItems(organizationId: string) {
    return this.prisma.client.menuItem.findMany({
      where: { organizationId, deletedAt: null },
      include: {
        category: true,
        variants: { orderBy: { sortOrder: 'asc' } },
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
        },
        taxGroup: { include: { taxRates: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getMenuItem(organizationId: string, id: string) {
    const item = await this.prisma.client.menuItem.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        category: true,
        variants: { orderBy: { sortOrder: 'asc' } },
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: { orderBy: { sortOrder: 'asc' } } },
        },
        taxGroup: { include: { taxRates: true } },
      },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  async createMenuItem(organizationId: string, userId: string, dto: CreateMenuItemDto) {
    await this.findCategory(organizationId, dto.categoryId);

    const { variants, modifierGroups, ...itemData } = dto;

    const item = await this.prisma.client.menuItem.create({
      data: {
        organizationId,
        ...itemData,
        variants: variants?.length
          ? { create: variants }
          : undefined,
        modifierGroups: modifierGroups?.length
          ? {
              create: modifierGroups.map((g) => ({
                name: g.name,
                minSelect: g.minSelect ?? 0,
                maxSelect: g.maxSelect ?? 1,
                isRequired: g.isRequired ?? false,
                sortOrder: g.sortOrder ?? 0,
                modifiers: g.modifiers?.length
                  ? { create: g.modifiers }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: {
        variants: true,
        modifierGroups: { include: { modifiers: true } },
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'MenuItem',
      entityId: item.id,
      newValue: item as unknown as Record<string, unknown>,
    });
    return item;
  }

  async updateMenuItem(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateMenuItemDto,
  ) {
    const existing = await this.getMenuItem(organizationId, id);
    if (dto.categoryId) await this.findCategory(organizationId, dto.categoryId);

    const { variants, modifierGroups, ...itemData } = dto;

    const item = await this.prisma.client.$transaction(async (tx) => {
      if (variants !== undefined) {
        await tx.menuItemVariant.deleteMany({ where: { menuItemId: id } });
        if (variants.length) {
          await tx.menuItemVariant.createMany({
            data: variants.map((v) => ({ ...v, menuItemId: id })),
          });
        }
      }

      if (modifierGroups !== undefined) {
        await tx.modifierGroup.deleteMany({ where: { menuItemId: id } });
        for (const g of modifierGroups) {
          await tx.modifierGroup.create({
            data: {
              menuItemId: id,
              name: g.name,
              minSelect: g.minSelect ?? 0,
              maxSelect: g.maxSelect ?? 1,
              isRequired: g.isRequired ?? false,
              sortOrder: g.sortOrder ?? 0,
              modifiers: g.modifiers?.length
                ? { create: g.modifiers }
                : undefined,
            },
          });
        }
      }

      return tx.menuItem.update({
        where: { id },
        data: itemData,
        include: {
          variants: true,
          modifierGroups: { include: { modifiers: true } },
        },
      });
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'MenuItem',
      entityId: id,
      previousValue: existing as unknown as Record<string, unknown>,
      newValue: item as unknown as Record<string, unknown>,
    });
    return item;
  }

  async deleteMenuItem(organizationId: string, userId: string, id: string) {
    const existing = await this.getMenuItem(organizationId, id);
    const item = await this.prisma.client.menuItem.update({
      where: { id },
      data: { deletedAt: new Date(), isAvailable: false },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'DELETE',
      entityType: 'MenuItem',
      entityId: id,
      previousValue: existing as unknown as Record<string, unknown>,
    });
    return item;
  }

  // --- Kitchen Stations ---

  async listKitchenStations(outletId: string) {
    await this.ensureOutlet(outletId);
    return this.prisma.client.kitchenStation.findMany({
      where: { outletId },
      orderBy: { name: 'asc' },
    });
  }

  async createKitchenStation(
    organizationId: string,
    outletId: string,
    userId: string,
    dto: CreateKitchenStationDto,
  ) {
    await this.ensureOutlet(outletId, organizationId);
    const station = await this.prisma.client.kitchenStation.create({
      data: { outletId, ...dto },
    });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'CREATE',
      entityType: 'KitchenStation',
      entityId: station.id,
      newValue: station as unknown as Record<string, unknown>,
    });
    return station;
  }

  async updateKitchenStation(
    organizationId: string,
    outletId: string,
    userId: string,
    id: string,
    dto: UpdateKitchenStationDto,
  ) {
    await this.ensureKitchenStation(outletId, id, organizationId);
    const station = await this.prisma.client.kitchenStation.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'UPDATE',
      entityType: 'KitchenStation',
      entityId: id,
      newValue: station as unknown as Record<string, unknown>,
    });
    return station;
  }

  async deleteKitchenStation(
    organizationId: string,
    outletId: string,
    userId: string,
    id: string,
  ) {
    await this.ensureKitchenStation(outletId, id, organizationId);
    const station = await this.prisma.client.kitchenStation.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'DELETE',
      entityType: 'KitchenStation',
      entityId: id,
    });
    return station;
  }

  // --- Outlet Menu ---

  async getOutletMenu(outletId: string, organizationId?: string) {
    const outlet = await this.ensureOutlet(outletId, organizationId);
    const orgId = outlet.organizationId;

    const categories = await this.prisma.client.menuCategory.findMany({
      where: { organizationId: orgId, isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });

    const items = await this.prisma.client.menuItem.findMany({
      where: { organizationId: orgId, isAvailable: true, deletedAt: null },
      include: {
        variants: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        modifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
        },
        outletPrices: { where: { outletId } },
        taxGroup: { include: { taxRates: true } },
        kitchenStation: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    const menu = items.map((item) => {
      const outletPrice = item.outletPrices[0];
      const price = outletPrice?.price ?? item.basePrice;
      const isAvailable = outletPrice ? outletPrice.isAvailable : item.isAvailable;
      const { outletPrices, ...rest } = item;
      return { ...rest, price, isAvailable, outletPriceId: outletPrice?.id };
    });

    return {
      outletId,
      categories,
      items: menu,
    };
  }

  async upsertOutletPrice(
    organizationId: string,
    outletId: string,
    userId: string,
    dto: UpsertOutletPriceDto,
  ) {
    await this.ensureOutlet(outletId, organizationId);
    await this.getMenuItem(organizationId, dto.menuItemId);

    const price = await this.prisma.client.outletMenuPrice.upsert({
      where: {
        outletId_menuItemId: { outletId, menuItemId: dto.menuItemId },
      },
      create: {
        outletId,
        menuItemId: dto.menuItemId,
        price: dto.price,
        isAvailable: dto.isAvailable ?? true,
      },
      update: {
        price: dto.price,
        isAvailable: dto.isAvailable,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      outletId,
      action: 'UPSERT',
      entityType: 'OutletMenuPrice',
      entityId: price.id,
      newValue: price as unknown as Record<string, unknown>,
    });
    return price;
  }

  private async ensureOutlet(outletId: string, organizationId?: string) {
    const outlet = await this.prisma.client.outlet.findFirst({
      where: {
        id: outletId,
        deletedAt: null,
        ...(organizationId ? { organizationId } : {}),
      },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');
    return outlet;
  }

  private async ensureKitchenStation(
    outletId: string,
    id: string,
    organizationId?: string,
  ) {
    const station = await this.prisma.client.kitchenStation.findFirst({
      where: { id, outletId },
      include: { outlet: true },
    });
    if (!station) throw new NotFoundException('Kitchen station not found');
    if (organizationId && station.outlet.organizationId !== organizationId) {
      throw new BadRequestException('Kitchen station does not belong to organization');
    }
    return station;
  }
}
