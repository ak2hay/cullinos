import { FEATURES, PLAN_FEATURES, type FeatureKey } from './features';

export const MARKETING_URLS = {
  site: 'https://cullinos.com',
  admin: 'https://admin.cullinos.com',
  register: 'https://cullinos.com/contact?intent=trial',
  manage: 'https://manage.cullinos.com',
  order: 'https://guest.cullinos.com',
  waiter: 'https://waiter.cullinos.com', // Play Store landing for Cullinos Waiter
  guest: 'https://guest.cullinos.com',
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
  [FEATURES.COUNTER_MODE]: 'Counter / QSR Mode',
  [FEATURES.PICKUP_QUEUE]: 'Pickup Queue Display',
  [FEATURES.PRE_ORDERS]: 'Pre-orders & Scheduling',
  [FEATURES.PRODUCTION]: 'Production & Batch Planning',
  [FEATURES.EVENTS]: 'Events & Promotions',
};

export type MarketingPlanKey = 'STARTER' | 'QSR' | 'PROFESSIONAL' | 'ENTERPRISE' | 'HOSPITALITY';

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
    key: 'QSR',
    name: 'QSR / Food SMB',
    description: 'Cafes, food trucks, counter-service — POS, QR, pickup queue, loyalty',
    priceMonthly: 149900,
    priceYearly: 1499900,
    maxOutlets: 1,
    maxUsers: 8,
    maxTerminals: 3,
    features: PLAN_FEATURES.QSR,
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
      { href: '/solutions/cafes', label: 'Cafes & Coffee' },
      { href: '/solutions/food-trucks', label: 'Food Trucks' },
      { href: '/solutions/bakeries', label: 'Bakeries' },
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
    description: 'Waiter app, tables, and reservations for faster service and fewer errors.',
    icon: 'waiter',
  },
  {
    title: 'Cullinos App',
    description: 'QR dine-in, online storefront, kiosk, and the Cullinos Guest marketplace app.',
    icon: 'ordering',
  },
  {
    title: 'Back Office',
    description: 'Menu, inventory, purchasing, production, staff, and reports from one dashboard.',
    icon: 'admin',
  },
  {
    title: 'Enterprise Console',
    description: 'Multi-outlet management with consolidated analytics, franchise, and aggregators.',
    icon: 'enterprise',
  },
] as const;

export const TRUST_PILLARS = [
  { title: 'GST-ready billing', description: 'CGST, SGST, and IGST built into every bill.' },
  { title: 'Every order channel', description: 'POS, Waiter, QR, Guest app, and aggregators — one kitchen.' },
  { title: 'Scales with you', description: 'From one outlet to hotel chains — same platform.' },
] as const;

export const FEATURE_SECTIONS = [
  {
    title: 'Front of house',
    items: [
      {
        name: 'Point of Sale',
        description: 'Fast checkout, modifiers, holds, shifts, and GST-compliant receipts.',
        status: 'available' as const,
      },
      {
        name: 'Waiter App',
        description: 'Mobile table-side ordering and status updates for your floor staff.',
        status: 'available' as const,
      },
      {
        name: 'Table Management',
        description: 'Live table map, merge/transfer, and service requests.',
        status: 'available' as const,
      },
      {
        name: 'Reservations',
        description: 'Book tables from Admin or a public book-link.',
        status: 'available' as const,
      },
      {
        name: 'Kitchen Display',
        description: 'Route orders to stations, track prep times, and mark items ready.',
        status: 'available' as const,
      },
      {
        name: 'Order & Promo Displays',
        description: 'Customer-facing ready boards and in-venue promo playlists.',
        status: 'available' as const,
      },
    ],
  },
  {
    title: 'Cullinos App channels',
    items: [
      {
        name: 'QR Ordering',
        description: 'Scan-to-order at the table with menu synced from your back office.',
        status: 'available' as const,
      },
      {
        name: 'Online Storefront',
        description: 'Order via the Cullinos App (Android) for pickup, delivery, and dine-in.',
        status: 'available' as const,
      },
      {
        name: 'Digital Ordering / Kiosk',
        description: 'Self-serve kiosk mode and launcher URLs for your floor.',
        status: 'available' as const,
      },
      {
        name: 'Cullinos Guest App',
        description: 'Android marketplace: nearby outlets, banners, push, reorder, and loyalty.',
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
        name: 'Inventory & Recipes',
        description: 'Stock levels, costing, wastage, and recipe-linked production.',
        status: 'available' as const,
      },
      {
        name: 'Purchasing & Central Kitchen',
        description: 'Suppliers, POs, GRN, and outlet indents from a central kitchen.',
        status: 'available' as const,
      },
      {
        name: 'Staff & Permissions',
        description: 'Role-based access so every team member sees only what they need.',
        status: 'available' as const,
      },
      {
        name: 'Reports & ERP Export',
        description: 'Sales, item performance, outlet summaries, and day-book export.',
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
        name: 'Coupons, Email & SMS',
        description: 'Discount codes, promo email, and MSG91 SMS campaigns.',
        status: 'available' as const,
      },
      {
        name: 'Delivery & Aggregators',
        description: 'Manage delivery orders plus Swiggy / Zomato connect and settlements.',
        status: 'available' as const,
      },
      {
        name: 'Guest App Marketing',
        description: 'Marketplace listing, banners, and push campaigns for Cullinos Guest.',
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
    description: 'Razorpay for online checkout, Guest app, and subscription collect.',
    status: 'available' as const,
    items: ['Razorpay UPI / cards / wallets', 'Payment intent & verify', 'Webhooks', 'Subscription collect'],
  },
  {
    title: 'Messaging & push',
    description: 'OTP, marketing SMS, email, and Guest app push.',
    status: 'available' as const,
    items: ['MSG91 phone OTP', 'MSG91 marketing SMS', 'Promo email (SMTP / Brevo)', 'Firebase FCM push'],
  },
  {
    title: 'Delivery aggregators',
    description: 'Connect marketplace delivery channels alongside your own orders.',
    status: 'available' as const,
    items: ['Swiggy connect & webhooks', 'Zomato connect & webhooks', 'Settlements / reconciliation'],
  },
  {
    title: 'Hotel PMS',
    description: 'Post charges to guest folios and sync with property systems.',
    status: 'coming_soon' as const,
    items: ['Deeper folio sync', 'Banquet billing sync', 'Guest profile lookup'],
  },
  {
    title: 'Accounting',
    description: 'Export day-book data for your accountant or ERP.',
    status: 'available' as const,
    items: ['ERP day-book export'],
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

export const MARKETING_IMAGES = {
  heroRestaurant: '/images/hero-restaurant.png',
  heroKitchen: '/images/hero-kitchen.png',
  heroTeam: '/images/hero-team.png',
  aboutKitchen: '/images/about-kitchen.png',
  mockupPos: '/images/mockup-pos.png',
  mockupKds: '/images/mockup-kds.png',
  mockupWaiter: '/images/mockup-waiter.png',
  mockupOrdering: '/images/mockup-ordering.png',
  mockupAdmin: '/images/mockup-admin.png',
  mockupEnterprise: '/images/mockup-enterprise.png',
  flowCloud: '/images/flow-cloud.png',
} as const;

export type MarketingImageKey = keyof typeof MARKETING_IMAGES;

export const CULLINOS_ELEVATOR_PITCH = {
  headline: "Cullinos is your food business operating system.",
  subline:
    'One login runs your cashier, kitchen, QR & online orders, Guest marketplace, production, and reports — for restaurants, cafes, food trucks, and bakeries. GST billing built in.',
  bullets: [
    {
      title: 'One platform',
      description: 'Replace separate POS, kitchen printers, and spreadsheets with a single system.',
      icon: 'platform',
    },
    {
      title: 'Every order channel',
      description: 'Cashier, waiter, QR menu, Guest app, and aggregators all reach your kitchen.',
      icon: 'channels',
    },
    {
      title: 'Built for India',
      description: 'GST billing, Razorpay, MSG91, and plans from one outlet to hotel chains.',
      icon: 'india',
    },
  ],
} as const;

export const HOW_IT_WORKS_STEPS = [
  {
    step: 1,
    title: 'Set up your outlet',
    description: 'Add your menu, tables, staff, and GST settings in the admin dashboard.',
    icon: 'setup',
  },
  {
    step: 2,
    title: 'Take orders anywhere',
    description: 'Use POS, waiter app, QR codes, online storefront, or the Guest app — all connected.',
    icon: 'orders',
  },
  {
    step: 3,
    title: 'Kitchen stays in sync',
    description: 'Orders appear on KDS instantly — from floor, web, app, or aggregators.',
    icon: 'kitchen',
  },
  {
    step: 4,
    title: 'Track and grow',
    description: 'See sales, inventory, CRM, and reports. Scale to more outlets when you are ready.',
    icon: 'grow',
  },
] as const;

export const FEATURE_CATEGORY_IDS: Record<string, string> = {
  'Front of house': 'front-of-house',
  'Cullinos App channels': 'cullinos-app-channels',
  'Back office': 'back-office',
  Growth: 'growth',
  Enterprise: 'enterprise',
  Hospitality: 'hospitality',
};

export const FEATURE_CATEGORY_IMAGES: Record<string, MarketingImageKey> = {
  'Front of house': 'mockupPos',
  'Cullinos App channels': 'mockupOrdering',
  'Back office': 'mockupAdmin',
  Growth: 'mockupAdmin',
  Enterprise: 'mockupEnterprise',
  Hospitality: 'mockupEnterprise',
};

export const APP_SHOWCASE_ITEMS = [
  {
    title: 'Point of Sale',
    benefit: 'Bill faster with touch checkout and GST-compliant receipts.',
    imageKey: 'mockupPos' as MarketingImageKey,
    href: '/features#front-of-house',
  },
  {
    title: 'Kitchen Display',
    benefit: 'See every order on screen — no lost paper tickets.',
    imageKey: 'mockupKds' as MarketingImageKey,
    href: '/features#front-of-house',
  },
  {
    title: 'Waiter App',
    benefit: 'Take table orders from a phone — sent straight to the kitchen.',
    imageKey: 'mockupWaiter' as MarketingImageKey,
    href: '/features#front-of-house',
  },
  {
    title: 'Cullinos App',
    benefit: 'QR, online storefront, kiosk, and the Cullinos Guest marketplace app.',
    imageKey: 'mockupOrdering' as MarketingImageKey,
    href: '/features#cullinos-app-channels',
  },
  {
    title: 'Admin Dashboard',
    benefit: 'Manage menu, stock, purchasing, CRM, and Guest app marketing in one place.',
    imageKey: 'mockupAdmin' as MarketingImageKey,
    href: '/features#back-office',
  },
  {
    title: 'Enterprise Console',
    benefit: 'Compare outlets, aggregators, and franchises from one screen.',
    imageKey: 'mockupEnterprise' as MarketingImageKey,
    href: '/features#enterprise',
  },
] as const;

export const FEATURE_CATEGORIES = FEATURE_SECTIONS.map((section) => ({
  id: FEATURE_CATEGORY_IDS[section.title] ?? section.title.toLowerCase().replace(/\s+/g, '-'),
  title: section.title,
  imageKey: FEATURE_CATEGORY_IMAGES[section.title] ?? ('mockupAdmin' as MarketingImageKey),
  benefit: section.items[0]?.description ?? '',
  features: section.items.map((item) => item.name),
}));
