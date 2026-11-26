import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Restaurant POS for full service';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Restaurant POS for full service');
}
