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
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const OPERATING_MODES = ['full_service', 'counter', 'hybrid'] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];

/** Top-level category shown in onboarding (QSR expands to subcategories). */
export const BUSINESS_TYPE_PARENTS = [
  'restaurant',
  'qsr',
  'cloud_kitchen',
  'catering',
] as const;

export type BusinessTypeParent = (typeof BUSINESS_TYPE_PARENTS)[number];

export const BUSINESS_TYPE_PARENT_LABELS: Record<BusinessTypeParent, string> = {
  restaurant: 'Restaurant',
  qsr: 'QSR',
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
};

export type OnboardingStep =
  | 'business_info'
  | 'menu_setup'
  | 'tables'
  | 'tax_gst'
  | 'staff'
  | 'recipes'
  | 'done';

export interface BusinessTypeDefaults {
  label: string;
  operatingMode: OperatingMode;
  enabledOrderTypes: string[];
  onboardingSteps: OnboardingStep[];
  recommendedPlan: 'STARTER' | 'QSR' | 'PROFESSIONAL' | 'ENTERPRISE';
  sampleCategories: string[];
  features: FeatureKey[];
}

export const BUSINESS_TYPE_DEFAULTS: Record<BusinessType, BusinessTypeDefaults> = {
  restaurant: {
    label: BUSINESS_TYPE_LABELS.restaurant,
    operatingMode: 'full_service',
    enabledOrderTypes: ['dine_in', 'takeaway', 'delivery', 'qr', 'online'],
    onboardingSteps: ['business_info', 'menu_setup', 'tables', 'tax_gst', 'staff', 'done'],
    recommendedPlan: 'PROFESSIONAL',
    sampleCategories: ['Starters', 'Main Course', 'Breads', 'Beverages', 'Desserts'],
    features: [
      FEATURES.POS,
      FEATURES.BILLING,
      FEATURES.KOT,
      FEATURES.TABLES,
      FEATURES.KDS,
      FEATURES.QR_ORDERING,
    ],
  },
  cafe: {
    label: BUSINESS_TYPE_LABELS.cafe,
    operatingMode: 'counter',
    enabledOrderTypes: ['takeaway', 'qr', 'online'],
    onboardingSteps: ['business_info', 'menu_setup', 'tax_gst', 'staff', 'done'],
    recommendedPlan: 'QSR',
    sampleCategories: ['Coffee', 'Tea', 'Pastries', 'Sandwiches', 'Cold Drinks'],
    features: [
      FEATURES.POS,
      FEATURES.BILLING,
      FEATURES.COUNTER_MODE,
      FEATURES.PICKUP_QUEUE,
      FEATURES.LOYALTY,
      FEATURES.QR_ORDERING,
      FEATURES.EVENTS,
    ],
  },
  food_truck: {
    label: BUSINESS_TYPE_LABELS.food_truck,
    operatingMode: 'counter',
    enabledOrderTypes: ['takeaway', 'qr', 'online'],
    onboardingSteps: ['business_info', 'menu_setup', 'tax_gst', 'done'],
    recommendedPlan: 'QSR',
    sampleCategories: ['Mains', 'Sides', 'Drinks', 'Combos'],
    features: [
      FEATURES.POS,
      FEATURES.BILLING,
      FEATURES.COUNTER_MODE,
      FEATURES.PICKUP_QUEUE,
      FEATURES.PRE_ORDERS,
      FEATURES.QR_ORDERING,
    ],
  },
  bakery: {
    label: BUSINESS_TYPE_LABELS.bakery,
    operatingMode: 'hybrid',
    enabledOrderTypes: ['takeaway', 'qr', 'online', 'delivery'],
    onboardingSteps: ['business_info', 'menu_setup', 'recipes', 'tax_gst', 'staff', 'done'],
    recommendedPlan: 'PROFESSIONAL',
    sampleCategories: ['Breads', 'Pastries', 'Cakes', 'Cookies', 'Savouries'],
    features: [
      FEATURES.POS,
      FEATURES.BILLING,
      FEATURES.RECIPES,
      FEATURES.PRODUCTION,
      FEATURES.INVENTORY,
      FEATURES.PRE_ORDERS,
    ],
  },
  qsr: {
    label: BUSINESS_TYPE_LABELS.qsr,
    operatingMode: 'counter',
    enabledOrderTypes: ['takeaway', 'qr', 'online', 'delivery'],
    onboardingSteps: ['business_info', 'menu_setup', 'tax_gst', 'staff', 'done'],
    recommendedPlan: 'QSR',
    sampleCategories: ['Combos', 'Mains', 'Sides', 'Drinks'],
    features: [
      FEATURES.POS,
      FEATURES.BILLING,
      FEATURES.COUNTER_MODE,
      FEATURES.PICKUP_QUEUE,
      FEATURES.KDS,
      FEATURES.QR_ORDERING,
    ],
  },
  cloud_kitchen: {
    label: BUSINESS_TYPE_LABELS.cloud_kitchen,
    operatingMode: 'counter',
    enabledOrderTypes: ['delivery', 'online', 'takeaway'],
    onboardingSteps: ['business_info', 'menu_setup', 'tax_gst', 'done'],
    recommendedPlan: 'PROFESSIONAL',
    sampleCategories: ['Mains', 'Sides', 'Beverages'],
    features: [
      FEATURES.POS,
      FEATURES.BILLING,
      FEATURES.KDS,
      FEATURES.DELIVERY,
      FEATURES.ONLINE_ORDERING,
      FEATURES.MULTI_BRAND,
      FEATURES.PICKUP_QUEUE,
    ],
  },
  catering: {
    label: BUSINESS_TYPE_LABELS.catering,
    operatingMode: 'hybrid',
    enabledOrderTypes: ['takeaway', 'online', 'banquet'],
    onboardingSteps: ['business_info', 'menu_setup', 'tax_gst', 'staff', 'done'],
    recommendedPlan: 'PROFESSIONAL',
    sampleCategories: ['Packages', 'Mains', 'Starters', 'Desserts'],
    features: [
      FEATURES.POS,
      FEATURES.BILLING,
      FEATURES.PRE_ORDERS,
      FEATURES.BANQUET,
      FEATURES.CRM,
      FEATURES.EVENTS,
    ],
  },
};

/** Admin routes that require a business-type feature to appear in nav. */
export const ADMIN_NAV_FEATURE_MAP: Record<string, FeatureKey> = {
  '/tables': FEATURES.TABLES,
  '/inventory': FEATURES.INVENTORY,
  '/production': FEATURES.PRODUCTION,
  '/pickup-queue': FEATURES.PICKUP_QUEUE,
  '/events': FEATURES.EVENTS,
};

export function getOnboardingStepsForBusinessType(type: BusinessType): OnboardingStep[] {
  return BUSINESS_TYPE_DEFAULTS[type].onboardingSteps;
}

export function shouldSkipTablesStep(type: BusinessType): boolean {
  return !BUSINESS_TYPE_DEFAULTS[type].onboardingSteps.includes('tables');
}

export function getBusinessTypeParent(type: BusinessType): BusinessTypeParent {
  if ((QSR_SUBTYPES as readonly string[]).includes(type)) return 'qsr';
  if (type === 'restaurant') return 'restaurant';
  if (type === 'cloud_kitchen') return 'cloud_kitchen';
  return 'catering';
}

export function getQsrSubtypes(): readonly QsrSubtype[] {
  return QSR_SUBTYPES;
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
): boolean {
  // Unset type during setup — show everything.
  if (!type) return true;
  return BUSINESS_TYPE_DEFAULTS[type].features.includes(feature);
}

export function isAdminNavPathVisible(
  type: BusinessType | null | undefined,
  path: string,
): boolean {
  const feature = ADMIN_NAV_FEATURE_MAP[path];
  if (!feature) return true;
  return isNavFeatureVisible(type, feature);
}
