import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, cn } from '@cullinos/ui';
import { PageHeader, PageTabs, SectionCard, StatusPill } from '@/components/ui';
import { inputClass, MutationError } from '@/components/common';
import { marketingApi } from '@/lib/marketing-api';

type PageRow = {
  id: string;
  slug: string;
  title: string;
  blocks?: Array<{ id: string; blockKey: string; content: unknown; sortOrder: number }>;
};

const BLOCK_KEYS = ['elevatorPitch', 'trustPillars', 'ctaBanner', 'featureIntro'];

function jsonError(text: string): string | null {
  try {
    JSON.parse(text);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid JSON';
  }
}

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

  const rows = pages as PageRow[];
  const page = rows.find((p) => p.slug === selectedSlug);
  const block = page?.blocks?.find((b) => b.blockKey === blockKey);
  const parseError = jsonError(json);

  function loadBlock(key: string, slug = selectedSlug) {
    setBlockKey(key);
    const existing = rows.find((p) => p.slug === slug)?.blocks?.find((b) => b.blockKey === key);
    setJson(JSON.stringify(existing?.content ?? { title: '', body: '' }, null, 2));
  }

  const pageTabs = rows.some((p) => p.slug === 'home')
    ? rows.map((p) => ({ id: p.slug, label: p.title || p.slug }))
    : [{ id: 'home', label: 'home (new)' }, ...rows.map((p) => ({ id: p.slug, label: p.title || p.slug }))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pages & blocks"
        description={
          <>
            Edit structured content blocks per page (draft). Prefer small JSON objects with <code className="text-xs">title</code> and{' '}
            <code className="text-xs">body</code>. Publish from Marketing overview to go live.
          </>
        }
      />

      {isLoading ? (
        <div className="h-96 animate-pulse rounded-xl bg-bg-secondary" />
      ) : (
        <>
          <PageTabs
            label="Pages"
            value={selectedSlug}
            onChange={(slug) => {
              setSelectedSlug(slug);
              loadBlock(blockKey, slug);
            }}
            tabs={pageTabs}
          />

          <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
            <nav aria-label="Blocks" className="rounded-xl border border-line-subtle bg-bg-card p-2">
              <p className="px-3 pb-1 pt-2 text-xs font-medium text-text-muted">Blocks</p>
              {BLOCK_KEYS.map((key) => {
                const exists = page?.blocks?.some((b) => b.blockKey === key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => loadBlock(key)}
                    aria-current={blockKey === key ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left font-mono text-xs',
                      blockKey === key ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-hover',
                    )}
                  >
                    {key}
                    {exists ? <span className="h-1.5 w-1.5 rounded-full bg-status-success" aria-label="Has draft" /> : null}
                  </button>
                );
              })}
            </nav>

            <SectionCard
              title={
                <span className="font-mono text-sm">
                  {selectedSlug} / {blockKey}
                </span>
              }
              actions={<StatusPill status={block ? 'draft' : 'new'} tone={block ? 'info' : 'neutral'} label={block ? 'Existing draft' : 'New block'} />}
            >
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveMutation.mutate();
                }}
              >
                <textarea
                  aria-label="Block JSON"
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  rows={16}
                  spellCheck={false}
                  className={cn(inputClass, 'font-mono text-xs', parseError && 'border-status-error focus:border-status-error focus:ring-status-error/20')}
                />
                {parseError ? <p className="text-xs text-status-error">{parseError}</p> : null}
                <div className="flex items-center gap-3">
                  <Button type="submit" size="sm" loading={saveMutation.isPending} disabled={Boolean(parseError)}>
                    Save block
                  </Button>
                  <MutationError error={saveMutation.error} />
                </div>
              </form>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
