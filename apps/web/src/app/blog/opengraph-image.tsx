import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Notes on restaurant billing and KOT';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Notes on restaurant billing and KOT');
}
