import type { MetadataRoute } from 'next';
import { getBlogSlugs } from '@/lib/blog';
import { getSiteUrl } from '@/lib/urls';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes = [
    '',
    '/features',
    '/pricing',
    '/solutions/restaurants',
    '/solutions/cafes',
    '/solutions/food-trucks',
    '/solutions/bakeries',
    '/solutions/chains',
    '/solutions/hospitality',
    '/integrations',
    '/about',
    '/contact',
    '/blog',
    '/privacy',
    '/terms',
  ];

  const slugs = await getBlogSlugs();
  const blogRoutes = slugs.map((slug) => `/blog/${slug}`);

  return [...staticRoutes, ...blogRoutes].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path.startsWith('/blog') ? 'monthly' : 'weekly',
    priority: path === '' ? 1 : 0.8,
  }));
}
