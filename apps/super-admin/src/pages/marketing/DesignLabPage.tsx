import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Copy, Palette, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@cullinos/ui';
import { Card, EmptyState, FilterSelect, PageHeader, SectionCard, StatusPill } from '@/components/ui';
import { inputClass, MutationError } from '@/components/common';
import { MARKETING_IMAGE_SLOTS, marketingApi } from '@/lib/marketing-api';

const TONES = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'enterprise', label: 'Enterprise' },
];

export function DesignLabPage() {
  const queryClient = useQueryClient();
  const [tone, setTone] = useState('friendly');
  const [slotKey, setSlotKey] = useState('heroRestaurant');
  const [copyPage, setCopyPage] = useState('home');
  const [copied, setCopied] = useState(false);

  const { data: presets = [], isLoading: presetsLoading } = useQuery({
    queryKey: ['marketing', 'presets'],
    queryFn: marketingApi.listPresets,
  });

  const applyMutation = useMutation({
    mutationFn: marketingApi.applyPreset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'theme'] }),
  });
  const seedPresetsMutation = useMutation({
    mutationFn: marketingApi.seedPresets,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'presets'] }),
  });

  const copyQuery = useQuery({
    queryKey: ['marketing', 'suggest-copy', copyPage, tone],
    queryFn: () => marketingApi.suggestCopy(copyPage, tone),
    enabled: false,
  });
  const promptQuery = useQuery({
    queryKey: ['marketing', 'suggest-prompt', slotKey, tone],
    queryFn: () => marketingApi.suggestImagePrompt(slotKey, tone),
    enabled: false,
  });

  const prompt = promptQuery.data ? String(promptQuery.data.prompt ?? '') : '';

  return (
    <div className="space-y-6">
      <PageHeader title="Design lab" description="Apply theme presets, get copy suggestions, and copy AI image prompts." />

      <SectionCard
        title="Theme presets"
        description="Applying a preset overwrites the theme draft; publish the site to make it live."
        actions={
          <Button size="sm" variant="secondary" loading={seedPresetsMutation.isPending} onClick={() => seedPresetsMutation.mutate()}>
            Seed presets
          </Button>
        }
      >
        <MutationError error={applyMutation.error ?? seedPresetsMutation.error} />
        {applyMutation.isSuccess ? <p className="mb-3 text-sm text-status-success">Preset applied to theme draft.</p> : null}
        {presetsLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-bg-secondary" />
            ))}
          </div>
        ) : presets.length === 0 ? (
          <EmptyState icon={Palette} title="No presets yet" description="Seed the built-in presets to get started." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {presets.map((preset) => (
              <Card key={String(preset.slug)} className="flex flex-col p-4 shadow-none">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{String(preset.name)}</p>
                  <StatusPill status="tone" tone="neutral" dot={false} label={String(preset.copyTone)} />
                </div>
                <p className="mt-1 flex-1 text-sm text-text-secondary">{String(preset.description ?? '')}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-4 self-start"
                  disabled={applyMutation.isPending}
                  onClick={() => applyMutation.mutate(String(preset.slug))}
                >
                  Apply to theme draft
                </Button>
              </Card>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Copy suggestions" description="Headline, subline and CTA ideas for a page.">
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              aria-label="Page"
              value={copyPage}
              onChange={(e) => setCopyPage(e.target.value)}
              options={[
                { value: 'home', label: 'Home' },
                { value: 'pricing', label: 'Pricing' },
                { value: 'features', label: 'Features' },
              ]}
            />
            <FilterSelect aria-label="Tone" value={tone} onChange={(e) => setTone(e.target.value)} options={TONES} />
            <Button size="sm" loading={copyQuery.isFetching} onClick={() => copyQuery.refetch()}>
              <Sparkles size={16} aria-hidden="true" />
              Generate
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {(copyQuery.data ?? []).map((item) => (
              <div key={String(item.id)} className="rounded-xl border border-line-subtle bg-bg-secondary p-4 text-sm">
                <p className="font-medium">{String(item.headline)}</p>
                <p className="mt-1 text-text-secondary">{String(item.subline)}</p>
                <p className="mt-2 text-xs text-text-muted">
                  CTA: <span className="font-medium text-text-primary">{String(item.cta)}</span>
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Image prompt" description="A ready-to-paste prompt for an AI image generator.">
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              aria-label="Image slot"
              value={slotKey}
              onChange={(e) => setSlotKey(e.target.value)}
              options={MARKETING_IMAGE_SLOTS.map((slot) => ({ value: slot, label: slot }))}
            />
            <Button size="sm" loading={promptQuery.isFetching} onClick={() => promptQuery.refetch()}>
              <Wand2 size={16} aria-hidden="true" />
              Get prompt
            </Button>
          </div>
          {prompt ? (
            <div className="mt-4 space-y-2">
              <textarea readOnly aria-label="Image prompt" value={prompt} rows={5} className={inputClass} />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard.writeText(prompt);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 2000);
                }}
              >
                <Copy size={14} aria-hidden="true" />
                {copied ? 'Copied' : 'Copy prompt'}
              </Button>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}
