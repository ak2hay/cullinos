import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@cullinos/ui';
import { settingsApi } from '@/lib/api';

type Trigger = 'kot' | 'served';

const OPTIONS: Array<{ value: Trigger; label: string; hint: string }> = [
  {
    value: 'kot',
    label: 'When the order is sent to the kitchen (KOT)',
    hint: 'Stock drops as soon as the kitchen ticket is created. Best for accurate live stock.',
  },
  {
    value: 'served',
    label: 'When the order is served or completed',
    hint: 'Stock drops only after the food is served, so held or cancelled drafts never touch stock.',
  },
];

/** Org setting: when recipe ingredients are deducted from outlet stock. Cancel / void always restores. */
export function StockDeductionSetting() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const current: Trigger =
    settingsQuery.data?.settings?.stockDeductionTrigger === 'kot' ? 'kot' : 'served';

  const mutation = useMutation({
    mutationFn: (value: Trigger) => settingsApi.update({ stockDeductionTrigger: value }),
    onSuccess: () => {
      toast.success('Stock deduction timing saved.');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <section className="space-y-3 rounded-xl border border-line-subtle bg-bg-card p-5">
      <div>
        <h2 className="font-semibold">When should stock be deducted?</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Applies to every outlet. Cancelled or voided orders always put the ingredients back.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 ${
              current === option.value
                ? 'border-brand-primary/60 bg-brand-primary/10'
                : 'border-line-subtle bg-bg-elevated'
            }`}
          >
            <input
              type="radio"
              name="stock-deduction-trigger"
              className="mt-1 h-4 w-4 accent-brand-primary"
              checked={current === option.value}
              disabled={settingsQuery.isLoading || mutation.isPending}
              onChange={() => mutation.mutate(option.value)}
            />
            <span>
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
