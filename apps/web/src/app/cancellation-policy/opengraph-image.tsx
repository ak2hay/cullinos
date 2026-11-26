import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Cancellation policy';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Cancellation policy');
}
