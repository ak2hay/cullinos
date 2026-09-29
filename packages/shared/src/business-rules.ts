import { BUSINESS_TYPE_DEFAULTS, BUSINESS_TYPES, type BusinessType } from './business-types';

/**
 * Top-level universal-catalog sections. Catalog data (packages/menu-catalog)
 * tags every item with one of these ids; business-type rules pick which
 * sections each kind of business sees.
 */
export const CATALOG_SECTIONS = [
  // Indian
  { id: 'indian_starters', label: 'Indian Starters', group: 'food' },
  { id: 'tandoor', label: 'Tandoor & Kebabs', group: 'food' },
  { id: 'indian_main_course', label: 'Indian Main Course', group: 'food' },
  { id: 'indian_breads', label: 'Indian Breads', group: 'food' },
  { id: 'rice_biryani', label: 'Rice, Biryani & Bowls', group: 'food' },
  { id: 'thalis_combos', label: 'Thalis & Meal Boxes', group: 'food' },
  { id: 'south_indian', label: 'South Indian', group: 'food' },
  { id: 'chaat_street', label: 'Chaat & Street Food', group: 'food' },
  // Asian
  { id: 'indo_chinese', label: 'Indo-Chinese', group: 'food' },
  { id: 'momos', label: 'Momos & Dim Sum', group: 'food' },
  { id: 'thai_asian', label: 'Thai & Pan-Asian', group: 'food' },
  { id: 'japanese', label: 'Japanese & Sushi', group: 'food' },
  // Fast food / international
  { id: 'rolls_wraps', label: 'Rolls & Wraps', group: 'food' },
  { id: 'burgers', label: 'Burgers', group: 'food' },
  { id: 'sandwiches', label: 'Sandwiches', group: 'food' },
  { id: 'pizza', label: 'Pizza', group: 'food' },
  { id: 'pasta', label: 'Pasta', group: 'food' },
  { id: 'fried_chicken', label: 'Fried Chicken & Wings', group: 'food' },
  { id: 'fries_sides', label: 'Fries & Sides', group: 'food' },
  { id: 'continental', label: 'Continental', group: 'food' },
  { id: 'mexican', label: 'Mexican', group: 'food' },
  { id: 'soups_salads', label: 'Soups & Salads', group: 'food' },
  { id: 'breakfast', label: 'Breakfast & All-Day', group: 'food' },
  { id: 'quick_bites', label: 'Maggi & Quick Bites', group: 'food' },
  { id: 'bar_snacks', label: 'Bar Snacks', group: 'food' },
  // Bakery & dessert
  { id: 'bakery_breads', label: 'Bakery Breads & Buns', group: 'food' },
  { id: 'cakes_pastries', label: 'Cakes & Pastries', group: 'food' },
  { id: 'cookies_savouries', label: 'Cookies, Puffs & Savouries', group: 'food' },
  { id: 'desserts', label: 'Desserts & Ice Cream', group: 'food' },
  // Catering
  { id: 'catering_packages', label: 'Catering Packages', group: 'food' },
  { id: 'live_counters', label: 'Live Counters', group: 'food' },
  // Beverages
  { id: 'hot_beverages', label: 'Tea & Coffee', group: 'beverage' },
  { id: 'cold_coffee_shakes', label: 'Cold Coffee & Shakes', group: 'beverage' },
  { id: 'juices_smoothies', label: 'Juices & Smoothies', group: 'beverage' },
  { id: 'mocktails', label: 'Mocktails', group: 'beverage' },
  { id: 'soft_drinks', label: 'Soft Drinks & Water', group: 'beverage' },
  // Alcohol
  { id: 'whisky', label: 'Whisky', group: 'alcohol' },
  { id: 'vodka', label: 'Vodka', group: 'alcohol' },
  { id: 'rum', label: 'Rum', group: 'alcohol' },
  { id: 'gin', label: 'Gin', group: 'alcohol' },
  { id: 'tequila', label: 'Tequila', group: 'alcohol' },
  { id: 'brandy', label: 'Brandy & Cognac', group: 'alcohol' },
  { id: 'liqueur', label: 'Liqueurs', group: 'alcohol' },
  { id: 'wine', label: 'Wine', group: 'alcohol' },
  { id: 'beer', label: 'Beer', group: 'alcohol' },
  { id: 'rtd', label: 'Breezers & Ready-to-Drink', group: 'alcohol' },
  { id: 'cocktails', label: 'Cocktails', group: 'alcohol' },
] as const;

export type CatalogSectionId = (typeof CATALOG_SECTIONS)[number]['id'];
export type CatalogSectionGroup = (typeof CATALOG_SECTIONS)[number]['group'];

export const CATALOG_SECTION_IDS: readonly CatalogSectionId[] = CATALOG_SECTIONS.map((s) => s.id);

export const ALCOHOL_SECTION_IDS: readonly CatalogSectionId[] = CATALOG_SECTIONS.filter(
  (s) => s.group === 'alcohol',
).map((s) => s.id);

export function isAlcoholSection(id: string): boolean {
  return (ALCOHOL_SECTION_IDS as readonly string[]).includes(id);
}

export function getCatalogSectionLabel(id: string): string {
  return CATALOG_SECTIONS.find((s) => s.id === id)?.label ?? id;
}

export const ORDER_TYPES = [
  'dine_in',
  'takeaway',
  'delivery',
  'qr',
  'online',
  'room_service',
  'banquet',
] as const;
export type OrderTypeValue = (typeof ORDER_TYPES)[number];

export type ServingUnit = 'serve' | 'plate' | 'kg' | 'piece';

export interface BusinessTypeRules {
  catalog: {
    /** Shown expanded and preselectable during onboarding. */
    core: readonly CatalogSectionId[];
    /** Behind "More categories". Anything not in core/optional is hidden. */
    optional: readonly CatalogSectionId[];
  };
  /** Upper bound of order types the owner may enable in Settings. */
  allowedOrderTypes: readonly OrderTypeValue[];
  /** Guests may eat on premises (counter "Eat in" or table service). */
  dineIn: boolean;
  /** Table management, table QR sessions, and orders tied to a table. */
  tables: boolean;
  /** Whether the "Serves alcohol" switch is offered. */
  alcoholToggle: boolean;
  /** Alcohol is always on (bar). */
  alcoholAlwaysOn: boolean;
  servingUnits: readonly ServingUnit[];
}

const NON_ALCOHOLIC_BEVERAGES: CatalogSectionId[] = [
  'hot_beverages',
  'cold_coffee_shakes',
  'juices_smoothies',
  'mocktails',
  'soft_drinks',
];

export const BUSINESS_TYPE_RULES: Record<BusinessType, BusinessTypeRules> = {
  restaurant: {
    catalog: {
      core: [
        'indian_starters',
        'indian_main_course',
        'tandoor',
        'indian_breads',
        'rice_biryani',
        'thalis_combos',
        'south_indian',
        'indo_chinese',
        'soups_salads',
        'desserts',
        ...NON_ALCOHOLIC_BEVERAGES,
      ],
      optional: [
        'continental',
        'pasta',
        'pizza',
        'mexican',
        'thai_asian',
        'japanese',
        'momos',
        'rolls_wraps',
        'burgers',
        'sandwiches',
        'fries_sides',
        'chaat_street',
        'breakfast',
        'cakes_pastries',
        'bar_snacks',
      ],
    },
    // Hotel restaurants (Hospitality plan) also take room-service and banquet orders.
    allowedOrderTypes: ['dine_in', 'takeaway', 'delivery', 'qr', 'online', 'room_service', 'banquet'],
    dineIn: true,
    tables: true,
    alcoholToggle: true,
    alcoholAlwaysOn: false,
    servingUnits: ['serve', 'plate', 'piece'],
  },
  cafe: {
    catalog: {
      core: [
        'hot_beverages',
        'cold_coffee_shakes',
        'juices_smoothies',
        'mocktails',
        'soft_drinks',
        'sandwiches',
        'burgers',
        'rolls_wraps',
        'pasta',
        'pizza',
        'fries_sides',
        'breakfast',
        'cakes_pastries',
        'cookies_savouries',
        'desserts',
        'soups_salads',
      ],
      optional: ['momos', 'quick_bites', 'chaat_street', 'mexican', 'south_indian', 'continental'],
    },
    allowedOrderTypes: ['dine_in', 'takeaway', 'delivery', 'qr', 'online'],
    dineIn: true,
    tables: true,
    alcoholToggle: true,
    alcoholAlwaysOn: false,
    servingUnits: ['serve', 'piece'],
  },
  food_truck: {
    catalog: {
      core: [
        'burgers',
        'sandwiches',
        'rolls_wraps',
        'momos',
        'chaat_street',
        'fries_sides',
        'indo_chinese',
        'pizza',
        'quick_bites',
        'soft_drinks',
        'cold_coffee_shakes',
        'hot_beverages',
      ],
      optional: ['south_indian', 'mexican', 'rice_biryani', 'desserts', 'fried_chicken', 'juices_smoothies'],
    },
    allowedOrderTypes: ['takeaway', 'qr', 'online'],
    dineIn: false,
    tables: false,
    alcoholToggle: false,
    alcoholAlwaysOn: false,
    servingUnits: ['serve', 'piece'],
  },
  bakery: {
    catalog: {
      core: ['bakery_breads', 'cakes_pastries', 'cookies_savouries', 'desserts', 'hot_beverages'],
      optional: ['sandwiches', 'pizza', 'cold_coffee_shakes', 'soft_drinks', 'juices_smoothies'],
    },
    allowedOrderTypes: ['dine_in', 'takeaway', 'delivery', 'qr', 'online'],
    dineIn: true,
    tables: false,
    alcoholToggle: false,
    alcoholAlwaysOn: false,
    servingUnits: ['piece', 'kg', 'serve'],
  },
  qsr: {
    catalog: {
      core: [
        'burgers',
        'pizza',
        'sandwiches',
        'rolls_wraps',
        'fries_sides',
        'fried_chicken',
        'pasta',
        'momos',
        'indo_chinese',
        'rice_biryani',
        'soft_drinks',
        'cold_coffee_shakes',
        'desserts',
      ],
      optional: ['mexican', 'south_indian', 'chaat_street', 'soups_salads', 'hot_beverages', 'juices_smoothies', 'mocktails'],
    },
    allowedOrderTypes: ['dine_in', 'takeaway', 'delivery', 'qr', 'online'],
    dineIn: true,
    tables: false,
    alcoholToggle: false,
    alcoholAlwaysOn: false,
    servingUnits: ['serve', 'piece'],
  },
  cloud_kitchen: {
    catalog: {
      core: [
        'rice_biryani',
        'indian_main_course',
        'indian_breads',
        'indo_chinese',
        'rolls_wraps',
        'burgers',
        'pizza',
        'pasta',
        'momos',
        'thalis_combos',
        'desserts',
        'soft_drinks',
      ],
      optional: [
        'indian_starters',
        'tandoor',
        'south_indian',
        'continental',
        'thai_asian',
        'chaat_street',
        'fried_chicken',
        'fries_sides',
        'sandwiches',
        'soups_salads',
        'hot_beverages',
        'cold_coffee_shakes',
      ],
    },
    allowedOrderTypes: ['delivery', 'online', 'takeaway'],
    dineIn: false,
    tables: false,
    alcoholToggle: false,
    alcoholAlwaysOn: false,
    servingUnits: ['serve', 'piece', 'plate'],
  },
  catering: {
    catalog: {
      core: [
        'catering_packages',
        'indian_starters',
        'indian_main_course',
        'indian_breads',
        'rice_biryani',
        'desserts',
        'live_counters',
        'mocktails',
        'juices_smoothies',
      ],
      optional: ['indo_chinese', 'continental', 'tandoor', 'south_indian', 'chaat_street', 'pasta', 'soups_salads', 'hot_beverages', 'soft_drinks'],
    },
    allowedOrderTypes: ['takeaway', 'online', 'delivery', 'banquet'],
    dineIn: false,
    tables: false,
    alcoholToggle: false,
    alcoholAlwaysOn: false,
    servingUnits: ['plate', 'kg', 'piece', 'serve'],
  },
  bar: {
    catalog: {
      core: [
        ...ALCOHOL_SECTION_IDS,
        'mocktails',
        'soft_drinks',
        'bar_snacks',
        'indian_starters',
        'tandoor',
        'indo_chinese',
        'fries_sides',
      ],
      optional: [
        'indian_main_course',
        'indian_breads',
        'rice_biryani',
        'pizza',
        'burgers',
        'continental',
        'momos',
        'fried_chicken',
        'sandwiches',
        'pasta',
        'juices_smoothies',
        'hot_beverages',
      ],
    },
    // Delivery/online cover food orders from aggregators; alcohol stays on premises.
    allowedOrderTypes: ['dine_in', 'takeaway', 'qr', 'delivery', 'online', 'room_service'],
    dineIn: true,
    tables: true,
    alcoholToggle: false,
    alcoholAlwaysOn: true,
    servingUnits: ['serve', 'piece'],
  },
};

export function isBusinessType(value: unknown): value is BusinessType {
  return typeof value === 'string' && (BUSINESS_TYPES as readonly string[]).includes(value);
}

export function getBusinessTypeRules(type: BusinessType | null | undefined): BusinessTypeRules {
  return BUSINESS_TYPE_RULES[type && isBusinessType(type) ? type : 'restaurant'];
}

type SettingsLike = Record<string, unknown> | null | undefined;

/**
 * Whether this org serves alcohol (bar always; restaurant/cafe via toggle).
 * Accepts the raw organization settings JSON.
 */
export function orgServesAlcohol(type: BusinessType | null | undefined, settings?: unknown): boolean {
  const rules = getBusinessTypeRules(type);
  if (rules.alcoholAlwaysOn) return true;
  if (!rules.alcoholToggle) return false;
  return (
    !!settings &&
    typeof settings === 'object' &&
    (settings as Record<string, unknown>).servesAlcohol === true
  );
}

/** Menu item product type for beer, wine, spirits and cocktails. */
export const ALCOHOL_PRODUCT_TYPE = 'alcohol';

export function isAlcoholProductType(type: string | null | undefined): boolean {
  return type === ALCOHOL_PRODUCT_TYPE;
}

/** Customer (app / QR) orders may include alcohol only for these order types. */
export const ALCOHOL_CUSTOMER_ORDER_TYPES: readonly OrderTypeValue[] = ['dine_in', 'qr'];

export type CatalogVisibility = 'core' | 'optional' | 'hidden';

export function getCatalogSectionVisibility(
  type: BusinessType | null | undefined,
  sectionId: string,
  options: { servesAlcohol?: boolean } = {},
): CatalogVisibility {
  const rules = getBusinessTypeRules(type);
  if (isAlcoholSection(sectionId)) {
    const alcoholOn = rules.alcoholAlwaysOn || (rules.alcoholToggle && options.servesAlcohol === true);
    if (!alcoholOn) return 'hidden';
    // Restaurants/cafes that opt in see alcohol as optional; bars see it as core.
    return (rules.catalog.core as readonly string[]).includes(sectionId) ? 'core' : 'optional';
  }
  if ((rules.catalog.core as readonly string[]).includes(sectionId)) return 'core';
  if ((rules.catalog.optional as readonly string[]).includes(sectionId)) return 'optional';
  return 'hidden';
}

/**
 * Order types the org actually offers: saved Settings (or business-type
 * defaults when never saved) capped by the business-type rules.
 */
export function getEffectiveOrderTypes(
  type: BusinessType | null | undefined,
  settings?: SettingsLike,
): OrderTypeValue[] {
  const rules = getBusinessTypeRules(type);
  const saved = settings?.enabledOrderTypes;
  const base: string[] = Array.isArray(saved)
    ? saved.filter((v): v is string => typeof v === 'string')
    : [...BUSINESS_TYPE_DEFAULTS[type && isBusinessType(type) ? type : 'restaurant'].enabledOrderTypes];
  return rules.allowedOrderTypes.filter((t) => base.includes(t));
}

/** Order types a POS cashier can pick at the counter. */
export function getPosOrderTypes(
  type: BusinessType | null | undefined,
  settings?: SettingsLike,
): Array<'takeaway' | 'dine_in' | 'delivery'> {
  const rules = getBusinessTypeRules(type);
  const effective = getEffectiveOrderTypes(type, settings);
  const out: Array<'takeaway' | 'dine_in' | 'delivery'> = [];
  if (rules.allowedOrderTypes.includes('takeaway')) out.push('takeaway');
  // Counter "Eat in" follows the business type, not the guest-facing channel toggles.
  if (rules.dineIn && rules.allowedOrderTypes.includes('dine_in')) out.push('dine_in');
  if (effective.includes('delivery')) out.push('delivery');
  return out;
}

/**
 * Returns an error message when an order violates the business-type rules,
 * or null when allowed. Only hard rules are enforced here (not Settings
 * toggles) so existing flows keep working.
 */
export function getOrderTypeViolation(
  type: BusinessType | null | undefined,
  order: { type: string; hasTable: boolean },
): string | null {
  if (!type || !isBusinessType(type)) return null;
  const rules = BUSINESS_TYPE_RULES[type];
  const label = BUSINESS_TYPE_DEFAULTS[type].label;
  if (order.hasTable && !rules.tables) {
    return `${label} businesses do not use tables`;
  }
  if (!(rules.allowedOrderTypes as readonly string[]).includes(order.type)) {
    return `${label} businesses cannot take ${order.type.replace('_', '-')} orders`;
  }
  return null;
}
