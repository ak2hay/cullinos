import type { MetadataRoute } from 'next';
import { getBlogPosts } from '@/lib/blog';
import { COMPARE_PAGES } from '@/lib/compare-pages';
import { FEATURE_PAGE_SLUGS } from '@/lib/feature-pages';
import { getSiteUrl } from '@/lib/urls';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes = [
    '',
    '/features',
    ...FEATURE_PAGE_SLUGS.map((slug) => `/features/${slug}`),
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
    '/faq',
    '/blog',
    '/compare',
    ...COMPARE_PAGES.map((p) => `/compare/${p.slug}`),
    '/privacy',
    '/terms',
  ];

  const posts = await getBlogPosts();

  return [
    ...staticRoutes.map((path) => ({
      url: `${siteUrl}${path}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.8,
    })),
    ...posts.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: Number.isNaN(Date.parse(post.date)) ? now : new Date(post.date),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
