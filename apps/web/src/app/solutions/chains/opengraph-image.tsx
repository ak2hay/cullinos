import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Multi-outlet restaurant POS';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Multi-outlet restaurant POS');
}
