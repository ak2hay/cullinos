import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Plans from one outlet to hospitality';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Plans from one outlet to hospitality');
}
