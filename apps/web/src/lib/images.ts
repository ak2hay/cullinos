import { MARKETING_IMAGES, type MarketingImageKey } from '@cullinos/shared';
import { getBundledMarketingImage } from '@/lib/marketing-assets';

export function getMarketingImage(key: MarketingImageKey): string {
  return getBundledMarketingImage(key) ?? MARKETING_IMAGES[key];
}

export function isRemoteImage(src: string): boolean {
  return src.startsWith('http');
}

export function isLocalMarketingImage(src: string): boolean {
  return src.startsWith('/images/') || src.startsWith('/cms/');
}

export function isBundledImage(src: string): boolean {
  return src.startsWith('/_next/static/') || src.includes('/_next/static/media/');
}

export function shouldOptimizeImage(src: string): boolean {
  return isRemoteImage(src) || isLocalMarketingImage(src);
}
