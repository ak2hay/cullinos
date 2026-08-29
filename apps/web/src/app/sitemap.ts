import type { MetadataRoute } from 'next';
import { getBlogSlugs } from '@/lib/blog';
import { getSiteUrl } from '@/lib/urls';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes = [
    '',
    '/features',
    '/pricing',
    '/solutions/restaurants',
    '/solutions/chains',
    '/solutions/hospitality',
    '/integrations',
    '/about',
    '/contact',
    '/blog',
    '/privacy',
    '/terms',
  ];

  const blogRoutes = getBlogSlugs().map((slug) => `/blog/${slug}`);

  return [...staticRoutes, ...blogRoutes].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path.startsWith('/blog') ? 'monthly' : 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));
}
