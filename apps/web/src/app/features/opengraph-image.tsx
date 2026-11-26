import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — POS, KOT, kitchen display, and GST billing';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('POS, KOT, kitchen display, and GST billing');
}
