import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Talk to Cullinos';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Talk to Cullinos');
}
