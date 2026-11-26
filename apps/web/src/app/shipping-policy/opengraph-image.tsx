import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Shipping policy';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Shipping policy');
}
