import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Questions about GST billing and POS';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Questions about GST billing and POS');
}
