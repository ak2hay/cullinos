import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — KOT software for restaurants';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('KOT software for restaurants');
}
