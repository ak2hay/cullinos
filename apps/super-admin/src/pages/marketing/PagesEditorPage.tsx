import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { marketingApi } from '@/lib/marketing-api';

type PageRow = {
  id: string;
  slug: string;
  title: string;
  blocks?: Array<{ id: string; blockKey: string; content: unknown; sortOrder: number }>;
};

export function PagesEditorPage() {
  const queryClient = useQueryClient();
  const [selectedSlug, setSelectedSlug] = useState('home');
  const [blockKey, setBlockKey] = useState('elevatorPitch');
  const [json, setJson] = useState('{\n  "title": "",\n  "body": ""\n}');

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['marketing', 'pages'],
    queryFn: () => marketingApi.listPages('draft'),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const content = JSON.parse(json) as unknown;
      return marketingApi.upsertPageBlock(selectedSlug, blockKey, content);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'pages'] }),
  });

  const page = (pages as PageRow[]).find((p) => p.slug === selectedSlug);
  const block = page?.blocks?.find((b) => b.blockKey === blockKey);

  function loadBlock(key: string) {
    setBlockKey(key);
    const existing = page?.blocks?.find((b) => b.blockKey === key);
    setJson(JSON.stringify(existing?.content ?? { title: '', body: '' }, null, 2));
  }

  if (isLoading) return <p className="text-text-muted">Loading pages…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pages & blocks</h1>
        <p className="mt-1 text-text-secondary">Edit structured content blocks per page (draft).</p>
      </div>

      <div className="flex flex-wrap gap-3">
        {(pages as PageRow[]).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setSelectedSlug(p.slug);
              loadBlock(blockKey);
            }}
            className={`rounded-lg border px-4 py-2 text-sm ${
              selectedSlug === p.slug
                ? 'border-brand-primary bg-brand-primary/10'
                : 'border-white/10 hover:bg-white/5'
            }`}
          >
            {p.title || p.slug}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelectedSlug('home')}
          className="rounded-lg border border-dashed border-white/20 px-4 py-2 text-sm text-text-muted"
        >
          + home (on save)
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          <p className="text-sm font-medium">Block key</p>
          {['elevatorPitch', 'trustPillars', 'ctaBanner', 'featureIntro'].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => loadBlock(key)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                blockKey === key ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              {key}
            </button>
          ))}
          {block ? (
            <p className="pt-2 text-xs text-text-muted">Editing existing draft block</p>
          ) : (
            <p className="pt-2 text-xs text-text-muted">New block will be created on save</p>
          )}
        </div>

        <form
          className="space-y-3 rounded-xl border border-white/10 bg-bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <p className="text-sm text-text-muted">
            Page: <span className="text-text-primary">{selectedSlug}</span> · Block:{' '}
            <span className="text-text-primary">{blockKey}</span>
          </p>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={16}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 font-mono text-xs"
          />
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving…' : 'Save block'}
          </button>
          {saveMutation.error ? (
            <p className="text-sm text-status-error">{String(saveMutation.error.message)}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
