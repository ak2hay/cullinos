import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ImageIcon, Trash2, UploadCloud } from 'lucide-react';
import { Card, EmptyState, FilterSelect, PageHeader, SectionCard, useConfirm } from '@/components/ui';
import { MutationError } from '@/components/common';
import { MARKETING_IMAGE_SLOTS, marketingApi } from '@/lib/marketing-api';

export function MediaLibraryPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, confirmDialog] = useConfirm();
  const [slotKey, setSlotKey] = useState<string>('');
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['marketing', 'assets'],
    queryFn: marketingApi.listAssets,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, slot }: { file: File; slot?: string }) => marketingApi.uploadAsset(file, slot || undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'assets'] }),
    onSettled: () => {
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  const deleteMutation = useMutation({
    mutationFn: marketingApi.deleteAsset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'assets'] }),
  });

  return (
    <div className="space-y-6">
      {confirmDialog}
      <PageHeader title="Media library" description="Upload and assign images to marketing slots." />

      <SectionCard title="Upload" description="PNG, JPG or WebP. Pick a slot to replace the image used on the site.">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-text-secondary">Image slot</span>
            <FilterSelect
              className="w-64"
              value={slotKey}
              onChange={(e) => setSlotKey(e.target.value)}
              options={[{ value: '', label: 'General upload' }, ...MARKETING_IMAGE_SLOTS.map((slot) => ({ value: slot, label: slot }))]}
            />
          </label>
          <label className="flex min-w-[16rem] flex-1 cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line px-4 py-5 text-sm text-text-secondary transition hover:border-accent/50 hover:bg-accent/5 focus-within:border-accent">
            <UploadCloud size={20} className="text-accent" aria-hidden="true" />
            {uploadMutation.isPending ? 'Uploading…' : 'Choose an image to upload'}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={uploadMutation.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate({ file, slot: slotKey || undefined });
              }}
            />
          </label>
        </div>
        <div className="mt-3">
          <MutationError error={uploadMutation.error ?? deleteMutation.error} />
        </div>
      </SectionCard>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-bg-secondary" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <Card>
          <EmptyState icon={ImageIcon} title="No images yet" description="Uploaded images will appear here." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {assets.map((asset) => (
            <Card key={String(asset.id)} className="group overflow-hidden">
              <div className="aspect-video bg-bg-secondary">
                <img src={String(asset.url)} alt={String(asset.alt ?? asset.originalName)} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={String(asset.originalName)}>
                    {String(asset.originalName)}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-text-muted">{asset.slotKey ? String(asset.slotKey) : 'No slot'}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${String(asset.originalName)}`}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-status-error/10 hover:text-status-error"
                  onClick={() =>
                    void confirm({ title: 'Delete this image?', description: String(asset.originalName), confirmLabel: 'Delete' }).then(
                      (ok) => ok && deleteMutation.mutate(String(asset.id)),
                    )
                  }
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
