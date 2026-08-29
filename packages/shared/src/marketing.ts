import { FEATURES, PLAN_FEATURES, type FeatureKey } from './features';

export const MARKETING_URLS = {
  site: 'https://cullinos.com',
  admin: 'https://admin.cullinos.com',
  register: 'https://admin.cullinos.com/register',
  manage: 'https://manage.cullinos.com',
  order: 'https://order.cullinos.com',
  waiter: 'https://waiter.cullinos.com',
  api: 'https://api.cullinos.com',
} as const;

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  [FEATURES.POS]: 'Point of Sale',
  [FEATURES.BILLING]: 'Billing & GST',
  [FEATURES.KOT]: 'Kitchen Order Tickets',
  [FEATURES.BASIC_REPORTS]: 'Basic Reports',
  [FEATURES.TABLES]: 'Table Management',
  [FEATURES.KDS]: 'Kitchen Display (KDS)',
  [FEATURES.INVENTORY]: 'Inventory Management',
  [FEATURES.RECIPES]: 'Recipes & Costing',
  [FEATURES.PURCHASING]: 'Purchasing',
  [FEATURES.CRM]: 'Customer CRM',
  [FEATURES.LOYALTY]: 'Loyalty Programs',
  [FEATURES.QR_ORDERING]: 'QR Dine-in Ordering',
  [FEATURES.ONLINE_ORDERING]: 'Online Ordering',
  [FEATURES.DELIVERY]: 'Delivery Management',
  [FEATURES.MULTI_OUTLET]: 'Multi-outlet Management',
  [FEATURES.MULTI_BRAND]: 'Multi-brand Support',
  [FEATURES.FRANCHISE]: 'Franchise Management',
  [FEATURES.ADVANCED_ANALYTICS]: 'Advanced Analytics',
  [FEATURES.API_ACCESS]: 'API Access',
  [FEATURES.ROOM_SERVICE]: 'Room Service',
  [FEATURES.ROOM_POSTING]: 'Room Posting',
  [FEATURES.BANQUET]: 'Banquet & Events',
  [FEATURES.HOSPITALITY_INTEGRATIONS]: 'Hotel PMS Integrations',
};

export type MarketingPlanKey = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'HOSPITALITY';

export interface MarketingPlan {
  key: MarketingPlanKey;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  maxOutlets: number;
  maxUsers: number;
  maxTerminals: number;
  features: FeatureKey[];
  cta: 'register' | 'contact';
  highlighted?: boolean;
}

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    key: 'STARTER',
    name: 'Starter',
    description: 'POS, Billing, KOT, Basic reports',
    priceMonthly: 99900,
    priceYearly: 999900,
    maxOutlets: 1,
    maxUsers: 5,
    maxTerminals: 2,
    features: PLAN_FEATURES.STARTER,
    cta: 'register',
  },
  {
    key: 'PROFESSIONAL',
    name: 'Professional',
    description: 'Full restaurant operations',
    priceMonthly: 299900,
    priceYearly: 2999900,
    maxOutlets: 3,
    maxUsers: 20,
    maxTerminals: 10,
    features: PLAN_FEATURES.PROFESSIONAL,
    cta: 'register',
    highlighted: true,
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Multi-outlet and franchise',
    priceMonthly: 999900,
    priceYearly: 9999900,
    maxOutlets: 50,
    maxUsers: 200,
    maxTerminals: 100,
    features: PLAN_FEATURES.ENTERPRISE,
    cta: 'contact',
  },
  {
    key: 'HOSPITALITY',
    name: 'Hospitality',
    description: 'Hotel and resort restaurants',
    priceMonthly: 1499900,
    priceYearly: 14999900,
    maxOutlets: 100,
    maxUsers: 500,
    maxTerminals: 200,
    features: PLAN_FEATURES.HOSPITALITY,
    cta: 'contact',
  },
];

export function formatInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  {
    href: '/solutions/restaurants',
    label: 'Solutions',
    children: [
      { href: '/solutions/restaurants', label: 'Restaurants' },
      { href: '/solutions/chains', label: 'Chains & Franchise' },
      { href: '/solutions/hospitality', label: 'Hotels & Resorts' },
    ],
  },
  { href: '/pricing', label: 'Pricing' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
] as const;

export const PRODUCT_MODULES = [
  {
    title: 'Point of Sale',
    description: 'Touch-optimized cashier POS with GST billing, discounts, and split payments.',
    icon: 'pos',
  },
  {
    title: 'Kitchen Display',
    description: 'Real-time KDS and KOT routing so the kitchen stays in sync with the floor.',
    icon: 'kds',
  },
  {
    title: 'Front of House',
    description: 'Waiter app and table management for faster service and fewer errors.',
    icon: 'waiter',
  },
  {
    title: 'Customer Ordering',
    description: 'QR dine-in and online storefront for direct orders to your kitchen.',
    icon: 'ordering',
  },
  {
    title: 'Back Office',
    description: 'Menu, inventory, staff, orders, and reports from one admin dashboard.',
    icon: 'admin',
  },
  {
    title: 'Enterprise Console',
    description: 'Multi-outlet management with consolidated analytics and franchise tools.',
    icon: 'enterprise',
  },
] as const;

export const TRUST_PILLARS = [
  { title: 'GST-ready billing', description: 'CGST, SGST, and IGST built into every bill.' },
  { title: 'Offline POS & KDS', description: 'Local Gateway keeps service running when the internet drops.' },
  { title: 'Scales with you', description: 'From one outlet to hotel chains — same platform.' },
] as const;

export const FEATURE_SECTIONS = [
  {
    title: 'Front of house',
    items: [
      {
        name: 'Point of Sale',
        description: 'Fast checkout, modifiers, split bills, and GST-compliant receipts.',
        status: 'available' as const,
      },
      {
        name: 'Waiter App',
        description: 'Mobile table-side ordering and status updates for your floor staff.',
        status: 'available' as const,
      },
      {
        name: 'Table Management',
        description: 'Live table map, reservations, and turn-time visibility.',
        status: 'available' as const,
      },
      {
        name: 'Kitchen Display',
        description: 'Route orders to stations, track prep times, and mark items ready.',
        status: 'available' as const,
      },
    ],
  },
  {
    title: 'Customer channels',
    items: [
      {
        name: 'QR Ordering',
        description: 'Scan-to-order at the table with menu synced from your back office.',
        status: 'available' as const,
      },
      {
        name: 'Online Storefront',
        description: 'Branded ordering at order.cullinos.com for pickup and delivery.',
        status: 'available' as const,
      },
    ],
  },
  {
    title: 'Back office',
    items: [
      {
        name: 'Menu Management',
        description: 'Categories, items, modifiers, pricing, and availability in one place.',
        status: 'available' as const,
      },
      {
        name: 'Inventory',
        description: 'Stock levels, recipes, purchasing, and wastage tracking.',
        status: 'available' as const,
      },
      {
        name: 'Staff & Permissions',
        description: 'Role-based access so every team member sees only what they need.',
        status: 'available' as const,
      },
      {
        name: 'Reports',
        description: 'Sales, item performance, and outlet summaries.',
        status: 'available' as const,
      },
    ],
  },
  {
    title: 'Growth',
    items: [
      {
        name: 'CRM & Loyalty',
        description: 'Customer profiles, visit history, points, and targeted offers.',
        status: 'available' as const,
      },
      {
        name: 'Coupons & Promotions',
        description: 'Discount codes and campaigns tied to your order engine.',
        status: 'coming_soon' as const,
      },
      {
        name: 'Delivery',
        description: 'Manage delivery orders alongside dine-in and takeaway.',
        status: 'available' as const,
      },
    ],
  },
  {
    title: 'Enterprise',
    items: [
      {
        name: 'Multi-outlet Console',
        description: 'Compare outlets, transfer stock, and manage franchisees centrally.',
        status: 'available' as const,
      },
      {
        name: 'Advanced Analytics',
        description: 'Network-wide dashboards and exportable insights.',
        status: 'available' as const,
      },
      {
        name: 'API Access',
        description: 'Integrate with your existing tools and custom workflows.',
        status: 'available' as const,
      },
    ],
  },
  {
    title: 'Hospitality',
    items: [
      {
        name: 'Room Service',
        description: 'In-room dining orders routed to kitchen and front desk.',
        status: 'available' as const,
      },
      {
        name: 'Room Posting',
        description: 'Charge F&B to guest folios without manual reconciliation.',
        status: 'available' as const,
      },
      {
        name: 'Banquet & Events',
        description: 'Event menus, packages, and billing for large functions.',
        status: 'available' as const,
      },
    ],
  },
] as const;

export const INTEGRATION_CATEGORIES = [
  {
    title: 'Hardware',
    description: 'Connect printers, cash drawers, and scanners through the Local Gateway.',
    status: 'available' as const,
    items: ['Thermal receipt printers', 'Kitchen ticket printers', 'Cash drawer kick', 'Barcode scanners'],
  },
  {
    title: 'Payments',
    description: 'Payment adapter interfaces for UPI, cards, and wallets.',
    status: 'coming_soon' as const,
    items: ['UPI & card terminals', 'Split payments', 'Refund workflows', 'Payment reconciliation'],
  },
  {
    title: 'Hotel PMS',
    description: 'Post charges to guest folios and sync with property systems.',
    status: 'coming_soon' as const,
    items: ['Room posting', 'Folio sync', 'Banquet billing', 'Guest profile lookup'],
  },
  {
    title: 'Notifications',
    description: 'SMS and email adapters for order updates and marketing.',
    status: 'coming_soon' as const,
    items: ['Order confirmations', 'Kitchen alerts', 'Customer SMS', 'Staff notifications'],
  },
] as const;

export const ALL_COMPARISON_FEATURES: FeatureKey[] = [
  FEATURES.POS,
  FEATURES.BILLING,
  FEATURES.KOT,
  FEATURES.BASIC_REPORTS,
  FEATURES.TABLES,
  FEATURES.KDS,
  FEATURES.INVENTORY,
  FEATURES.CRM,
  FEATURES.LOYALTY,
  FEATURES.QR_ORDERING,
  FEATURES.ONLINE_ORDERING,
  FEATURES.DELIVERY,
  FEATURES.MULTI_OUTLET,
  FEATURES.FRANCHISE,
  FEATURES.ADVANCED_ANALYTICS,
  FEATURES.API_ACCESS,
  FEATURES.ROOM_SERVICE,
  FEATURES.BANQUET,
  FEATURES.HOSPITALITY_INTEGRATIONS,
];
