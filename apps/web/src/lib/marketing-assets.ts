import type { MarketingImageKey } from '@cullinos/shared';
import flowCloud from '@/assets/marketing/flow-cloud.svg';
import mockupAdmin from '@/assets/marketing/mockup-admin.svg';
import mockupEnterprise from '@/assets/marketing/mockup-enterprise.svg';
import mockupKds from '@/assets/marketing/mockup-kds.svg';
import mockupOrdering from '@/assets/marketing/mockup-ordering.svg';
import mockupPos from '@/assets/marketing/mockup-pos.svg';
import mockupWaiter from '@/assets/marketing/mockup-waiter.svg';

/** Bundled SVG URLs — served from /_next/static/ instead of /public (fixes Vercel 500s). */
export const BUNDLED_MARKETING_IMAGES: Partial<Record<MarketingImageKey, string>> = {
  mockupPos,
  mockupKds,
  mockupWaiter,
  mockupOrdering,
  mockupAdmin,
  mockupEnterprise,
  flowCloud,
};

export function getBundledMarketingImage(key: MarketingImageKey): string | undefined {
  return BUNDLED_MARKETING_IMAGES[key];
}
