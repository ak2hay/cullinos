import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Notice, Panel } from '@/components/common';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { CATEGORY_LABELS, customerApi } from '@/lib/support-api';

export function ArticlePage() {
  const { slug = '' } = useParams();
  const query = useQuery({ queryKey: ['portal', 'article', slug], queryFn: () => customerApi.article(slug), enabled: Boolean(slug) });
  const a = query.data;
  if (query.isLoading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (!a) return <Notice tone="error">{errorMessage(query.error) ?? 'Article not found'}</Notice>;
  const paragraphs = a.body.split(/\n{2,}/);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-primary">
        <ArrowLeft size={14} aria-hidden="true" />
        Support home
      </Link>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-accent">{CATEGORY_LABELS[a.category] ?? a.category}</p>
        <h1 className="font-display text-2xl font-semibold">{a.title}</h1>
        <p className="mt-1 text-xs text-text-muted">Updated {formatDate(a.updatedAt)}</p>
      </div>
      <Panel>
        <article className="space-y-4 text-sm leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {p}
            </p>
          ))}
        </article>
      </Panel>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-text-secondary">Still stuck?</span>
          <Link
            to="/tickets/new"
            className="inline-flex h-9 items-center rounded-lg bg-brand-primary px-3 text-sm font-medium text-on-brand hover:bg-brand-primary-dark"
          >
            Raise a ticket
          </Link>
        </div>
      </Panel>
    </div>
  );
}
