import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Form';
import { settingsApi } from '@/lib/api';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [jsonText, setJsonText] = useState('{}');
  const [parseError, setParseError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  useEffect(() => {
    if (data?.settings) {
      setJsonText(JSON.stringify(data.settings, null, 2));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  function handleSave() {
    setParseError('');
    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      saveMutation.mutate(parsed);
    } catch {
      setParseError('Invalid JSON. Please fix formatting before saving.');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Organization-wide configuration stored as JSON.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load settings'}
        </div>
      ) : null}

      {saveMutation.isSuccess ? (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          Settings saved successfully.
        </div>
      ) : null}

      <div className="rounded-xl border border-white/5 bg-bg-card p-5">
        <label htmlFor="settings-json" className="block text-sm font-medium text-text-secondary">
          Organization settings (JSON)
        </label>
        {isLoading ? (
          <div className="mt-4 h-64 animate-pulse rounded-lg bg-bg-elevated" />
        ) : (
          <textarea
            id="settings-json"
            rows={16}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="mt-3 w-full rounded-lg border border-white/10 bg-bg-elevated p-4 font-mono text-sm text-text-primary outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        )}
        {parseError ? (
          <p className="mt-2 text-sm text-status-error">{parseError}</p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button onClick={handleSave} loading={saveMutation.isPending}>
            Save settings
          </Button>
        </div>
      </div>
    </div>
  );
}
