import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos — Restaurant POS & GST Billing Software';
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return renderOgImage('Billing, KOT and online orders in one app.');
}
