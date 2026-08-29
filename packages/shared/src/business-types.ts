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

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe & Coffee Shop',
  food_truck: 'Food Truck & Pop-up',
  bakery: 'Bakery & Patisserie',
  qsr: 'QSR / Fast Casual',
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
    ],
  },
};

export function getOnboardingStepsForBusinessType(type: BusinessType): OnboardingStep[] {
  return BUSINESS_TYPE_DEFAULTS[type].onboardingSteps;
}

export function shouldSkipTablesStep(type: BusinessType): boolean {
  return !BUSINESS_TYPE_DEFAULTS[type].onboardingSteps.includes('tables');
}
