import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Button, ErrorBanner, Input, PageHeader, useToast } from '@cullinos/ui';
import { outletsApi, paymentGatewaysApi, type PaymentGatewayRow } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

type Provider = 'razorpay' | 'cashfree';

const PROVIDER_LABELS: Record<Provider, string> = {
  razorpay: 'Razorpay',
  cashfree: 'Cashfree',
};

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const [activeProvider, setActiveProvider] = useState<Provider>('razorpay');
  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [mode, setMode] = useState<'sandbox' | 'production'>('sandbox');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const [overrideOutletId, setOverrideOutletId] = useState<string | null>(null);
  const [outletOverride, setOutletOverride] = useState(false);
  const [outletPrefer, setOutletPrefer] = useState(false);
  const [outletKeyId, setOutletKeyId] = useState('');
  const [outletSecret, setOutletSecret] = useState('');
  const [outletMode, setOutletMode] = useState<'sandbox' | 'production'>('sandbox');

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const gatewaysQuery = useQuery({
    queryKey: ['payment-gateways'],
    queryFn: paymentGatewaysApi.list,
  });

  const providerData = gatewaysQuery.data?.find((p) => p.provider === activeProvider);

  useEffect(() => {
    if (!providerData) return;
    setKeyId('');
    setSecret('');
    setWebhookSecret('');
    setMode(providerData.mode ?? 'sandbox');
    setIsDefault(providerData.isDefault);
    setIsActive(providerData.isActive);
    setOverrideOutletId(null);
  }, [providerData, activeProvider]);

  const apiBase = useMemo(() => {
    const env = import.meta.env.VITE_API_URL as string | undefined;
    return (env?.replace(/\/$/, '') || window.location.origin).replace(/\/api\/?$/, '') + '/api';
  }, []);

  const saveMutation = useMutation({
    mutationFn: () =>
      paymentGatewaysApi.upsert(activeProvider, {
        isActive,
        isDefault,
        mode: activeProvider === 'cashfree' ? mode : undefined,
        keyId: keyId.trim() || undefined,
        secret: secret.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-gateways'] });
      toast.success(`${PROVIDER_LABELS[activeProvider]} settings saved.`);
      setSecret('');
      setWebhookSecret('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const outletMutation = useMutation({
    mutationFn: (outletId: string) =>
      paymentGatewaysApi.upsertOutlet(activeProvider, outletId, {
        override: outletOverride,
        preferProvider: outletPrefer,
        mode: activeProvider === 'cashfree' ? outletMode : undefined,
        keyId: outletOverride ? outletKeyId.trim() || undefined : undefined,
        secret: outletOverride ? outletSecret.trim() || undefined : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-gateways'] });
      toast.success('Outlet payment override saved.');
      setOutletSecret('');
      setOverrideOutletId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const outlets = outletsQuery.data ?? [];
  const outletConfigs = providerData?.outlets ?? {};

  function startEditOutlet(outletId: string) {
    const cfg = outletConfigs[outletId];
    setOverrideOutletId(outletId);
    setOutletOverride(cfg?.override ?? false);
    setOutletPrefer(cfg?.preferProvider ?? false);
    setOutletKeyId('');
    setOutletSecret('');
    setOutletMode(cfg?.mode ?? 'sandbox');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Connect each restaurant’s own Razorpay or Cashfree account. Online diner payments settle to that merchant — Cullinos SaaS billing stays on the platform account."
      />

      {gatewaysQuery.error ? (
        <ErrorBanner>
          {gatewaysQuery.error instanceof Error
            ? gatewaysQuery.error.message
            : 'Failed to load payment gateways'}
        </ErrorBanner>
      ) : null}

      {!gatewaysQuery.isLoading &&
      !(gatewaysQuery.data ?? []).some((g: PaymentGatewayRow) => g.configured && g.isActive) ? (
        <ErrorBanner>
          No active payment gateway yet. Online POS and Guest checkout will fail until you save
          credentials below.
        </ErrorBanner>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(['razorpay', 'cashfree'] as Provider[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setActiveProvider(p)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeProvider === p
                ? 'bg-brand-primary/20 text-brand-primary'
                : 'bg-bg-card text-text-secondary hover:text-text-primary'
            }`}
          >
            {PROVIDER_LABELS[p]}
            {gatewaysQuery.data?.find((g) => g.provider === p)?.isDefault ? ' · default' : ''}
          </button>
        ))}
      </div>

      <section className="rounded-xl border border-white/5 bg-bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">{PROVIDER_LABELS[activeProvider]} credentials</h2>
            <p className="text-sm text-text-secondary">
              {providerData?.configured
                ? `Configured${providerData.keyIdMasked ? ` (${providerData.keyIdMasked})` : ''}`
                : 'Not configured'}
              {providerData?.isActive ? ' · Active' : ' · Inactive'}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={activeProvider === 'razorpay' ? 'Key ID' : 'Client ID / App ID'}
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder={
              providerData?.keyIdMasked
                ? `Leave blank to keep ${providerData.keyIdMasked}`
                : 'Enter key'
            }
          />
          <Input
            label="Secret"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={
              providerData?.configured ? 'Leave blank to keep existing' : 'Enter secret'
            }
            autoComplete="new-password"
          />
          <Input
            label="Webhook secret (optional)"
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={
              providerData?.hasWebhookSecret
                ? 'Leave blank to keep existing'
                : 'Webhook signing secret'
            }
            autoComplete="new-password"
          />
          {activeProvider === 'cashfree' ? (
            <label className="block text-sm space-y-1">
              <span className="text-text-muted">Mode</span>
              <select
                className="w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'sandbox' | 'production')}
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Default for online payments
          </label>
        </div>

        <div className="rounded-lg bg-bg-elevated p-3 text-sm space-y-1">
          <p>
            <span className="text-text-muted">Webhook URL:</span>{' '}
            <code className="text-xs break-all">
              {apiBase}
              {providerData?.webhookPath ?? `/payments/webhooks/${activeProvider}`}
            </code>
          </p>
          <p className="text-text-muted text-xs">
            Point this restaurant’s {PROVIDER_LABELS[activeProvider]} dashboard webhook to the URL
            above.
          </p>
        </div>

        <Button
          type="button"
          loading={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          Save {PROVIDER_LABELS[activeProvider]}
        </Button>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-4">
        <h2 className="font-semibold">Per-outlet overrides</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Inherit organization credentials by default, or override with a separate merchant account
          per outlet.
        </p>
        <ul className="mt-4 divide-y divide-white/5">
          {outlets.map((outlet) => {
            const cfg = outletConfigs[outlet.id];
            const isSelected = outlet.id === selectedOutletId;
            const editing = overrideOutletId === outlet.id;
            return (
              <li key={outlet.id} className="py-3 space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[160px]">
                    <p className="font-medium">
                      {outlet.name}
                      {isSelected ? (
                        <span className="ml-2 text-xs text-text-muted">(selected)</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-text-muted">
                      {cfg?.override
                        ? `Override${cfg.keyIdMasked ? ` · ${cfg.keyIdMasked}` : ''}`
                        : 'Inherits org'}
                      {cfg?.preferProvider ? ' · prefers this provider' : ''}
                    </p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => startEditOutlet(outlet.id)}>
                    {editing ? 'Editing…' : 'Edit'}
                  </Button>
                </div>
                {editing ? (
                  <div className="rounded-lg border border-white/5 bg-bg-elevated p-3 space-y-3">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={outletOverride}
                          onChange={(e) => setOutletOverride(e.target.checked)}
                        />
                        Use outlet-specific keys
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={outletPrefer}
                          onChange={(e) => setOutletPrefer(e.target.checked)}
                        />
                        Prefer {PROVIDER_LABELS[activeProvider]} at this outlet
                      </label>
                    </div>
                    {outletOverride ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="Outlet Key / Client ID"
                          value={outletKeyId}
                          onChange={(e) => setOutletKeyId(e.target.value)}
                          placeholder="Outlet Key / Client ID"
                        />
                        <Input
                          label="Outlet secret"
                          type="password"
                          value={outletSecret}
                          onChange={(e) => setOutletSecret(e.target.value)}
                          placeholder="Outlet secret"
                          autoComplete="new-password"
                        />
                        {activeProvider === 'cashfree' ? (
                          <select
                            className="rounded-lg border border-white/10 bg-bg-card px-3 py-2 text-sm"
                            value={outletMode}
                            onChange={(e) =>
                              setOutletMode(e.target.value as 'sandbox' | 'production')
                            }
                          >
                            <option value="sandbox">Sandbox</option>
                            <option value="production">Production</option>
                          </select>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        loading={outletMutation.isPending}
                        onClick={() => outletMutation.mutate(outlet.id)}
                      >
                        Save outlet
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setOverrideOutletId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
