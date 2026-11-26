import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Food truck POS';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Food truck POS');
}
