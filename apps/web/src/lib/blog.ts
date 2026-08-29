import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { MARKETING_API_BASE } from '@/lib/marketing-content';

const contentDirectory = path.join(process.cwd(), 'content/blog');

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
  content: string;
  coverUrl?: string | null;
}

function getLocalBlogPosts(): BlogPost[] {
  if (!fs.existsSync(contentDirectory)) {
    return [];
  }

  const files = fs.readdirSync(contentDirectory).filter((file) => file.endsWith('.mdx'));

  return files
    .map((filename) => {
      const slug = filename.replace(/\.mdx$/, '');
      const raw = fs.readFileSync(path.join(contentDirectory, filename), 'utf8');
      const { data, content } = matter(raw);

      return {
        slug,
        title: String(data.title ?? slug),
        date: String(data.date ?? ''),
        excerpt: String(data.excerpt ?? ''),
        content,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

async function fetchCmsBlogPosts(): Promise<BlogPost[]> {
  try {
    const res = await fetch(`${MARKETING_API_BASE}/public/marketing/blog`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{
      slug: string;
      title: string;
      excerpt: string;
      publishedAt?: string | null;
      coverAsset?: { url?: string | null } | null;
    }>;
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      date: row.publishedAt ? String(row.publishedAt).slice(0, 10) : '',
      excerpt: row.excerpt,
      content: '',
      coverUrl: row.coverAsset?.url,
    }));
  } catch {
    return [];
  }
}

async function fetchCmsBlogPost(slug: string): Promise<BlogPost | undefined> {
  try {
    const res = await fetch(`${MARKETING_API_BASE}/public/marketing/blog/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return undefined;
    const row = (await res.json()) as {
      slug: string;
      title: string;
      excerpt: string;
      body: string;
      publishedAt?: string | null;
      coverAsset?: { url?: string | null } | null;
    };
    return {
      slug: row.slug,
      title: row.title,
      date: row.publishedAt ? String(row.publishedAt).slice(0, 10) : '',
      excerpt: row.excerpt,
      content: row.body,
      coverUrl: row.coverAsset?.url,
    };
  } catch {
    return undefined;
  }
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const cmsPosts = await fetchCmsBlogPosts();
  if (cmsPosts.length) return cmsPosts;
  return getLocalBlogPosts();
}

export async function getBlogPost(slug: string): Promise<BlogPost | undefined> {
  const cmsPost = await fetchCmsBlogPost(slug);
  if (cmsPost) return cmsPost;
  return getLocalBlogPosts().find((post) => post.slug === slug);
}

export async function getBlogSlugs(): Promise<string[]> {
  const posts = await getBlogPosts();
  return posts.map((post) => post.slug);
}

/** @deprecated Use async getBlogPosts */
export function getBlogPostsSync(): BlogPost[] {
  return getLocalBlogPosts();
}

/** @deprecated Use async getBlogPost */
export function getBlogPostSync(slug: string): BlogPost | undefined {
  return getLocalBlogPosts().find((post) => post.slug === slug);
}

/** @deprecated Use async getBlogSlugs */
export function getBlogSlugsSync(): string[] {
  return getLocalBlogPosts().map((post) => post.slug);
}
