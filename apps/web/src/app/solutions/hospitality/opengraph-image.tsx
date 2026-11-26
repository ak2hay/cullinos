import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Hotel F&B POS';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Hotel F&B POS');
}
