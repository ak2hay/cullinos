import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CATALOG_SECTIONS,
  orgServesAlcohol,
  type BusinessType,
  type CatalogSectionId,
} from "@cullinos/shared";
import {
  CATALOG_SUBCATEGORIES,
  STOCK_TEMPLATES,
  getCatalog,
  getCatalogItem,
  isCatalogItemAllowed,
  suggestedDefaultPrice,
  variantPrice,
  type CatalogItem,
  type CatalogStockLine,
} from "@cullinos/menu-catalog";
import { PrismaService } from "../../prisma/prisma.service";
import { toPaise, toRupees } from "../../common/money.util";
import { normalizePublicAssetUrl } from "../../common/public-asset-url.util";
import { BAR_STATION } from "../../common/kitchen-stations.util";

export const CATALOG_IMPORT_MAX_ITEMS = 300;

const SECTION_BY_ID = new Map(CATALOG_SECTIONS.map((s, index) => [s.id, { ...s, index }]));

export interface CatalogImportVariantInput {
  name: string;
  /** Paise. */
  price: number;
  stockMultiplier?: number;
}

export interface CatalogImportItemInput {
  catalogItemId: string;
  name?: string;
  /** Base price in paise; defaults to the catalog's suggested price. */
  price?: number;
  isVeg?: boolean;
  variants?: CatalogImportVariantInput[];
  trackStock?: boolean;
}

export interface CatalogStockComponent {
  key: string;
  name: string;
  unit: string;
  perServe: number;
  packLabel: string | null;
  packSize: number | null;
}

type Tx = Prisma.TransactionClient;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Inventory rows a catalog item deducts from; "self" lines become a per-item row. */
export function stockComponentsFor(item: CatalogItem): CatalogStockComponent[] {
  const out: CatalogStockComponent[] = [];
  for (const line of item.stock) {
    const component = stockComponent(item, line);
    if (component) out.push(component);
  }
  return out;
}

function stockComponent(item: CatalogItem, line: CatalogStockLine): CatalogStockComponent | null {
  if (line.templateKey === "self") {
    if (!item.selfStock) return null;
    return {
      key: `item:${item.id}`,
      name: item.name,
      unit: item.selfStock.unit,
      perServe: line.perServe,
      packLabel: item.selfStock.packLabel ?? null,
      packSize: item.selfStock.packSize ?? null,
    };
  }
  const template = STOCK_TEMPLATES[line.templateKey];
  if (!template) return null;
  return {
    key: template.key,
    name: template.name,
    unit: template.unit,
    perServe: line.perServe,
    packLabel: template.packLabel ?? null,
    packSize: template.packSize ?? null,
  };
}

function importCategoryFor(item: CatalogItem) {
  const section = SECTION_BY_ID.get(item.sectionId);
  const subs = CATALOG_SUBCATEGORIES[item.sectionId] ?? [];
  const subIndex = subs.findIndex((s) => s.id === item.subCategoryId);
  const sub = subs[subIndex];
  const sectionLabel = section?.label ?? item.sectionId;
  return {
    slug: `catalog-${slugify(item.sectionId)}-${slugify(item.subCategoryId)}`,
    name: sub ? `${sectionLabel} · ${sub.label}` : sectionLabel,
    sortOrder: (section?.index ?? 99) * 100 + Math.max(0, subIndex) + 1,
    isAlcohol: section?.group === "alcohol",
  };
}

function cleanName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, 120);
  return trimmed || fallback;
}

function paiseOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
    throw new BadRequestException("Invalid price");
  }
  return Math.round(n);
}

function resolveVariants(
  item: CatalogItem,
  basePriceRupees: number,
  input: CatalogImportVariantInput[] | undefined,
): Array<{ name: string; price: number; stockMultiplier: number }> {
  if (Array.isArray(input)) {
    if (input.length > 20) throw new BadRequestException("Too many variants");
    const seen = new Set<string>();
    return input.map((v) => {
      const name = cleanName(v?.name, "");
      if (!name) throw new BadRequestException("Variant name is required");
      if (seen.has(name.toLowerCase())) {
        throw new BadRequestException(`Duplicate variant "${name}"`);
      }
      seen.add(name.toLowerCase());
      const price = paiseOrNull(v.price);
      if (price == null) throw new BadRequestException(`Variant "${name}" needs a price`);
      const multiplier = v.stockMultiplier == null ? 1 : Number(v.stockMultiplier);
      if (!Number.isFinite(multiplier) || multiplier < 0.001 || multiplier > 1000) {
        throw new BadRequestException(`Variant "${name}" has an invalid stock multiplier`);
      }
      return { name, price: toRupees(price), stockMultiplier: multiplier };
    });
  }
  return item.variants.map((v) => ({
    name: v.name,
    price: v.priceFactor === 1 ? basePriceRupees : variantPrice(basePriceRupees, v.priceFactor),
    stockMultiplier: v.stockMultiplier,
  }));
}

@Injectable()
export class MenuCatalogService {
  constructor(private prisma: PrismaService) {}

  private async orgContext(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { businessType: true, settings: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    const settings =
      org.settings && typeof org.settings === "object" && !Array.isArray(org.settings)
        ? (org.settings as Record<string, unknown>)
        : {};
    const businessType = org.businessType as BusinessType;
    return {
      businessType,
      settings,
      servesAlcohol: orgServesAlcohol(businessType, settings),
    };
  }

  async getCatalog(orgId: string) {
    const ctx = await this.orgContext(orgId);
    const imported = await this.prisma.menuItem.findMany({
      where: { organizationId: orgId, catalogItemId: { not: null } },
      select: { catalogItemId: true },
    });
    const importedIds = new Set(imported.map((i) => i.catalogItemId as string));
    const { sections } = getCatalog({
      businessType: ctx.businessType,
      servesAlcohol: ctx.servesAlcohol,
    });
    return {
      businessType: ctx.businessType,
      servesAlcohol: ctx.servesAlcohol,
      importedItemIds: [...importedIds],
      sections: sections.map((section) => ({
        id: section.id,
        label: section.label,
        group: section.group,
        visibility: section.visibility,
        itemCount: section.itemCount,
        subCategories: section.subCategories.map((sub) => ({
          id: sub.id,
          label: sub.label,
          items: sub.items.map((item) => {
            const base = suggestedDefaultPrice(item);
            return {
              id: item.id,
              name: item.name,
              description: item.description ?? null,
              isVeg: item.isVeg,
              productType: item.productType,
              servingUnit: item.servingUnit,
              serviceTags: item.serviceTags,
              defaultPrice: toPaise(base),
              priceRange: {
                min: toPaise(item.suggestedPrice.min),
                max: toPaise(item.suggestedPrice.max),
              },
              variants: item.variants.map((v) => ({
                name: v.name,
                price: toPaise(v.priceFactor === 1 ? base : variantPrice(base, v.priceFactor)),
                stockMultiplier: v.stockMultiplier,
                priceFactor: v.priceFactor,
              })),
              stock: stockComponentsFor(item),
              imageUrl: normalizePublicAssetUrl(item.placeholder),
              imported: importedIds.has(item.id),
            };
          }),
        })),
      })),
    };
  }

  async importItems(orgId: string, body: { items?: unknown }) {
    const rawItems = Array.isArray(body?.items) ? (body.items as CatalogImportItemInput[]) : null;
    if (!rawItems?.length) throw new BadRequestException("Select at least one item");
    if (rawItems.length > CATALOG_IMPORT_MAX_ITEMS) {
      throw new BadRequestException(`Import at most ${CATALOG_IMPORT_MAX_ITEMS} items at a time`);
    }

    const ctx = await this.orgContext(orgId);
    const filter = { businessType: ctx.businessType, servesAlcohol: ctx.servesAlcohol };

    const requested = new Map<string, { input: CatalogImportItemInput; item: CatalogItem }>();
    for (const input of rawItems) {
      const id = typeof input?.catalogItemId === "string" ? input.catalogItemId : "";
      const item = getCatalogItem(id);
      if (!item) throw new BadRequestException(`Unknown catalog item "${id}"`);
      if (!isCatalogItemAllowed(item, filter)) {
        throw new BadRequestException(`"${item.name}" is not available for this business type`);
      }
      if (!requested.has(id)) requested.set(id, { input, item });
    }

    const warnings: string[] = [];
    const taxGroups = await this.resolveTaxGroups(orgId, ctx.settings);
    const needsAlcoholTax = [...requested.values()].some(
      ({ item }) => SECTION_BY_ID.get(item.sectionId)?.group === "alcohol",
    );
    if (needsAlcoholTax && !taxGroups.alcohol) {
      warnings.push(
        "No excise-only tax group found — alcohol items were imported without a tax group. Add one under Settings → Tax.",
      );
    }
    const hasBarStation =
      needsAlcoholTax &&
      (await this.prisma.kitchenStation.count({
        where: { code: BAR_STATION.code, outlet: { organizationId: orgId } },
      })) > 0;

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.menuItem.findMany({
          where: { organizationId: orgId, catalogItemId: { in: [...requested.keys()] } },
          select: { catalogItemId: true },
        });
        const alreadyImported = new Set(existing.map((e) => e.catalogItemId as string));
        const usedSlugs = new Set(
          (
            await tx.menuItem.findMany({
              where: { organizationId: orgId },
              select: { slug: true },
            })
          ).map((i) => i.slug),
        );

        const categoryIds = new Map<string, string>();
        const inventoryIds = new Map<string, string>();
        const created: Array<{ catalogItemId: string; menuItemId: string; name: string }> = [];
        const skipped: Array<{ catalogItemId: string; reason: string }> = [];
        let inventoryCreated = 0;
        let recipesCreated = 0;

        for (const [catalogItemId, { input, item }] of requested) {
          if (alreadyImported.has(catalogItemId)) {
            skipped.push({ catalogItemId, reason: "already_imported" });
            continue;
          }
          const category = importCategoryFor(item);
          const categoryId = await this.ensureCategory(tx, orgId, category, hasBarStation, categoryIds);

          const name = cleanName(input.name, item.name);
          const pricePaise = paiseOrNull(input.price) ?? toPaise(suggestedDefaultPrice(item));
          const basePrice = toRupees(pricePaise);
          const variants = resolveVariants(item, basePrice, input.variants);

          const menuItem = await tx.menuItem.create({
            data: {
              organizationId: orgId,
              categoryId,
              name,
              slug: uniqueSlug(slugify(name) || slugify(item.id), item.sectionId, usedSlugs),
              description: item.description,
              imageUrl: item.placeholder,
              basePrice,
              isVeg: typeof input.isVeg === "boolean" ? input.isVeg : item.isVeg,
              productType: item.productType,
              taxGroupId: category.isAlcohol ? taxGroups.alcohol : taxGroups.food,
              catalogItemId,
              ...(variants.length
                ? {
                    variants: {
                      create: variants.map((v, index) => ({
                        name: v.name,
                        price: v.price,
                        isDefault: index === 0,
                        sortOrder: index,
                        stockMultiplier: v.stockMultiplier,
                      })),
                    },
                  }
                : {}),
            },
            select: { id: true, name: true },
          });
          created.push({ catalogItemId, menuItemId: menuItem.id, name: menuItem.name });

          if (input.trackStock === false) continue;
          const components = stockComponentsFor(item);
          if (!components.length) continue;

          const ingredients: Array<{ inventoryItemId: string; quantity: number }> = [];
          for (const component of components) {
            const result = await this.ensureInventoryItem(tx, orgId, component, inventoryIds);
            if (result.created) inventoryCreated += 1;
            ingredients.push({ inventoryItemId: result.id, quantity: component.perServe });
          }
          await tx.recipe.create({
            data: {
              menuItemId: menuItem.id,
              yield: 1,
              ingredients: { create: ingredients },
            },
          });
          recipesCreated += 1;
        }

        return { created, skipped, inventoryCreated, recipesCreated, warnings };
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }

  private async resolveTaxGroups(orgId: string, settings: Record<string, unknown>) {
    const groups = await this.prisma.taxGroup.findMany({
      where: { organizationId: orgId },
      select: { id: true, rates: { select: { type: true } } },
    });
    const defaultId =
      typeof settings.defaultTaxGroupId === "string" ? settings.defaultTaxGroupId : null;
    const food = defaultId && groups.some((g) => g.id === defaultId) ? defaultId : null;
    const alcohol =
      groups.find(
        (g) => g.rates.length > 0 && g.rates.every((r) => r.type.toUpperCase() === "EXCISE"),
      )?.id ?? null;
    return { food, alcohol };
  }

  private async ensureCategory(
    tx: Tx,
    orgId: string,
    category: ReturnType<typeof importCategoryFor>,
    hasBarStation: boolean,
    cache: Map<string, string>,
  ): Promise<string> {
    const cached = cache.get(category.slug);
    if (cached) return cached;
    const found = await tx.menuCategory.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug: category.slug } },
      select: { id: true, isActive: true },
    });
    let id: string;
    if (found) {
      id = found.id;
      if (!found.isActive) {
        await tx.menuCategory.update({ where: { id }, data: { isActive: true } });
      }
    } else {
      const row = await tx.menuCategory.create({
        data: {
          organizationId: orgId,
          name: category.name,
          slug: category.slug,
          sortOrder: category.sortOrder,
          kitchenStationCode: category.isAlcohol && hasBarStation ? BAR_STATION.code : null,
        },
        select: { id: true },
      });
      id = row.id;
    }
    cache.set(category.slug, id);
    return id;
  }

  private async ensureInventoryItem(
    tx: Tx,
    orgId: string,
    component: CatalogStockComponent,
    cache: Map<string, string>,
  ): Promise<{ id: string; created: boolean }> {
    const cached = cache.get(component.key);
    if (cached) return { id: cached, created: false };
    const found = await tx.inventoryItem.findFirst({
      where: { organizationId: orgId, outletId: null, catalogKey: component.key },
      select: { id: true },
    });
    if (found) {
      cache.set(component.key, found.id);
      return { id: found.id, created: false };
    }
    const row = await tx.inventoryItem.create({
      data: {
        organizationId: orgId,
        outletId: null,
        name: component.name,
        unit: component.unit,
        catalogKey: component.key,
        packLabel: component.packLabel,
        packSize: component.packSize,
      },
      select: { id: true },
    });
    cache.set(component.key, row.id);
    return { id: row.id, created: true };
  }
}

function uniqueSlug(base: string, sectionId: CatalogSectionId, used: Set<string>): string {
  let slug = base;
  if (used.has(slug)) slug = `${base}-${slugify(sectionId)}`;
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${slugify(sectionId)}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}
