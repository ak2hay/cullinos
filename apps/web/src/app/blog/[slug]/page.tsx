import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { BreadcrumbJsonLd } from '@/components/marketing/JsonLd';
import { getBlogPost, getBlogSlugs } from '@/lib/blog';
import { createMetadata } from '@/lib/metadata';

// notFound() on an on-demand slug still answered 200; unknown slugs must 404 at the router.
// shortcut: CMS posts published after a build 404 until the next web deploy, switch to a slug check in middleware once the CMS blog is used.
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  return createMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${slug}`,
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <BreadcrumbJsonLd
        trail={[
          { name: 'Blog', path: '/blog' },
          { name: post.title, path: `/blog/${slug}` },
        ]}
      />
      <Hero
        eyebrow={post.date}
        title={post.title}
        subtitle={post.excerpt}
        primaryCta={{ label: '← All posts', href: '/blog' }}
        secondaryCta={null}
      />
      <Section title="">
        <article className="prose-marketing mx-auto max-w-3xl">
          <ReactMarkdown
            components={{
              a: ({ href, children }) => {
                const isExternal = href?.startsWith('http');
                if (isExternal) {
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  );
                }
                return <Link href={href ?? '#'}>{children}</Link>;
              },
            }}
          >
            {post.content}
          </ReactMarkdown>
        </article>
      </Section>
    </>
  );
}
