import type { FeatureKey } from './features';
import { FEATURES } from './features';

export const BUSINESS_TYPES = [
  'restaurant',
  'cafe',
  'food_truck',
  'bakery',
  'qsr',
  'cloud_kitchen',
  'catering',
  'bar',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const OPERATING_MODES = ['full_service', 'counter', 'hybrid'] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];

export const RESTAURANT_SIZES = ['small', 'medium', 'large'] as const;
export type RestaurantSize = (typeof RESTAURANT_SIZES)[number];

export const RESTAURANT_SIZE_LABELS: Record<RestaurantSize, string> = {
  small: 'Small (up to ~40 seats)',
  medium: 'Medium (40–100 seats)',
  large: 'Large (100+ seats / multi-section)',
};

/** Top-level category shown in onboarding (QSR expands to subcategories). */
export const BUSINESS_TYPE_PARENTS = [
  'restaurant',
  'qsr',
  'bar',
  'cloud_kitchen',
  'catering',
] as const;

export type BusinessTypeParent = (typeof BUSINESS_TYPE_PARENTS)[number];

export const BUSINESS_TYPE_PARENT_LABELS: Record<BusinessTypeParent, string> = {
  restaurant: 'Restaurant',
  qsr: 'QSR',
  bar: 'Bar & Pub',
  cloud_kitchen: 'Cloud Kitchen',
  catering: 'Catering',
};

/** Subcategories under the QSR parent. Stored as existing BusinessType values. */
export const QSR_SUBTYPES = ['cafe', 'food_truck', 'bakery', 'qsr'] as const;

export type QsrSubtype = (typeof QSR_SUBTYPES)[number];

export const QSR_SUBTYPE_LABELS: Record<QsrSubtype, string> = {
  cafe: 'Cafe & Coffee Shop',
  food_truck: 'Food Truck & Pop-up',
  bakery: 'Bakery & Patisserie',
  qsr: 'Fast Casual',
};

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe & Coffee Shop',
  food_truck: 'Food Truck & Pop-up',
  bakery: 'Bakery & Patisserie',
  qsr: 'Fast Casual',
  cloud_kitchen: 'Cloud Kitchen',
  catering: 'Catering',
  bar: 'Bar & Pub',
};

export type OnboardingStep =
  | 'business_info'
  | 'feature_preview'
  | 'menu_setup'
  | 'tables'
  | 'tax_gst'
  | 'staff'
  | 'recipes'
  | 'done';

export type RecommendedPlan = 'STARTER' | 'QSR' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface BusinessTypeDefaults {
  label: string;
  operatingMode: OperatingMode;
  enabledOrderTypes: string[];
  onboardingSteps: OnboardingStep[];
  recommendedPlan: RecommendedPlan;
  sampleCategories: string[];
  features: FeatureKey[];
}

const CORE_OPS: FeatureKey[] = [
  FEATURES.POS,
  FEATURES.BILLING,
  FEATURES.KOT,
  FEATURES.BASIC_REPORTS,
];

const COUNTER_OPS: FeatureKey[] = [
  ...CORE_OPS,
  FEATURES.COUNTER_MODE,
  FEATURES.PICKUP_QUEUE,
  FEATURES.KDS,
  FEATURES.QR_ORDERING,
  FEATURES.ONLINE_ORDERING,
  FEATURES.LOYALTY,
];

const STOCK_OPS: FeatureKey[] = [FEATURES.INVENTORY, FEATURES.RECIPES, FEATURES.PURCHASING];

const RESTAURANT_PROFESSIONAL_FEATURES: FeatureKey[] = [
  ...CORE_OPS,
  FEATURES.TABLES,
  FEATURES.KDS,
  ...STOCK_OPS,
  FEATURES.LOYALTY,
  FEATURES.CRM,
  FEATURES.QR_ORDERING,
  FEATURES.ONLINE_ORDERING,
  FEATURES.DELIVERY,
];

/** Size-specific overrides when businessType === restaurant. */
export const RESTAURANT_SIZE_PROFILES: Record<
  RestaurantSize,
  { recommendedPlan: RecommendedPlan; features: FeatureKey[] }
> = {
  small: {
    recommendedPlan: 'STARTER',
    features: [
      ...CORE_OPS,
      FEATURES.TABLES,
      FEATURES.KDS,
      FEATURES.QR_ORDERING,
      FEATURES.ONLINE_ORDERING,
    ],
  },
  medium: {
    recommendedPlan: 'PROFESSIONAL',
    features: RESTAURANT_PROFESSIONAL_FEATURES,
  },
  large: {
    recommendedPlan: 'ENTERPRISE',
    features: [
      ...RESTAURANT_PROFESSIONAL_FEATURES,
      FEATURES.EVENTS,
      FEATURES.MULTI_OUTLET,
      FEATURES.MULTI_BRAND,
      FEATURES.ADVANCED_ANALYTICS,
    ],
  },
};

export const BUSINESS_TYPE_DEFAULTS: Record<BusinessType, BusinessTypeDefaults> = {
  restaurant: {
    label: BUSINESS_TYPE_LABELS.restaurant,
    operatingMode: 'full_service',
    enabledOrderTypes: ['dine_in', 'takeaway', 'delivery', 'qr', 'online'],
    onboardingSteps: [
      'business_info',
      'feature_preview',
      'menu_setup',
      'tables',
      'tax_gst',
      'staff',
      'done',
    ],
    recommendedPlan: 'PROFESSIONAL',
    sampleCategories: ['Starters', 'Main Course', 'Breads', 'Beverages', 'Desserts'],
    features: RESTAURANT_PROFESSIONAL_FEATURES,
  },
  cafe: {
    label: BUSINESS_TYPE_LABELS.cafe,
    operatingMode: 'counter',
    enabledOrderTypes: ['dine_in', 'takeaway', 'qr', 'online'],
    onboardingSteps: [
      'business_info',
      'feature_preview',
      'menu_setup',
      'tables',
      'tax_gst',
      'staff',
      'done',
    ],
    recommendedPlan: 'QSR',
    sampleCategories: ['Coffee', 'Tea', 'Pastries', 'Sandwiches', 'Cold Drinks'],
    features: [...COUNTER_OPS, FEATURES.TABLES, FEATURES.INVENTORY, FEATURES.RECIPES],
  },
  food_truck: {
    label: BUSINESS_TYPE_LABELS.food_truck,
    operatingMode: 'counter',
    enabledOrderTypes: ['takeaway', 'qr', 'online'],
    onboardingSteps: ['business_info', 'feature_preview', 'menu_setup', 'tax_gst', 'done'],
    recommendedPlan: 'QSR',
    sampleCategories: ['Mains', 'Sides', 'Drinks', 'Combos'],
    features: [...COUNTER_OPS, FEATURES.INVENTORY, FEATURES.PRE_ORDERS, FEATURES.EVENTS],
  },
  bakery: {
    label: BUSINESS_TYPE_LABELS.bakery,
    operatingMode: 'hybrid',
    enabledOrderTypes: ['takeaway', 'qr', 'online', 'delivery'],
    onboardingSteps: [
      'business_info',
      'feature_preview',
      'menu_setup',
      'recipes',
      'tax_gst',
      'staff',
      'done',
    ],
    recommendedPlan: 'PROFESSIONAL',
    sampleCategories: ['Breads', 'Pastries', 'Cakes', 'Cookies', 'Savouries'],
    features: [
      ...COUNTER_OPS,
      ...STOCK_OPS,
      FEATURES.PRODUCTION,
      FEATURES.PRE_ORDERS,
      FEATURES.DELIVERY,
    ],
  },
  qsr: {
    label: BUSINESS_TYPE_LABELS.qsr,
    operatingMode: 'counter',
    enabledOrderTypes: ['takeaway', 'qr', 'online', 'delivery'],
    onboardingSteps: [
      'business_info',
      'feature_preview',
      'menu_setup',
      'tax_gst',
      'staff',
      'done',
    ],
    recommendedPlan: 'QSR',
    sampleCategories: ['Combos', 'Mains', 'Sides', 'Drinks'],
    features: [...COUNTER_OPS, FEATURES.INVENTORY, FEATURES.RECIPES, FEATURES.DELIVERY],
  },
  cloud_kitchen: {
    label: BUSINESS_TYPE_LABELS.cloud_kitchen,
    operatingMode: 'counter',
    enabledOrderTypes: ['delivery', 'online', 'takeaway'],
    onboardingSteps: ['business_info', 'feature_preview', 'menu_setup', 'tax_gst', 'done'],
    recommendedPlan: 'PROFESSIONAL',
    sampleCategories: ['Mains', 'Sides', 'Beverages'],
    features: [
      ...CORE_OPS,
      FEATURES.KDS,
      FEATURES.DELIVERY,
      FEATURES.ONLINE_ORDERING,
      FEATURES.MULTI_BRAND,
      ...STOCK_OPS,
      FEATURES.LOYALTY,
      FEATURES.CRM,
      FEATURES.MULTI_OUTLET,
    ],
  },
  catering: {
    label: BUSINESS_TYPE_LABELS.catering,
    operatingMode: 'hybrid',
    enabledOrderTypes: ['takeaway', 'online', 'delivery', 'banquet'],
    onboardingSteps: [
      'business_info',
      'feature_preview',
      'menu_setup',
      'recipes',
      'tax_gst',
      'staff',
      'done',
    ],
    recommendedPlan: 'PROFESSIONAL',
    sampleCategories: ['Packages', 'Mains', 'Starters', 'Desserts'],
    features: [
      ...CORE_OPS,
      FEATURES.KDS,
      FEATURES.PRE_ORDERS,
      FEATURES.BANQUET,
      FEATURES.CRM,
      FEATURES.EVENTS,
      FEATURES.PRODUCTION,
      ...STOCK_OPS,
      FEATURES.ONLINE_ORDERING,
      FEATURES.DELIVERY,
    ],
  },
  bar: {
    label: BUSINESS_TYPE_LABELS.bar,
    operatingMode: 'hybrid',
    enabledOrderTypes: ['dine_in', 'takeaway', 'qr'],
    onboardingSteps: [
      'business_info',
      'feature_preview',
      'menu_setup',
      'tables',
      'recipes',
      'tax_gst',
      'staff',
      'done',
    ],
    recommendedPlan: 'PROFESSIONAL',
    sampleCategories: ['Beer', 'Spirits', 'Cocktails', 'Wine', 'Mocktails', 'Bar Snacks'],
    features: [
      ...CORE_OPS,
      FEATURES.TABLES,
      FEATURES.KDS,
      FEATURES.QR_ORDERING,
      ...STOCK_OPS,
      FEATURES.LOYALTY,
      FEATURES.CRM,
      FEATURES.EVENTS,
    ],
  },
};

/** Admin routes that require a business-type feature to appear in nav. */
export const ADMIN_NAV_FEATURE_MAP: Record<string, FeatureKey> = {
  '/tables': FEATURES.TABLES,
  '/reservations': FEATURES.TABLES,
  '/inventory': FEATURES.INVENTORY,
  '/production': FEATURES.PRODUCTION,
  '/pickup-queue': FEATURES.PICKUP_QUEUE,
  '/events': FEATURES.EVENTS,
  '/loyalty': FEATURES.LOYALTY,
  '/displays': FEATURES.KDS,
  '/kds': FEATURES.KDS,
  '/cds': FEATURES.KDS,
  '/kiosk': FEATURES.QR_ORDERING,
  '/recipes': FEATURES.RECIPES,
  '/purchasing': FEATURES.PURCHASING,
  '/suppliers': FEATURES.PURCHASING,
  '/central-kitchen': FEATURES.MULTI_OUTLET,
  '/delivery': FEATURES.DELIVERY,
  '/marketplace': FEATURES.ONLINE_ORDERING,
  '/coupons': FEATURES.LOYALTY,
  '/guest-banners': FEATURES.ONLINE_ORDERING,
  '/banquets': FEATURES.BANQUET,
  '/brands': FEATURES.MULTI_BRAND,
  '/hospitality/guests': FEATURES.ROOM_SERVICE,
  '/hospitality/rooms': FEATURES.ROOM_SERVICE,
};

/**
 * Admin routes whose API endpoints are guarded by a subscription module
 * (`@RequireModule`). Only list routes whose backing controllers enforce the
 * module, otherwise nav would hide pages the API still serves.
 */
export const ADMIN_NAV_PLAN_MODULE_MAP: Record<string, string> = {
  '/tables': 'tables',
  '/reservations': 'tables',
  '/inventory': 'inventory',
  '/recipes': 'inventory',
  '/purchasing': 'inventory',
  '/suppliers': 'inventory',
  '/production': 'production',
  '/events': 'events',
  '/loyalty': 'loyalty',
  '/coupons': 'loyalty',
  '/central-kitchen': 'management',
};

export interface ProfileFeatures {
  features: FeatureKey[];
  recommendedPlan: RecommendedPlan;
  operatingMode: OperatingMode;
  enabledOrderTypes: string[];
  sampleCategories: string[];
  onboardingSteps: OnboardingStep[];
  label: string;
}

export function getFeaturesForProfile(
  type: BusinessType,
  size?: RestaurantSize | null,
): ProfileFeatures {
  const base = BUSINESS_TYPE_DEFAULTS[type];
  if (type === 'restaurant' && size && RESTAURANT_SIZE_PROFILES[size]) {
    const profile = RESTAURANT_SIZE_PROFILES[size];
    return {
      features: profile.features,
      recommendedPlan: profile.recommendedPlan,
      operatingMode: base.operatingMode,
      enabledOrderTypes: base.enabledOrderTypes,
      sampleCategories: base.sampleCategories,
      onboardingSteps: base.onboardingSteps,
      label: `${base.label} · ${RESTAURANT_SIZE_LABELS[size]}`,
    };
  }
  return {
    features: base.features,
    recommendedPlan: base.recommendedPlan,
    operatingMode: base.operatingMode,
    enabledOrderTypes: base.enabledOrderTypes,
    sampleCategories: base.sampleCategories,
    onboardingSteps: base.onboardingSteps,
    label: base.label,
  };
}

export function getOnboardingStepsForBusinessType(
  type: BusinessType,
  size?: RestaurantSize | null,
): OnboardingStep[] {
  return getFeaturesForProfile(type, size).onboardingSteps;
}

export function shouldSkipTablesStep(
  type: BusinessType,
  size?: RestaurantSize | null,
): boolean {
  return !getFeaturesForProfile(type, size).onboardingSteps.includes('tables');
}

export function getBusinessTypeParent(type: BusinessType): BusinessTypeParent {
  if ((QSR_SUBTYPES as readonly string[]).includes(type)) return 'qsr';
  if (type === 'restaurant') return 'restaurant';
  if (type === 'cloud_kitchen') return 'cloud_kitchen';
  if (type === 'bar') return 'bar';
  return 'catering';
}

export function getQsrSubtypes(): readonly QsrSubtype[] {
  return QSR_SUBTYPES;
}

export function isQsrSubtype(type: string | null | undefined): type is QsrSubtype {
  if (!type) return false;
  return (QSR_SUBTYPES as readonly string[]).includes(type);
}

export function isRestaurantSize(value: string | null | undefined): value is RestaurantSize {
  if (!value) return false;
  return (RESTAURANT_SIZES as readonly string[]).includes(value);
}

export function resolveBusinessTypeFromParent(
  parent: BusinessTypeParent,
  qsrSubtype: QsrSubtype = 'qsr',
): BusinessType {
  if (parent === 'qsr') return qsrSubtype;
  return parent;
}

export function isNavFeatureVisible(
  type: BusinessType | null | undefined,
  feature: FeatureKey,
  size?: RestaurantSize | null,
): boolean {
  // Unset type during setup — show everything.
  if (!type) return true;
  return getFeaturesForProfile(type, size).features.includes(feature);
}

/**
 * `enabledModules` is the active subscription's enabled entitlement modules.
 * Pass null/undefined when unknown (loading, no active subscription) to skip
 * the plan check and fall back to business-type visibility only.
 */
export function isAdminNavPathVisible(
  type: BusinessType | null | undefined,
  path: string,
  size?: RestaurantSize | null,
  enabledModules?: readonly string[] | null,
): boolean {
  const planModule = ADMIN_NAV_PLAN_MODULE_MAP[path];
  if (planModule && enabledModules && !enabledModules.includes(planModule)) {
    return false;
  }
  const feature = ADMIN_NAV_FEATURE_MAP[path];
  if (!feature) return true;
  return isNavFeatureVisible(type, feature, size);
}
