import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Drawer } from '@cullinos/ui';
import { EmptyRow, Label, Notice, inputClass, textareaClass } from '@/components/common';
import { errorMessage } from '@/lib/api';
import { relativeTime } from '@/lib/format';
import { CATEGORY_LABELS, agentApi, type Article, type ArticleInput } from '@/lib/support-api';
import { useCanAgent } from '@/stores/session';

const EMPTY: ArticleInput = { title: '', slug: '', summary: '', body: '', category: 'general', published: false };

export function AgentKnowledgePage() {
  const qc = useQueryClient();
  const can = useCanAgent();
  const canWrite = can('tickets.write');
  const list = useQuery({ queryKey: ['agent', 'articles'], queryFn: agentApi.articles });
  const [editing, setEditing] = useState<Article | 'new' | null>(null);
  const [form, setForm] = useState<ArticleInput>(EMPTY);

  const save = useMutation({
    mutationFn: () => (editing && editing !== 'new' ? agentApi.updateArticle(editing.id, form) : agentApi.createArticle(form)),
    onSuccess: () => {
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['agent', 'articles'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => agentApi.deleteArticle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent', 'articles'] }),
  });

  function open(a: Article | 'new') {
    save.reset();
    setForm(
      a === 'new'
        ? EMPTY
        : { title: a.title, slug: a.slug, summary: a.summary ?? '', body: a.body, category: a.category, published: a.published },
    );
    setEditing(a);
  }

  const set = <K extends keyof ArticleInput>(k: K, v: ArticleInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Knowledge base</h1>
          <p className="text-sm text-text-secondary">Published articles appear on the restaurant support portal home and search.</p>
        </div>
        {canWrite ? (
          <Button size="sm" className="gap-1.5" onClick={() => open('new')}>
            <Plus size={15} aria-hidden="true" />
            New article
          </Button>
        ) : null}
      </div>
      {list.error ? <Notice tone="error">{errorMessage(list.error)}</Notice> : null}
      <div className="overflow-hidden rounded-xl border border-line-subtle bg-bg-card">
        <ul className="divide-y divide-line-subtle">
          {(list.data ?? []).map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.title}</p>
                <p className="truncate text-xs text-text-muted">
                  {CATEGORY_LABELS[a.category] ?? a.category} · /{a.slug} · {a.viewCount} views · updated {relativeTime(a.updatedAt)}
                </p>
              </div>
              <span
                className={
                  a.published
                    ? 'rounded-md bg-status-success/12 px-2 py-0.5 text-xs font-semibold text-status-success'
                    : 'rounded-md bg-slate-500/12 px-2 py-0.5 text-xs font-semibold text-text-muted'
                }
              >
                {a.published ? 'Published' : 'Draft'}
              </span>
              {canWrite ? (
                <>
                  <button type="button" aria-label="Edit" onClick={() => open(a)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-hover">
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => {
                      if (window.confirm(`Delete "${a.title}"?`)) remove.mutate(a.id);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-status-error hover:bg-hover"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {!list.isLoading && (list.data ?? []).length === 0 ? <EmptyRow>No articles yet.</EmptyRow> : null}
      </div>

      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New article' : 'Edit article'}
        width="xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={save.isPending} disabled={!form.title.trim() || !form.body.trim()} onClick={() => save.mutate()}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Label label="Title">
            <input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} />
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label label="Slug" hint="Leave blank to generate from the title.">
              <input className={inputClass} value={form.slug ?? ''} onChange={(e) => set('slug', e.target.value)} />
            </Label>
            <Label label="Category">
              <select className={inputClass} value={form.category} onChange={(e) => set('category', e.target.value)}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Label>
          </div>
          <Label label="Summary">
            <input className={inputClass} value={form.summary ?? ''} onChange={(e) => set('summary', e.target.value)} />
          </Label>
          <Label label="Body" hint="Plain text. Blank lines separate paragraphs.">
            <textarea className={`${textareaClass} min-h-72 font-mono`} value={form.body} onChange={(e) => set('body', e.target.value)} />
          </Label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={Boolean(form.published)} onChange={(e) => set('published', e.target.checked)} />
            Published (visible to restaurants)
          </label>
          {save.error ? <Notice tone="error">{errorMessage(save.error)}</Notice> : null}
        </div>
      </Drawer>
    </div>
  );
}
