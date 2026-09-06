import { CULLINOS_BRAND } from '@cullinos/shared';
import { BUSINESS_ADDRESS_LINE, BUSINESS_NAP } from '@/lib/business';
import { getSiteUrl } from '@/lib/urls';

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BUSINESS_NAP.legalName,
    url: getSiteUrl(),
    email: BUSINESS_NAP.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: BUSINESS_NAP.addressLocality,
      addressRegion: BUSINESS_NAP.addressRegion,
      addressCountry: BUSINESS_NAP.addressCountry,
    },
    brand: {
      '@type': 'Brand',
      name: BUSINESS_NAP.brand,
      slogan: CULLINOS_BRAND.tagline,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: CULLINOS_BRAND.name,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: CULLINOS_BRAND.tagline,
    url: getSiteUrl(),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: '999',
    },
    provider: {
      '@type': 'Organization',
      name: BUSINESS_NAP.legalName,
      email: BUSINESS_NAP.email,
      address: {
        '@type': 'PostalAddress',
        addressLocality: BUSINESS_NAP.addressLocality,
        addressCountry: BUSINESS_NAP.addressCountry,
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BUSINESS_NAP.brand,
    url: getSiteUrl(),
    description: CULLINOS_BRAND.tagline,
    publisher: {
      '@type': 'Organization',
      name: BUSINESS_NAP.legalName,
      email: BUSINESS_NAP.email,
      address: BUSINESS_ADDRESS_LINE,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
