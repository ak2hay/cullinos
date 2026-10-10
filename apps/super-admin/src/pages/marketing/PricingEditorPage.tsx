import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@cullinos/ui';
import { PageHeader, SectionCard, StatusPill } from '@/components/ui';
import { inputClass, LabeledInput, MutationError } from '@/components/common';
import { formatInr } from '@/lib/format';
import { marketingApi } from '@/lib/marketing-api';

export function PricingEditorPage() {
  const queryClient = useQueryClient();
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['marketing', 'pricing'],
    queryFn: () => marketingApi.listPricing('draft'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => marketingApi.updatePricing(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'pricing'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing cards"
        description="Draft marketing prices (paise). Use Marketing → Overview → Import from codebase to seed Starter ₹1,499 · QSR ₹2,499 · Professional ₹4,999 (monthly), then Publish site. Enterprise and Hospitality show “Contact us” — keep their price at 0 with a contact CTA."
      />
      <MutationError error={updateMutation.error} />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl bg-bg-secondary" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const monthly = Number(card.priceMonthly);
            const saving = updateMutation.isPending && updateMutation.variables?.id === String(card.id);
            return (
              <SectionCard
                key={String(card.id)}
                className={card.highlighted ? 'ring-2 ring-accent/40' : undefined}
                title={<span className="font-mono text-sm">{String(card.planKey)}</span>}
                description={monthly > 0 ? `${formatInr(monthly / 100)} / month` : 'Contact us'}
                actions={card.highlighted ? <StatusPill status="highlighted" tone="brand" label="Highlighted" dot={false} /> : null}
              >
                <form
                  className="space-y-3"
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
                  <LabeledInput label="Name">
                    <input name="name" defaultValue={String(card.name)} className={inputClass} />
                  </LabeledInput>
                  <LabeledInput label="Description">
                    <textarea name="description" defaultValue={String(card.description)} rows={2} className={inputClass} />
                  </LabeledInput>
                  <div className="grid grid-cols-2 gap-3">
                    <LabeledInput label="Monthly (paise)">
                      <input name="priceMonthly" type="number" defaultValue={monthly} className={inputClass} />
                    </LabeledInput>
                    <LabeledInput label="Yearly (paise)">
                      <input name="priceYearly" type="number" defaultValue={Number(card.priceYearly)} className={inputClass} />
                    </LabeledInput>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input name="highlighted" type="checkbox" className="accent-accent" defaultChecked={Boolean(card.highlighted)} />
                    Highlight plan
                  </label>
                  <Button type="submit" size="sm" loading={saving}>
                    Save
                  </Button>
                </form>
              </SectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
