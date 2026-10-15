import { isContactPricing, MARKETING_PLANS } from '@cullinos/shared';
import { BUSINESS_NAP } from '@/lib/business';
import { getSiteUrl } from '@/lib/urls';

const ORG_URL = 'https://www.rkyves.com';
const CONFIRMED_FEATURES = [
  'POS billing',
  'Kitchen display system (KDS)',
  'QR table ordering',
  'Inventory and live stock',
  'Low-stock alerts',
  'Wastage log',
  'Recipe-wise food cost',
];

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', ...data }) }}
    />
  );
}

/** Home is prepended; pass the trail below it. */
export function BreadcrumbJsonLd({ trail }: { trail: { name: string; path: string }[] }) {
  const siteUrl = getSiteUrl();
  return (
    <JsonLd
      data={{
        '@type': 'BreadcrumbList',
        itemListElement: [{ name: 'Home', path: '' }, ...trail].map((crumb, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: crumb.name,
          item: `${siteUrl}${crumb.path}`,
        })),
      }}
    />
  );
}

export function SiteJsonLd() {
  const siteUrl = getSiteUrl();
  const logo = `${siteUrl}/apple-touch-icon.png`;
  const prices = MARKETING_PLANS.filter((p) => !isContactPricing(p)).map((p) => p.priceMonthly / 100);
  const org = { '@id': `${ORG_URL}/#org` };
  const brand = { '@id': `${siteUrl}/#brand` };
  const country = { '@type': 'Country', name: BUSINESS_NAP.addressCountryName };

  return (
    <JsonLd
      data={{
        '@graph': [
          {
            '@type': 'Organization',
            ...org,
            name: BUSINESS_NAP.legalName,
            alternateName: ['Rkyves', 'Rkyves – makers of Cullinos'],
            url: ORG_URL,
            logo,
            email: BUSINESS_NAP.email,
            telephone: BUSINESS_NAP.telephone.replace(/\s/g, ''),
            address: { '@type': 'PostalAddress', addressCountry: BUSINESS_NAP.addressCountry },
            areaServed: country,
            sameAs: [BUSINESS_NAP.linkedin, BUSINESS_NAP.instagram],
            brand,
          },
          {
            '@type': 'Brand',
            ...brand,
            name: BUSINESS_NAP.brand,
            alternateName: [
              BUSINESS_NAP.brandLine,
              'Cullinos POS',
              'Culinos',
              'Cullinoss',
              'Cullinose',
              'Culinous',
              'Kullinos',
              'Cullino',
            ],
            url: siteUrl,
            logo,
            slogan: 'Restaurant OS for India',
          },
          {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            name: BUSINESS_NAP.brandLine,
            alternateName: BUSINESS_NAP.brand,
            url: siteUrl,
            inLanguage: 'en-IN',
            publisher: org,
          },
          {
            '@type': 'SoftwareApplication',
            '@id': `${siteUrl}/#software`,
            name: BUSINESS_NAP.brand,
            alternateName: ['Cullinos POS', BUSINESS_NAP.brandLine, 'Culinos', 'Culinos POS', 'Cullinose', 'Kullinos'],
            applicationCategory: 'BusinessApplication',
            applicationSubCategory: 'Restaurant POS',
            operatingSystem: 'Web',
            url: siteUrl,
            description:
              'Cullinos, by Rkyves, is a restaurant OS for restaurants across India: POS billing, kitchen display (KDS), QR table ordering, inventory with live stock, low-stock alerts, wastage log and recipe-wise food cost.',
            featureList: CONFIRMED_FEATURES,
            areaServed: country,
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'INR',
              lowPrice: String(Math.min(...prices)),
              highPrice: String(Math.max(...prices)),
              offerCount: String(prices.length),
            },
            provider: org,
            brand,
          },
        ],
      }}
    />
  );
}
