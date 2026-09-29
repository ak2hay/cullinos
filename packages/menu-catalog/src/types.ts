import type { CatalogSectionId, ServingUnit } from '@cullinos/shared';

/** Mirrors MENU_PRODUCT_TYPES in apps/api/src/modules/menu/product-types.ts. */
export type CatalogProductType =
  | 'other'
  | 'tea_coffee'
  | 'juice_shake'
  | 'cold_drink'
  | 'packaged_water'
  | 'pizza'
  | 'burger_sandwich'
  | 'main_course'
  | 'biryani_rice'
  | 'dessert'
  | 'alcohol';

export type CatalogServiceTag = 'dine_in_only' | 'delivery_friendly' | 'live_counter';

export type StockUnit = 'g' | 'mL' | 'pieces';

export interface CatalogVariant {
  name: string;
  /** Multiplies the recipe (Half = 0.5, 60 mL on a 30 mL recipe = 2). */
  stockMultiplier: number;
  /** Multiplies the suggested base price. */
  priceFactor: number;
}

export interface CatalogStockLine {
  /** Key in STOCK_TEMPLATES, or "self" for a per-item stock row (bottled drinks, liquor brands). */
  templateKey: string;
  /** Base units consumed by one serve (one unit of the base variant). */
  perServe: number;
}

/** Per-item stock definition used when a stock line's templateKey is "self". */
export interface SelfStockSpec {
  unit: StockUnit;
  packLabel?: string;
  packSize?: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  sectionId: CatalogSectionId;
  subCategoryId: string;
  isVeg: boolean;
  productType: CatalogProductType;
  description?: string;
  /** Suggested price range in rupees for the base variant. */
  suggestedPrice: { min: number; max: number };
  variants: CatalogVariant[];
  stock: CatalogStockLine[];
  selfStock?: SelfStockSpec;
  serviceTags: CatalogServiceTag[];
  servingUnit: ServingUnit;
  /** Public path of the section placeholder image, e.g. /catalog-placeholders/pizza.webp */
  placeholder: string;
}

export interface StockTemplate {
  key: string;
  name: string;
  unit: StockUnit;
  packLabel?: string;
  packSize?: number;
}

export interface CatalogSubCategory {
  id: string;
  label: string;
}
