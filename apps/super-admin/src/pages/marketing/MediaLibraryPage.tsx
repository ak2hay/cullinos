import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { MARKETING_IMAGE_SLOTS, marketingApi } from '@/lib/marketing-api';

export function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const [slotKey, setSlotKey] = useState<string>('');
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['marketing', 'assets'],
    queryFn: marketingApi.listAssets,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, slot }: { file: File; slot?: string }) =>
      marketingApi.uploadAsset(file, slot || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'assets'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: marketingApi.deleteAsset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'assets'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Media library</h1>
        <p className="mt-1 text-text-secondary">Upload and assign images to marketing slots.</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-bg-card p-5">
        <label className="block text-sm text-text-secondary">Image slot (optional)</label>
        <select
          value={slotKey}
          onChange={(e) => setSlotKey(e.target.value)}
          className="mt-1 w-full max-w-md rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm"
        >
          <option value="">General upload</option>
          {MARKETING_IMAGE_SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
        <label className="mt-4 block">
          <span className="text-sm text-text-secondary">Upload file</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="mt-1 block w-full text-sm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMutation.mutate({ file, slot: slotKey || undefined });
            }}
          />
        </label>
        {uploadMutation.isPending ? <p className="mt-2 text-sm text-text-muted">Uploading…</p> : null}
      </div>

      {isLoading ? (
        <p className="text-text-muted">Loading assets…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <div key={String(asset.id)} className="overflow-hidden rounded-xl border border-white/10 bg-bg-card">
              <div className="aspect-video bg-bg-elevated">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={String(asset.url)}
                  alt={String(asset.alt ?? asset.originalName)}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="space-y-2 p-4">
                <p className="truncate text-sm font-medium">{String(asset.originalName)}</p>
                <p className="text-xs text-text-muted">
                  Slot: {String(asset.slotKey ?? '—')}
                </p>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(String(asset.id))}
                  className="text-xs text-status-error hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
