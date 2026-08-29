import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MARKETING_IMAGE_SLOTS, marketingApi } from '@/lib/marketing-api';

export function DesignLabPage() {
  const queryClient = useQueryClient();
  const [tone, setTone] = useState('friendly');
  const [slotKey, setSlotKey] = useState('heroRestaurant');
  const [copyPage, setCopyPage] = useState('home');

  const { data: presets = [] } = useQuery({
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Design lab</h1>
        <p className="mt-1 text-text-secondary">
          Apply theme presets, get copy suggestions, and copy AI image prompts.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Theme presets</h2>
          <button
            type="button"
            onClick={() => seedPresetsMutation.mutate()}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
          >
            Seed presets
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {presets.map((preset) => (
            <div key={String(preset.slug)} className="rounded-xl border border-white/10 bg-bg-card p-4">
              <p className="font-medium">{String(preset.name)}</p>
              <p className="mt-1 text-sm text-text-secondary">{String(preset.description ?? '')}</p>
              <p className="mt-2 text-xs text-text-muted">Tone: {String(preset.copyTone)}</p>
              <button
                type="button"
                onClick={() => applyMutation.mutate(String(preset.slug))}
                disabled={applyMutation.isPending}
                className="mt-3 rounded-lg bg-brand-primary px-3 py-1.5 text-sm font-medium text-text-primary disabled:opacity-60"
              >
                Apply to theme draft
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-bg-card p-5 space-y-4">
        <h2 className="text-lg font-medium">Copy suggestions</h2>
        <div className="flex flex-wrap gap-3">
          <select value={copyPage} onChange={(e) => setCopyPage(e.target.value)} className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm">
            <option value="home">Home</option>
            <option value="pricing">Pricing</option>
            <option value="features">Features</option>
          </select>
          <select value={tone} onChange={(e) => setTone(e.target.value)} className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm">
            <option value="friendly">Friendly</option>
            <option value="formal">Formal</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <button type="button" onClick={() => copyQuery.refetch()} className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5">
            Generate suggestions
          </button>
        </div>
        <div className="space-y-3">
          {(copyQuery.data ?? []).map((item) => (
            <div key={String(item.id)} className="rounded-lg border border-white/5 bg-bg-elevated p-3 text-sm">
              <p className="font-medium">{String(item.headline)}</p>
              <p className="mt-1 text-text-secondary">{String(item.subline)}</p>
              <p className="mt-1 text-xs text-text-muted">CTA: {String(item.cta)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-bg-card p-5 space-y-4">
        <h2 className="text-lg font-medium">Image prompt</h2>
        <div className="flex flex-wrap gap-3">
          <select value={slotKey} onChange={(e) => setSlotKey(e.target.value)} className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm">
            {MARKETING_IMAGE_SLOTS.map((slot) => (
              <option key={slot} value={slot}>{slot}</option>
            ))}
          </select>
          <button type="button" onClick={() => promptQuery.refetch()} className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/5">
            Get prompt
          </button>
        </div>
        {promptQuery.data ? (
          <textarea
            readOnly
            value={String(promptQuery.data.prompt ?? '')}
            rows={4}
            className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm"
          />
        ) : null}
      </section>
    </div>
  );
}
