import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Razorpay and MSG91';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Razorpay and MSG91');
}
