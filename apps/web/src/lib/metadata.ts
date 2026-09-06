import type { Metadata } from 'next';
import { getSiteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from './urls';

export function createMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = '',
}: {
  title?: string;
  description?: string;
  path?: string;
}): Metadata {
  const siteUrl = getSiteUrl();
  const fullTitle = title ? `${title} | ${SITE_NAME} — ${SITE_TAGLINE}` : `${SITE_NAME} — ${SITE_TAGLINE}`;
  const url = `${siteUrl}${path}`;
  const ogImage = {
    url: '/opengraph-image',
    width: 1200,
    height: 630,
    alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
  };

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(siteUrl),
    alternates: { canonical: url },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_IN',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImage.url],
    },
  };
}
