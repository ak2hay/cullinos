import type { MarketingCmsBundle } from '@cullinos/shared';
import {
  CULLINOS_ELEVATOR_PITCH,
  MARKETING_IMAGES,
  MARKETING_PLANS,
  NAV_LINKS,
} from '@cullinos/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

export async function fetchMarketingBundle(previewToken?: string): Promise<MarketingCmsBundle | null> {
  try {
    const url = previewToken
      ? `${API_BASE}/public/marketing/site?preview=${encodeURIComponent(previewToken)}`
      : `${API_BASE}/public/marketing/site`;
    const res = await fetch(url, previewToken ? { cache: 'no-store' } : { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as MarketingCmsBundle;
  } catch {
    return null;
  }
}

export function buildFallbackMarketingBundle(): MarketingCmsBundle {
  return {
    site: {
      siteName: 'Cullinos',
      tagline: 'Restaurant Operating System',
      registerUrl: '/contact?intent=trial',
      contactEmail: 'hello@rkyves.com',
    },
    theme: {},
    heroSlides: [
      {
        id: 'fallback-1',
        headline: 'Run your restaurant',
        headlineAccent: 'from one place.',
        subline: CULLINOS_ELEVATOR_PITCH.subline,
        imageKey: 'heroRestaurant',
        sortOrder: 0,
      },
      {
        id: 'fallback-2',
        headline: 'Your kitchen,',
        headlineAccent: 'always in sync.',
        subline: 'Every order from cashier, waiter, or QR menu appears on the kitchen display instantly.',
        imageKey: 'heroKitchen',
        sortOrder: 1,
      },
      {
        id: 'fallback-3',
        headline: 'One platform,',
        headlineAccent: 'every team member.',
        subline: 'Cashiers, waiters, managers, and owners — each with the right tools and permissions.',
        imageKey: 'heroTeam',
        sortOrder: 2,
      },
    ],
    navItems: NAV_LINKS.filter((l) => !('children' in l)).map((l, i) => ({
      id: `nav-${i}`,
      label: l.label,
      href: l.href,
      sortOrder: i,
      groupKey: 'main',
    })),
    pricingCards: MARKETING_PLANS.map((p, i) => ({
      id: `plan-${p.key}`,
      planKey: p.key,
      name: p.name,
      description: p.description,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      maxOutlets: p.maxOutlets,
      maxUsers: p.maxUsers,
      maxTerminals: p.maxTerminals,
      features: p.features.map(String),
      cta: p.cta,
      highlighted: Boolean(p.highlighted),
      sortOrder: i,
    })),
    testimonials: [],
    imageMap: { ...MARKETING_IMAGES },
  };
}

export async function getMarketingContent(previewToken?: string): Promise<MarketingCmsBundle> {
  const cms = await fetchMarketingBundle(previewToken);
  if (cms && cms.heroSlides.length > 0) return cms;
  return buildFallbackMarketingBundle();
}

export function resolveMarketingImage(
  bundle: MarketingCmsBundle,
  key: string,
  fallback: string,
): string {
  if (bundle.imageMap[key]) return bundle.imageMap[key];
  const slide = bundle.heroSlides.find(
    (s: { imageKey?: string | null; imageAsset?: { url: string } | null }) => s.imageKey === key,
  );
  if (slide?.imageAsset?.url) return slide.imageAsset.url;
  return fallback;
}

export const MARKETING_API_BASE = API_BASE;
