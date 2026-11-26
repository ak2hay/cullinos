import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Cloud kitchen POS';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Cloud kitchen POS');
}
