import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Restaurant billing software in Mumbai';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Restaurant billing software in Mumbai');
}
