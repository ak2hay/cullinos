import type { Metadata } from 'next';
import { getSiteUrl, SITE_DEFAULT_TITLE, SITE_DESCRIPTION, SITE_NAME } from './urls';

export function createMetadata({
  title: pageTitle,
  description = SITE_DESCRIPTION,
  path,
}: {
  /** Used as-is when it already names Cullinos; otherwise suffixed with " | Cullinos". */
  title?: string;
  description?: string;
  /** Omit to emit no canonical (root layout, 404). Home passes ''. */
  path?: string;
}): Metadata {
  const title = !pageTitle
    ? SITE_DEFAULT_TITLE
    : pageTitle.includes('Cullinos')
      ? pageTitle
      : `${pageTitle} | Cullinos`;
  const siteUrl = getSiteUrl();
  const url = path === undefined ? undefined : `${siteUrl}${path}`;
  const ogImage = {
    url: '/opengraph-image',
    width: 1200,
    height: 630,
    alt: SITE_DEFAULT_TITLE,
  };

  return {
    title,
    description,
    metadataBase: new URL(siteUrl),
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      title,
      description,
      ...(url ? { url } : {}),
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_IN',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage.url],
    },
  };
}
