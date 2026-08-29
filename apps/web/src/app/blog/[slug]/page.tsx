import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Hero } from '@/components/marketing/Hero';
import { Section } from '@/components/marketing/Section';
import { getBlogPost, getBlogSlugs } from '@/lib/blog';
import { createMetadata } from '@/lib/metadata';

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return {};

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
