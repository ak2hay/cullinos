import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GripVertical } from 'lucide-react';
import { Button } from '@cullinos/ui';
import { PageHeader, SectionCard } from '@/components/ui';
import { inputClass, MutationError } from '@/components/common';
import { marketingApi } from '@/lib/marketing-api';

export function NavigationEditorPage() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['marketing', 'nav'],
    queryFn: () => marketingApi.listNav('draft'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => marketingApi.updateNav(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'nav'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Navigation" description="Header links on the marketing site (draft). Lower order numbers appear first." />
      <MutationError error={updateMutation.error} />
      <SectionCard flush>
        {isLoading ? (
          <div className="space-y-2 p-5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-bg-secondary" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-line-subtle">
            <li className="hidden grid-cols-[24px_1fr_2fr_80px_auto] gap-3 px-5 py-2.5 text-xs font-medium text-text-muted sm:grid">
              <span />
              <span>Label</span>
              <span>Link</span>
              <span>Order</span>
              <span className="sr-only">Save</span>
            </li>
            {items.map((item) => {
              const saving = updateMutation.isPending && updateMutation.variables?.id === String(item.id);
              return (
                <li key={String(item.id)}>
                  <form
                    className="grid items-center gap-3 px-5 py-3 sm:grid-cols-[24px_1fr_2fr_80px_auto]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      updateMutation.mutate({
                        id: String(item.id),
                        body: { label: fd.get('label'), href: fd.get('href'), sortOrder: Number(fd.get('sortOrder')) },
                      });
                    }}
                  >
                    <GripVertical size={16} className="hidden text-text-muted sm:block" aria-hidden="true" />
                    <input name="label" aria-label="Label" defaultValue={String(item.label)} className={inputClass} />
                    <input name="href" aria-label="Link" defaultValue={String(item.href)} className={`${inputClass} font-mono`} />
                    <input name="sortOrder" aria-label="Order" type="number" defaultValue={Number(item.sortOrder)} className={inputClass} />
                    <Button type="submit" size="sm" variant="secondary" loading={saving}>
                      Save
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
