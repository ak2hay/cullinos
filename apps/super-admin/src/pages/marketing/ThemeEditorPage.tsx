import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '@/lib/marketing-api';

const TOKEN_KEYS = [
  'brandPrimary',
  'brandGold',
  'bgPrimary',
  'bgSecondary',
  'bgCard',
  'textPrimary',
  'textSecondary',
  'border',
] as const;

export function ThemeEditorPage() {
  const queryClient = useQueryClient();
  const { data: theme, isLoading } = useQuery({
    queryKey: ['marketing', 'theme'],
    queryFn: () => marketingApi.getTheme('draft'),
  });

  const tokens = (theme?.tokens ?? {}) as Record<string, string>;

  const saveMutation = useMutation({
    mutationFn: (body: { tokens: Record<string, string>; name?: string }) =>
      marketingApi.upsertTheme(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['marketing', 'theme'] }),
  });

  if (isLoading) return <p className="text-text-muted">Loading theme…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Theme editor</h1>
        <p className="mt-1 text-text-secondary">Edit CSS design tokens for the marketing site.</p>
      </div>

      <form
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
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
        <label className="sm:col-span-2 lg:col-span-3 block">
          <span className="text-sm text-text-secondary">Theme name</span>
          <input
            name="name"
            defaultValue={String(theme?.name ?? 'Default')}
            className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 text-sm"
          />
        </label>
        {TOKEN_KEYS.map((key) => (
          <label key={key} className="block">
            <span className="text-sm text-text-secondary">{key}</span>
            <div className="mt-1 flex gap-2">
              <input
                type="color"
                name={`${key}_picker`}
                defaultValue={tokens[key] ?? '#000000'}
                onChange={(e) => {
                  const input = e.currentTarget.form?.elements.namedItem(key) as HTMLInputElement | null;
                  if (input) input.value = e.target.value;
                }}
                className="h-10 w-12 cursor-pointer rounded border border-white/10"
              />
              <input
                name={key}
                defaultValue={tokens[key] ?? ''}
                className="flex-1 rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 font-mono text-sm"
              />
            </div>
          </label>
        ))}
        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-primary disabled:opacity-60"
          >
            Save theme draft
          </button>
        </div>
      </form>
    </div>
  );
}
