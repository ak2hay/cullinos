import { MARKETING_IMAGES, type MarketingImageKey } from '@cullinos/shared';

export function getMarketingImage(key: MarketingImageKey): string {
  return MARKETING_IMAGES[key];
}

export function isRemoteImage(src: string): boolean {
  return src.startsWith('http');
}
