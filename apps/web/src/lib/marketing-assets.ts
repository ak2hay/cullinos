import type { MarketingImageKey } from '@cullinos/shared';

/** Local marketing art lives in /public/images (PNG). Bundled SVGs retired. */
export const BUNDLED_MARKETING_IMAGES: Partial<Record<MarketingImageKey, string>> = {};

export function getBundledMarketingImage(_key: MarketingImageKey): string | undefined {
  return undefined;
}
