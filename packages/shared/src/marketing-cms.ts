export interface MarketingCmsBundle {
  site: {
    siteName?: string;
    tagline?: string;
    siteDescription?: string;
    registerUrl?: string;
    contactEmail?: string;
    lastPublishedAt?: string;
  } | null;
  theme: Record<string, string>;
  heroSlides: Array<{
    id: string;
    headline: string;
    headlineAccent: string;
    subline: string;
    imageKey?: string | null;
    imageAsset?: { url: string; alt?: string | null } | null;
    sortOrder: number;
  }>;
  navItems: Array<{ id: string; label: string; href: string; sortOrder: number; groupKey?: string }>;
  pricingCards: Array<{
    id: string;
    planKey: string;
    name: string;
    description: string;
    priceMonthly: number;
    priceYearly: number;
    maxOutlets: number;
    maxUsers: number;
    maxTerminals: number;
    features: string[];
    cta: string;
    highlighted: boolean;
    sortOrder: number;
  }>;
  testimonials: Array<{ id: string; quote: string; author: string; role: string; sortOrder: number }>;
  imageMap: Record<string, string>;
  pages?: unknown[];
  assets?: unknown[];
}
