/** Public NAP — keep in sync with Google Business Profile when published. */
export const BUSINESS_NAP = {
  legalName: 'Rkyves',
  brand: 'Cullinos',
  brandLine: 'Cullinos, by Rkyves',
  email: 'hello@rkyves.com',
  addressCountry: 'IN',
  addressCountryName: 'India',
  telephone: '+91 76660 71619',
  linkedin: 'https://www.linkedin.com/company/145224209/',
  instagram: 'https://www.instagram.com/rkyves_com/',
} as const;

export const BUSINESS_ADDRESS_LINE = BUSINESS_NAP.addressCountryName;

export const BUSINESS_SERVICE_AREA = 'Built in India, for restaurants across India';
