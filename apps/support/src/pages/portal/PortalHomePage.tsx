import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, LifeBuoy, ListChecks, Search } from 'lucide-react';
import { Panel, StatusBadge } from '@/components/common';
import { relativeTime } from '@/lib/format';
import { CATEGORY_LABELS, customerApi } from '@/lib/support-api';
import { useSession } from '@/stores/session';

export function PortalHomePage() {
  const user = useSession((s) => s.user);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const articles = useQuery({ queryKey: ['portal', 'articles', debounced], queryFn: () => customerApi.articles({ q: debounced || undefined }) });
  const open = useQuery({ queryKey: ['portal', 'tickets', 'open'], queryFn: () => customerApi.tickets({ status: 'open' }) });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line-subtle bg-gradient-to-br from-accent/15 via-accent/5 to-transparent px-6 py-10 text-center">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">How can we help{user?.name ? `, ${user.name.split(' ')[0]}` : ''}?</h1>
        <p className="mt-2 text-sm text-text-secondary">Search help articles, or raise a ticket and our team will get back to you.</p>
        <div className="relative mx-auto mt-5 max-w-xl">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search for answers: printer, GST, menu import…"
            className="h-12 w-full rounded-xl border border-line bg-bg-card pl-11 pr-4 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/tickets/new" className="flex items-start gap-3 rounded-xl border border-line-subtle bg-bg-card p-4 transition hover:border-accent">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <LifeBuoy size={20} aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold">Raise a ticket</span>
            <span className="block text-sm text-text-secondary">Report an issue or ask a question</span>
          </span>
        </Link>
        <Link to="/tickets" className="flex items-start gap-3 rounded-xl border border-line-subtle bg-bg-card p-4 transition hover:border-accent">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
            <ListChecks size={20} aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold">My tickets</span>
            <span className="block text-sm text-text-secondary">{open.data ? `${open.data.length} open` : 'Track your requests'}</span>
          </span>
        </Link>
        <a href="#articles" className="flex items-start gap-3 rounded-xl border border-line-subtle bg-bg-card p-4 transition hover:border-accent">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300">
            <BookOpen size={20} aria-hidden="true" />
          </span>
          <span>
            <span className="block font-semibold">Knowledge base</span>
            <span className="block text-sm text-text-secondary">Guides and answers</span>
          </span>
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div id="articles" className="lg:col-span-2">
          <Panel title={debounced ? `Articles matching "${debounced}"` : 'Popular articles'} flush>
            <ul className="divide-y divide-line-subtle">
              {(articles.data ?? []).map((a) => (
                <li key={a.id}>
                  <Link to={`/kb/${a.slug}`} className="block px-4 py-3 hover:bg-hover">
                    <p className="font-medium">{a.title}</p>
                    <p className="line-clamp-1 text-sm text-text-secondary">{a.summary ?? CATEGORY_LABELS[a.category] ?? a.category}</p>
                  </Link>
                </li>
              ))}
            </ul>
            {!articles.isLoading && (articles.data ?? []).length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-text-muted">
                No articles found.{' '}
                <Link to="/tickets/new" className="text-accent hover:underline">
                  Raise a ticket
                </Link>{' '}
                instead.
              </div>
            ) : null}
          </Panel>
        </div>
        <Panel title="Your open tickets" flush>
          <ul className="divide-y divide-line-subtle">
            {(open.data ?? []).slice(0, 6).map((t) => (
              <li key={t.id}>
                <Link to={`/tickets/${t.id}`} className="block px-4 py-3 hover:bg-hover">
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                    <StatusBadge status={t.status} />
                    {t.ref} · {relativeTime(t.updatedAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {!open.isLoading && (open.data ?? []).length === 0 ? <p className="px-4 py-8 text-center text-sm text-text-muted">No open tickets.</p> : null}
        </Panel>
      </div>
    </div>
  );
}
