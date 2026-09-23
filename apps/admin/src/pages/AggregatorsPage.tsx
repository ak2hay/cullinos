import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, ErrorBanner, PageHeader, useToast } from '@cullinos/ui';
import { aggregatorsApi, outletsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type Provider = 'swiggy' | 'zomato';

const PROVIDER_LABELS: Record<Provider, string> = {
  swiggy: 'Swiggy',
  zomato: 'Zomato',
};

export function AggregatorsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const [activeProvider, setActiveProvider] = useState<Provider>('swiggy');

  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const aggregatorsQuery = useQuery({
    queryKey: ['aggregators'],
    queryFn: aggregatorsApi.list,
  });

  const providerData = aggregatorsQuery.data?.find((p) => p.provider === activeProvider);

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      aggregatorsApi.upsert(activeProvider, { isActive }),
    onSuccess: () => {
      setRevealedSecret(null);
      queryClient.invalidateQueries({ queryKey: ['aggregators'] });
      toast.success('Aggregator connection updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: () => aggregatorsApi.regenerateWebhookSecret(activeProvider),
    onSuccess: (row) => {
      setRevealedSecret(row.webhookSecret);
      queryClient.invalidateQueries({ queryKey: ['aggregators'] });
      toast.success('Webhook secret regenerated. Copy it now — it will not be shown again.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const outletMutation = useMutation({
    mutationFn: (payload: { outletId: string; connected: boolean; menuSyncEnabled: boolean }) =>
      aggregatorsApi.updateOutlet(activeProvider, payload.outletId, {
        connected: payload.connected,
        menuSyncEnabled: payload.menuSyncEnabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aggregators'] });
      toast.success('Outlet settings saved.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const syncMutation = useMutation({
    mutationFn: (outletId: string) => aggregatorsApi.syncMenu(activeProvider, outletId),
    onSuccess: (result) => toast.success(result.message ?? 'Menu sync triggered.'),
    onError: (err: Error) => toast.error(err.message),
  });

  const outlets = outletsQuery.data ?? [];
  const outletConfigs = providerData?.outlets ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aggregators"
        description="Connect Swiggy and Zomato, toggle online menu sync per outlet, and ingest webhook orders."
      />

      {aggregatorsQuery.error ? (
        <ErrorBanner>
          {aggregatorsQuery.error instanceof Error
            ? aggregatorsQuery.error.message
            : 'Failed to load aggregators'}
        </ErrorBanner>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(['swiggy', 'zomato'] as Provider[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setRevealedSecret(null);
              setActiveProvider(p);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeProvider === p
                ? 'bg-brand-primary/20 text-brand-primary'
                : 'bg-bg-card text-text-secondary hover:text-text-primary'
            }`}
          >
            {PROVIDER_LABELS[p]}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-white/5 bg-bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{PROVIDER_LABELS[activeProvider]} connection</h2>
            <p className="text-sm text-text-secondary">
              {providerData?.isActive ? 'Connected' : 'Disconnected'} — webhook orders create POS
              orders automatically.
            </p>
          </div>
          <Button
            type="button"
            loading={toggleMutation.isPending}
            onClick={() => toggleMutation.mutate(!providerData?.isActive)}
          >
            {providerData?.isActive ? 'Disconnect' : 'Connect'}
          </Button>
        </div>

        <div className="rounded-lg bg-bg-elevated p-3 text-sm space-y-2">
          <p>
            <span className="text-text-muted">Webhook URL:</span>{' '}
            <code className="text-xs">{providerData?.webhookPath}</code>
          </p>
          <p>
            <span className="text-text-muted">Secret fingerprint:</span>{' '}
            <code className="text-xs">
              {providerData?.webhookSecretFingerprint ?? 'Generate a secret to connect webhooks'}
            </code>
          </p>
          {revealedSecret ? (
            <p>
              <span className="text-text-muted">Secret header (copy now):</span>{' '}
              <code className="text-xs">x-aggregator-secret: {revealedSecret}</code>
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            loading={regenerateSecretMutation.isPending}
            onClick={() => regenerateSecretMutation.mutate()}
          >
            {providerData?.webhookSecretFingerprint ? 'Regenerate secret' : 'Generate secret'}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-4">
        <h2 className="font-semibold">Per-outlet settings</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Enable connection and online menu sync for each outlet.
        </p>
        <ul className="mt-4 divide-y divide-white/5">
          {outlets.map((outlet) => {
            const cfg = outletConfigs[outlet.id] ?? {
              connected: false,
              menuSyncEnabled: false,
            };
            const isSelected = outlet.id === selectedOutletId;
            return (
              <li key={outlet.id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="min-w-[160px]">
                  <p className="font-medium">
                    {outlet.name}
                    {isSelected ? (
                      <span className="ml-2 text-xs text-text-muted">(selected)</span>
                    ) : null}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cfg.connected}
                    onChange={(e) =>
                      outletMutation.mutate({
                        outletId: outlet.id,
                        connected: e.target.checked,
                        menuSyncEnabled: cfg.menuSyncEnabled,
                      })
                    }
                  />
                  Connected
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={cfg.menuSyncEnabled}
                    disabled={!cfg.connected}
                    onChange={(e) =>
                      outletMutation.mutate({
                        outletId: outlet.id,
                        connected: cfg.connected,
                        menuSyncEnabled: e.target.checked,
                      })
                    }
                  />
                  Menu sync
                </label>
                <Button
                  type="button"
                  size="sm"
                  disabled={!cfg.connected || !cfg.menuSyncEnabled}
                  loading={syncMutation.isPending}
                  onClick={() => syncMutation.mutate(outlet.id)}
                >
                  Sync now
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
