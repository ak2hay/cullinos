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
  /** Calling number. */
  telephone: '+91 7499249403',
  /** WhatsApp number (chat only). */
  whatsapp: '+91 7666071619',
} as const;

const digitsOnly = (value: string) => value.replace(/\D/g, '');

export const BUSINESS_ADDRESS_LINE = `${BUSINESS_NAP.addressLocality}, ${BUSINESS_NAP.addressCountryName}`;

export const MAPS_EMBED_QUERY = encodeURIComponent(
  `${BUSINESS_NAP.addressLocality}, ${BUSINESS_NAP.addressCountryName}`,
);

/** Digits-only WhatsApp number for wa.me (no leading +). */
export const WHATSAPP_E164 = digitsOnly(BUSINESS_NAP.whatsapp);

export const WHATSAPP_PREFILL =
  "Hi Cullinos, I'd like to know about restaurant POS and GST billing.";

export function whatsappHref(message: string = WHATSAPP_PREFILL): string {
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(message)}`;
}

export const BUSINESS_TEL_HREF = `tel:+${digitsOnly(BUSINESS_NAP.telephone)}`;

export const BUSINESS_WHATSAPP_HREF = whatsappHref();

export const BUSINESS_MAILTO_HREF = `mailto:${BUSINESS_NAP.email}`;

const RETIRED_PUBLIC_EMAILS = new Set(['hello@rkyves.com', 'hello@cullinos.com']);

/** Public inbox. A stored hello@ address is treated as retired. */
export function resolvePublicEmail(candidate?: string | null): string {
  const value = candidate?.trim();
  if (!value || RETIRED_PUBLIC_EMAILS.has(value.toLowerCase())) return BUSINESS_NAP.email;
  return value;
}
