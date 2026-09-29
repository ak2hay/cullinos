/** Public NAP — keep in sync with Google Business Profile when published. */
export const BUSINESS_NAP = {
  legalName: 'Rkyves',
  brand: 'Cullinos',
  email: 'hello@rkyves.com',
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
