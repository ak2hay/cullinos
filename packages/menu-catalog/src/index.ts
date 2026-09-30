import {
  CATALOG_SECTIONS,
  getBusinessTypeRules,
  getCatalogSectionVisibility,
  isBusinessType,
  type BusinessType,
  type CatalogSectionId,
  type CatalogVisibility,
} from '@cullinos/shared';
import { BAR_ITEMS } from './bar';
import { BEVERAGE_ITEMS } from './beverages';
import { FOOD_ITEMS } from './food';
import { STOCK_TEMPLATES } from './inventory-templates';
import { CATALOG_SUBCATEGORIES } from './sections';
import type { CatalogItem, CatalogSubCategory } from './types';

export * from './types';
export * from './sections';
export { STOCK_TEMPLATES, getStockTemplate, type StockTemplateKey } from './inventory-templates';

export const CATALOG_ITEMS: readonly CatalogItem[] = [...FOOD_ITEMS, ...BEVERAGE_ITEMS, ...BAR_ITEMS];

const ITEMS_BY_ID = new Map(CATALOG_ITEMS.map((item) => [item.id, item]));

export function getCatalogItem(id: string): CatalogItem | undefined {
  return ITEMS_BY_ID.get(id);
}

export interface CatalogFilterOptions {
  businessType: BusinessType | string | null | undefined;
  servesAlcohol?: boolean;
}

function resolveType(type: CatalogFilterOptions['businessType']): BusinessType {
  return isBusinessType(type) ? type : 'restaurant';
}

/** Visibility of a single item for this org, or 'hidden'. */
export function getCatalogItemVisibility(item: CatalogItem, options: CatalogFilterOptions): CatalogVisibility {
  const type = resolveType(options.businessType);
  const rules = getBusinessTypeRules(type);
  const visibility = getCatalogSectionVisibility(type, item.sectionId, {
    servesAlcohol: options.servesAlcohol,
  });
  if (visibility === 'hidden') return 'hidden';
  if (!rules.dineIn && item.serviceTags.includes('dine_in_only')) return 'hidden';
  if (!(rules.servingUnits as readonly string[]).includes(item.servingUnit)) return 'hidden';
  return visibility;
}

export function isCatalogItemAllowed(item: CatalogItem, options: CatalogFilterOptions): boolean {
  return getCatalogItemVisibility(item, options) !== 'hidden';
}

export interface CatalogSubCategoryView extends CatalogSubCategory {
  items: CatalogItem[];
}

export interface CatalogSectionView {
  id: CatalogSectionId;
  label: string;
  group: (typeof CATALOG_SECTIONS)[number]['group'];
  visibility: Exclude<CatalogVisibility, 'hidden'>;
  itemCount: number;
  subCategories: CatalogSubCategoryView[];
}

/** Sections (core first, then optional) with the items this business type may import. */
export function getCatalog(options: CatalogFilterOptions): { sections: CatalogSectionView[] } {
  const sections: CatalogSectionView[] = [];
  for (const section of CATALOG_SECTIONS) {
    const items = CATALOG_ITEMS.filter((i) => i.sectionId === section.id);
    const allowed = items.filter((i) => isCatalogItemAllowed(i, options));
    if (!allowed.length) continue;
    const visibility = getCatalogSectionVisibility(resolveType(options.businessType), section.id, {
      servesAlcohol: options.servesAlcohol,
    });
    if (visibility === 'hidden') continue;
    const subCategories = CATALOG_SUBCATEGORIES[section.id]
      .map((sub) => ({ ...sub, items: allowed.filter((i) => i.subCategoryId === sub.id) }))
      .filter((sub) => sub.items.length > 0);
    sections.push({
      id: section.id,
      label: section.label,
      group: section.group,
      visibility,
      itemCount: allowed.length,
      subCategories,
    });
  }
  sections.sort((a, b) => (a.visibility === b.visibility ? 0 : a.visibility === 'core' ? -1 : 1));
  return { sections };
}

/** Case-insensitive substring search over name, section and sub-category. */
export function searchCatalog(items: readonly CatalogItem[], query: string): CatalogItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...items];
  return items.filter((i) => {
    const sub = CATALOG_SUBCATEGORIES[i.sectionId].find((s) => s.id === i.subCategoryId)?.label ?? '';
    return `${i.name} ${i.sectionId} ${sub}`.toLowerCase().includes(q);
  });
}

/** Middle of the suggested range, rounded to the nearest ₹10 (₹5 under ₹100). */
export function suggestedDefaultPrice(item: Pick<CatalogItem, 'suggestedPrice'>): number {
  const mid = (item.suggestedPrice.min + item.suggestedPrice.max) / 2;
  const step = mid < 100 ? 5 : 10;
  return Math.max(step, Math.round(mid / step) * step);
}

/** Variant price in rupees from the base price and the variant's price factor. */
export function variantPrice(basePrice: number, priceFactor: number): number {
  const raw = basePrice * priceFactor;
  const step = raw < 100 ? 5 : 10;
  return Math.max(step, Math.round(raw / step) * step);
}

/** Structural problems in the catalog data (empty when valid). */
export function validateCatalog(items: readonly CatalogItem[] = CATALOG_ITEMS): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const sectionIds = new Set<string>(CATALOG_SECTIONS.map((s) => s.id));
  for (const item of items) {
    if (seen.has(item.id)) errors.push(`duplicate id ${item.id}`);
    seen.add(item.id);
    if (!item.name.trim()) errors.push(`${item.id}: empty name`);
    if (!sectionIds.has(item.sectionId)) errors.push(`${item.id}: unknown section ${item.sectionId}`);
    const subs = CATALOG_SUBCATEGORIES[item.sectionId] ?? [];
    if (!subs.some((s) => s.id === item.subCategoryId)) {
      errors.push(`${item.id}: unknown sub-category ${item.subCategoryId}`);
    }
    const { min, max } = item.suggestedPrice;
    if (!(min > 0) || !(max >= min)) errors.push(`${item.id}: bad price range ${min}-${max}`);
    for (const line of item.stock) {
      if (!(line.perServe > 0)) errors.push(`${item.id}: stock ${line.templateKey} perServe must be > 0`);
      if (line.templateKey === 'self') {
        if (!item.selfStock) errors.push(`${item.id}: self stock without selfStock spec`);
      } else if (!STOCK_TEMPLATES[line.templateKey]) {
        errors.push(`${item.id}: unknown stock template ${line.templateKey}`);
      }
    }
    for (const v of item.variants) {
      if (!v.name.trim() || !(v.stockMultiplier > 0) || !(v.priceFactor > 0)) {
        errors.push(`${item.id}: bad variant ${v.name}`);
      }
    }
    if (new Set(item.variants.map((v) => v.name)).size !== item.variants.length) {
      errors.push(`${item.id}: duplicate variant names`);
    }
  }
  return errors;
}
