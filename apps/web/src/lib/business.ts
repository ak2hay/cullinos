/** Public NAP — keep in sync with Google Business Profile when published. */
export const BUSINESS_NAP = {
  legalName: 'Rkyves',
  brand: 'Cullinos',
  email: 'cullinos@rkyves.com',
  addressLocality: 'Mumbai',
  addressRegion: 'Maharashtra',
  addressCountry: 'IN',
  addressCountryName: 'India',
  /** Keep in sync with Google Business Profile when published. */
  streetAddress: null as string | null,
  telephone: '+91 7666071619',
} as const;

export const BUSINESS_ADDRESS_LINE = `${BUSINESS_NAP.addressLocality}, ${BUSINESS_NAP.addressCountryName}`;

export const MAPS_EMBED_QUERY = encodeURIComponent(
  `${BUSINESS_NAP.addressLocality}, ${BUSINESS_NAP.addressCountryName}`,
);

export const WHATSAPP_E164 = '917666071619';
export const WHATSAPP_PREFILL =
  "Hi Cullinos, I'd like to know about restaurant POS and GST billing.";

export function whatsappHref(message: string = WHATSAPP_PREFILL): string {
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(message)}`;
}

const RETIRED_PUBLIC_EMAILS = new Set(['hello@rkyves.com', 'hello@cullinos.com']);

/** Public inbox. A stored hello@ address is treated as retired. */
export function resolvePublicEmail(candidate?: string | null): string {
  const value = candidate?.trim();
  if (!value || RETIRED_PUBLIC_EMAILS.has(value.toLowerCase())) return BUSINESS_NAP.email;
  return value;
}
