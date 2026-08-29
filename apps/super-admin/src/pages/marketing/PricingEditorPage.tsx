import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/marketing-api';

export function PricingEditorPage() {
  const queryClient = useQueryClient();
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['marketing', 'pricing'],
    queryFn: () => marketingApi.listPricing('draft'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      marketingApi.updatePricing(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'pricing'] }),
  });

  if (isLoading) return <p className="text-text-muted">Loading pricing…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Pricing cards</h1>
      <div className="space-y-4">
        {cards.map((card) => (
          <form
            key={String(card.id)}
            className="space-y-3 rounded-xl border border-white/10 bg-bg-card p-5"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              updateMutation.mutate({
                id: String(card.id),
                body: {
                  name: fd.get('name'),
                  description: fd.get('description'),
                  priceMonthly: Number(fd.get('priceMonthly')),
                  priceYearly: Number(fd.get('priceYearly')),
                  highlighted: fd.get('highlighted') === 'on',
                },
              });
            }}
          >
            <p className="font-medium">{String(card.planKey)}</p>
            <input name="name" defaultValue={String(card.name)} className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
            <textarea name="description" defaultValue={String(card.description)} rows={2} className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input name="priceMonthly" type="number" defaultValue={Number(card.priceMonthly)} placeholder="Monthly (paise)" className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
              <input name="priceYearly" type="number" defaultValue={Number(card.priceYearly)} placeholder="Yearly (paise)" className="rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input name="highlighted" type="checkbox" defaultChecked={Boolean(card.highlighted)} />
              Highlight plan
            </label>
            <button type="submit" className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary">Save</button>
          </form>
        ))}
      </div>
    </div>
  );
}
