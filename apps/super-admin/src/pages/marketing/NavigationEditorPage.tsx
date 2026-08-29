import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/marketing-api';

export function NavigationEditorPage() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['marketing', 'nav'],
    queryFn: () => marketingApi.listNav('draft'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      marketingApi.updateNav(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'nav'] }),
  });

  if (isLoading) return <p className="text-text-muted">Loading navigation…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Navigation</h1>
      <div className="space-y-3">
        {items.map((item) => (
          <form
            key={String(item.id)}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-bg-card p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateMutation.mutate({
                id: String(item.id),
                body: { label: fd.get('label'), href: fd.get('href'), sortOrder: Number(fd.get('sortOrder')) },
              });
            }}
          >
            <label className="flex-1 min-w-[120px]">
              <span className="text-xs text-text-muted">Label</span>
              <input name="label" defaultValue={String(item.label)} className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
            </label>
            <label className="flex-[2] min-w-[160px]">
              <span className="text-xs text-text-muted">Href</span>
              <input name="href" defaultValue={String(item.href)} className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
            </label>
            <label className="w-20">
              <span className="text-xs text-text-muted">Order</span>
              <input name="sortOrder" type="number" defaultValue={Number(item.sortOrder)} className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
            </label>
            <button type="submit" className="rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Save</button>
          </form>
        ))}
      </div>
    </div>
  );
}
