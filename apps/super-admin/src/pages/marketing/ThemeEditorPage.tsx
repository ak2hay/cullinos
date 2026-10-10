import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@cullinos/ui';
import { PageHeader, SectionCard } from '@/components/ui';
import { inputClass, LabeledInput, MutationError, Notice } from '@/components/common';
import { marketingApi } from '@/lib/marketing-api';

const TOKEN_KEYS = ['brandPrimary', 'brandGold', 'bgPrimary', 'bgSecondary', 'bgCard', 'textPrimary', 'textSecondary', 'border'] as const;

export function ThemeEditorPage() {
  const queryClient = useQueryClient();
  const { data: theme, isLoading } = useQuery({
    queryKey: ['marketing', 'theme'],
    queryFn: () => marketingApi.getTheme('draft'),
  });

  const tokens = (theme?.tokens ?? {}) as Record<string, string>;

  const saveMutation = useMutation({
    mutationFn: (body: { tokens: Record<string, string>; name?: string }) => marketingApi.upsertTheme(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'theme'] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Theme editor" description="Edit CSS design tokens for the marketing site." />

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-xl bg-bg-secondary" />
      ) : (
        <SectionCard>
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const next: Record<string, string> = { ...tokens };
              for (const key of TOKEN_KEYS) {
                const val = fd.get(key);
                if (typeof val === 'string' && val) next[key] = val;
              }
              saveMutation.mutate({ tokens: next, name: String(fd.get('name') ?? 'Default') });
            }}
          >
            <div className="max-w-md">
              <LabeledInput label="Theme name">
                <input name="name" defaultValue={String(theme?.name ?? 'Default')} className={inputClass} />
              </LabeledInput>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TOKEN_KEYS.map((key) => (
                <div key={key} className="rounded-xl border border-line-subtle p-3">
                  <label htmlFor={`token-${key}`} className="text-xs font-medium text-text-secondary">
                    {key}
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`${key} colour picker`}
                      name={`${key}_picker`}
                      defaultValue={tokens[key] ?? '#000000'}
                      onChange={(e) => {
                        const input = e.currentTarget.form?.elements.namedItem(key) as HTMLInputElement | null;
                        if (input) input.value = e.target.value;
                      }}
                      className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
                    />
                    <input id={`token-${key}`} name={key} defaultValue={tokens[key] ?? ''} className={`${inputClass} font-mono`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 border-t border-line-subtle pt-4">
              <Button type="submit" size="sm" loading={saveMutation.isPending}>
                Save theme draft
              </Button>
              {saveMutation.isSuccess ? <Notice tone="success" className="py-1.5">Draft saved</Notice> : null}
              <MutationError error={saveMutation.error} />
            </div>
          </form>
        </SectionCard>
      )}
    </div>
  );
}
