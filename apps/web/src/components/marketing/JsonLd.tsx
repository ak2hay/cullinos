import { CULLINOS_BRAND } from '@cullinos/shared';
import { getSiteUrl } from '@/lib/urls';

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: CULLINOS_BRAND.parent,
    url: getSiteUrl(),
    brand: {
      '@type': 'Brand',
      name: CULLINOS_BRAND.name,
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
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: '999',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
