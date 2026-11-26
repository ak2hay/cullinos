import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Refund policy';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Refund policy');
}
