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
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  };
}
