import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Terms of use';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Terms of use');
}
