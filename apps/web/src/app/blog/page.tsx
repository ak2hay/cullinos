import Link from 'next/link';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { getBlogPosts } from '@/lib/blog';
import { createMetadata } from '@/lib/metadata';

export const metadata = createMetadata({
  title: 'Blog',
  description: 'News and updates from the Cullinos team.',
  path: '/blog',
});

export default function BlogPage() {
  const posts = getBlogPosts();

  return (
    <>
      <Hero
        eyebrow="Blog"
        title="Updates from Cullinos"
        subtitle="Product news, restaurant operations insights, and platform updates."
        primaryCta={{ label: 'Start free trial', href: 'https://admin.cullinos.com/register' }}
        secondaryCta={{ label: 'Subscribe via RSS', href: '/blog/rss.xml' }}
      />
      <Section title="Latest posts">
        {posts.length === 0 ? (
          <p className="text-text-secondary">More posts coming soon.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="rounded-2xl border border-border-light bg-bg-card p-6 shadow-card transition hover:border-brand-gold/40"
              >
                <time className="text-xs text-text-muted">{post.date}</time>
                <h3 className="mt-2 text-lg font-semibold">
                  <Link href={`/blog/${post.slug}`} className="hover:text-brand-gold">
                    {post.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-text-secondary">{post.excerpt}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-4 inline-block text-sm font-medium text-brand-gold hover:underline"
                >
                  Read more →
                </Link>
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
