import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Book a conversation';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Book a conversation');
}
