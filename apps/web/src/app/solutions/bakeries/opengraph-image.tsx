import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Bakery POS and production';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Bakery POS and production');
}
