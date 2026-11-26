import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Delete your account';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Delete your account');
}
