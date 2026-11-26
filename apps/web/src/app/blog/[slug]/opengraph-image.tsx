import { getBlogPost } from '@/lib/blog';
import { ogContentType, ogSize, renderOgImage } from '@/lib/og-image';

export const alt = 'Cullinos blog';
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  return renderOgImage(post?.title ?? 'Cullinos blog', 'Cullinos blog');
}
