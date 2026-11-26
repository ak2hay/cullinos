import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Built in Mumbai by Rkyves';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Built in Mumbai by Rkyves');
}
