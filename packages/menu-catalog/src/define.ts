import type { CatalogSectionId, ServingUnit } from '@cullinos/shared';
import type {
  CatalogItem,
  CatalogProductType,
  CatalogServiceTag,
  CatalogStockLine,
  CatalogVariant,
  SelfStockSpec,
} from './types';

/** v = veg, n = non-veg, e = egg (listed as non-veg). */
export type Veg = 'v' | 'n' | 'e';

export interface RowExtra {
  variants?: readonly CatalogVariant[];
  tags?: readonly CatalogServiceTag[];
  desc?: string;
  unit?: ServingUnit;
  productType?: CatalogProductType;
}

/**
 * [name, veg, minPrice, maxPrice, stock?, extra?]
 * stock: space-separated "templateKey:perServe" pairs; "" = none; omitted = group default.
 */
export type Row = readonly [string, Veg, number, number, string?, RowExtra?];

export interface GroupDefaults {
  productType?: CatalogProductType;
  variants?: readonly CatalogVariant[];
  stock?: string;
  tags?: readonly CatalogServiceTag[];
  unit?: ServingUnit;
  selfStock?: SelfStockSpec;
}

export const HALF_FULL: readonly CatalogVariant[] = [
  { name: 'Half', stockMultiplier: 0.5, priceFactor: 0.6 },
  { name: 'Full', stockMultiplier: 1, priceFactor: 1 },
];

export const REG_LARGE: readonly CatalogVariant[] = [
  { name: 'Regular', stockMultiplier: 1, priceFactor: 1 },
  { name: 'Large', stockMultiplier: 1.5, priceFactor: 1.35 },
];

export const PIZZA_SIZES: readonly CatalogVariant[] = [
  { name: 'Regular 7"', stockMultiplier: 1, priceFactor: 1 },
  { name: 'Medium 10"', stockMultiplier: 1.8, priceFactor: 1.7 },
  { name: 'Large 12"', stockMultiplier: 2.6, priceFactor: 2.3 },
];

export const PLATE_KG: readonly CatalogVariant[] = [
  { name: 'Per plate', stockMultiplier: 1, priceFactor: 1 },
];

export const CAKE_WEIGHTS: readonly CatalogVariant[] = [
  { name: '0.5 kg', stockMultiplier: 0.5, priceFactor: 0.55 },
  { name: '1 kg', stockMultiplier: 1, priceFactor: 1 },
  { name: '2 kg', stockMultiplier: 2, priceFactor: 1.9 },
];

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function parseStock(spec: string): CatalogStockLine[] {
  return spec
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => {
      const [templateKey, qty] = pair.split(':');
      return { templateKey, perServe: Number(qty) };
    });
}

export function placeholderFor(sectionId: CatalogSectionId): string {
  return `/catalog-placeholders/${sectionId}.webp`;
}

export function group(
  sectionId: CatalogSectionId,
  subCategoryId: string,
  defaults: GroupDefaults,
  rows: readonly Row[],
): CatalogItem[] {
  return rows.map(([name, veg, min, max, stock, extra]) => {
    const tags = [...(defaults.tags ?? []), ...(extra?.tags ?? [])];
    const item: CatalogItem = {
      id: `${sectionId}.${slugify(name)}`,
      name,
      sectionId,
      subCategoryId,
      isVeg: veg === 'v',
      productType: extra?.productType ?? defaults.productType ?? 'other',
      suggestedPrice: { min, max },
      variants: [...(extra?.variants ?? defaults.variants ?? [])],
      stock: parseStock(stock ?? defaults.stock ?? ''),
      serviceTags: [...new Set(tags)],
      servingUnit: extra?.unit ?? defaults.unit ?? 'serve',
      placeholder: placeholderFor(sectionId),
    };
    if (extra?.desc) item.description = extra.desc;
    if (defaults.selfStock) item.selfStock = { ...defaults.selfStock };
    return item;
  });
}

/** Branded bottled products that stock themselves (soft drinks, liquor, beer). */
export type BrandRow = readonly [string, number, number];

export function brands(
  sectionId: CatalogSectionId,
  subCategoryId: string,
  defaults: GroupDefaults & { selfStock: SelfStockSpec; perServe: number; veg?: boolean },
  rows: readonly BrandRow[],
): CatalogItem[] {
  return rows.map(([name, min, max]) => ({
    id: `${sectionId}.${slugify(name)}`,
    name,
    sectionId,
    subCategoryId,
    isVeg: defaults.veg ?? true,
    productType: defaults.productType ?? 'other',
    suggestedPrice: { min, max },
    variants: [...(defaults.variants ?? [])],
    stock: [{ templateKey: 'self', perServe: defaults.perServe }],
    selfStock: { ...defaults.selfStock },
    serviceTags: [...(defaults.tags ?? [])],
    servingUnit: defaults.unit ?? 'serve',
    placeholder: placeholderFor(sectionId),
  }));
}
