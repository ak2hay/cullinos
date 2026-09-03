import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPE_PARENT_LABELS,
  BUSINESS_TYPES,
  getBusinessTypeParent,
  type BusinessType,
} from '@cullinos/shared';
import { Button, Input } from '@/components/ui/Form';
import { organizationsApi, outletsApi, settingsApi } from '@/lib/api';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [jsonText, setJsonText] = useState('{}');
  const [parseError, setParseError] = useState('');
  const [outletForm, setOutletForm] = useState({ name: '', city: '', phone: '' });
  const [outletNotice, setOutletNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const orgQuery = useQuery({ queryKey: ['organizations', 'current'], queryFn: organizationsApi.current });

  const createOutletMutation = useMutation({
    mutationFn: () => outletsApi.create({
      name: outletForm.name,
      city: outletForm.city || undefined,
      phone: outletForm.phone || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      setOutletForm({ name: '', city: '', phone: '' });
      setOutletNotice({ type: 'success', text: 'Outlet created successfully!' });
      setTimeout(() => setOutletNotice(null), 5000);
    },
    onError: (err: Error) => {
      setOutletNotice({ type: 'error', text: err.message ?? 'Failed to create outlet.' });
      setTimeout(() => setOutletNotice(null), 5000);
    },
  });

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

  const rawType = orgQuery.data?.businessType;
  const businessType =
    rawType && (BUSINESS_TYPES as readonly string[]).includes(rawType)
      ? (rawType as BusinessType)
      : null;
  const parent = businessType ? getBusinessTypeParent(businessType) : null;

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

      <div className="space-y-2 rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="font-semibold">Business type</h2>
        <p className="text-sm text-text-secondary">
          {businessType && parent ? (
            <>
              {BUSINESS_TYPE_PARENT_LABELS[parent]}
              {parent === 'qsr' ? ` · ${BUSINESS_TYPE_LABELS[businessType]}` : null}
            </>
          ) : (
            'Not set — complete Setup to choose a category.'
          )}
        </p>
        <p className="text-xs text-text-muted">
          Change category from Setup. Admin menu options follow this type.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">Outlets</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Your restaurant locations. Add a second outlet to unlock Management → Stock Transfer.
          </p>
        </div>

        <ul className="divide-y divide-white/5">
          {(outletsQuery.data ?? []).map((outlet) => (
            <li key={outlet.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{outlet.name}</p>
                {outlet.city ? <p className="text-xs text-text-muted">{outlet.city}</p> : null}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${outlet.isActive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                {outlet.isActive ? 'Active' : 'Inactive'}
              </span>
            </li>
          ))}
        </ul>

        <div>
          <h3 className="mb-3 text-sm font-medium">Add outlet</h3>
          {outletNotice && (
            <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${outletNotice.type === 'success' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
              {outletNotice.text}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Outlet name *"
              placeholder="Bandra Outlet"
              value={outletForm.name}
              onChange={(e) => setOutletForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="City"
              placeholder="Mumbai"
              value={outletForm.city}
              onChange={(e) => setOutletForm((f) => ({ ...f, city: e.target.value }))}
            />
            <Input
              label="Phone"
              placeholder="+91 9900000000"
              value={outletForm.phone}
              onChange={(e) => setOutletForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="mt-3">
            <Button
              onClick={() => createOutletMutation.mutate()}
              disabled={!outletForm.name}
              loading={createOutletMutation.isPending}
            >
              Create outlet
            </Button>
          </div>
        </div>
      </div>

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
