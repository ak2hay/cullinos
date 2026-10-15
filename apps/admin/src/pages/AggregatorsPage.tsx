import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, ErrorBanner, Input, PageHeader, Select, useToast } from '@cullinos/ui';
import {
  absoluteApiUrl,
  aggregatorsApi,
  menuApi,
  outletsApi,
  urbanPiperApi,
  type UrbanPiperOutletRow,
  type UrbanPiperSettings,
} from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth';

const SETTINGS_KEY = ['urbanpiper', 'settings'];

const EMPTY_OUTLET: UrbanPiperOutletRow = {
  connected: false,
  platforms: { swiggy: true, zomato: true },
  disabledItemIds: [],
  storeOnline: true,
};

export function AggregatorsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const settingsQuery = useQuery({ queryKey: SETTINGS_KEY, queryFn: urbanPiperApi.getSettings });
  const itemsQuery = useQuery({ queryKey: ['menu', 'items'], queryFn: menuApi.listItems });

  const settings = settingsQuery.data;
  const outlets = outletsQuery.data ?? [];
  const menuItems = useMemo(
    () => (itemsQuery.data ?? []).filter((i) => i.isActive),
    [itemsQuery.data],
  );

  const [form, setForm] = useState({
    username: '',
    apiKey: '',
    mode: 'sandbox' as 'sandbox' | 'production',
    acceptTimeoutMinutes: 5,
    autoRejectOnTimeout: false,
    defaultPrepTimeMinutes: 20,
    autoPushMenu: true,
  });
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [storeRefDrafts, setStoreRefDrafts] = useState<Record<string, string>>({});
  const [availabilityOutletId, setAvailabilityOutletId] = useState<string>('');
  const [itemSearch, setItemSearch] = useState('');
  const [mapDrafts, setMapDrafts] = useState<Record<string, string>>({});
  const [settlementCsv, setSettlementCsv] = useState('');

  useEffect(() => {
    if (!settings) return;
    setForm((f) => ({
      ...f,
      username: settings.username,
      mode: settings.mode,
      acceptTimeoutMinutes: settings.acceptTimeoutMinutes,
      autoRejectOnTimeout: settings.autoRejectOnTimeout,
      defaultPrepTimeMinutes: settings.defaultPrepTimeMinutes,
      autoPushMenu: settings.autoPushMenu,
    }));
  }, [settings]);

  useEffect(() => {
    if (availabilityOutletId || !outlets.length) return;
    setAvailabilityOutletId(selectedOutletId ?? outlets[0].id);
  }, [availabilityOutletId, outlets, selectedOutletId]);

  const onSettings = (next: UrbanPiperSettings, message: string) => {
    queryClient.setQueryData(SETTINGS_KEY, next);
    if (next.webhookSecret) setRevealedSecret(next.webhookSecret);
    toast.success(message);
  };
  const onError = (err: Error) => toast.error(err.message);

  const saveMutation = useMutation({
    mutationFn: (isActive?: boolean) =>
      urbanPiperApi.updateSettings({
        ...form,
        apiKey: form.apiKey.trim() || undefined,
        ...(isActive === undefined ? {} : { isActive }),
      }),
    onSuccess: (next) => {
      setForm((f) => ({ ...f, apiKey: '' }));
      onSettings(next, next.isActive ? 'UrbanPiper settings saved.' : 'Settings saved.');
    },
    onError,
  });

  const secretMutation = useMutation({
    mutationFn: urbanPiperApi.regenerateWebhookSecret,
    onSuccess: (next) => onSettings(next, 'Webhook secret created. Copy it now; it will not be shown again.'),
    onError,
  });

  const outletMutation = useMutation({
    mutationFn: (input: { outletId: string; payload: Parameters<typeof urbanPiperApi.updateOutlet>[1] }) =>
      urbanPiperApi.updateOutlet(input.outletId, input.payload),
    onSuccess: (next) => onSettings(next, 'Outlet saved.'),
    onError,
  });

  const pushMutation = useMutation({
    mutationFn: urbanPiperApi.pushMenu,
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      toast.success(
        `Menu pushed: ${r.items} items in ${r.categories} categories${
          r.skippedAlcohol ? ` (${r.skippedAlcohol} alcohol items skipped)` : ''
        }.`,
      );
    },
    onError: (err: Error) => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      onError(err);
    },
  });

  const storeMutation = useMutation({
    mutationFn: (input: { outletId: string; online: boolean }) =>
      urbanPiperApi.setStoreOnline(input.outletId, input.online),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
      toast.success(r.storeOnline ? 'Store is online on Swiggy/Zomato.' : 'Store is paused on Swiggy/Zomato.');
    },
    onError,
  });

  const availabilityMutation = useMutation({
    mutationFn: (input: { itemId: string; available: boolean }) =>
      urbanPiperApi.setItemsAvailability(availabilityOutletId, [input.itemId], input.available),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
    onError,
  });

  const mapMutation = useMutation({
    mutationFn: (input: { outletId: string; externalItemId: string; menuItemId: string }) =>
      urbanPiperApi.mapItem(input.outletId, input.externalItemId, input.menuItemId),
    onSuccess: (next) => onSettings(next, 'Item linked. Future orders will use this menu item.'),
    onError,
  });

  const importMutation = useMutation({
    mutationFn: () => aggregatorsApi.importSettlements({ format: 'csv', csv: settlementCsv }),
    onSuccess: (r) => {
      setSettlementCsv('');
      queryClient.invalidateQueries({ queryKey: ['aggregators', 'reconciliation'] });
      toast.success(`Imported ${r.imported} of ${r.total} rows (${r.skipped} skipped).`);
    },
    onError,
  });

  const reconciliationQuery = useQuery({
    queryKey: ['aggregators', 'reconciliation'],
    queryFn: () => aggregatorsApi.reconciliation(),
    retry: false,
  });

  const availabilityCfg = settings?.outlets[availabilityOutletId];
  const disabledIds = new Set(availabilityCfg?.disabledItemIds ?? []);
  const filteredItems = menuItems.filter((i) =>
    i.name.toLowerCase().includes(itemSearch.trim().toLowerCase()),
  );
  const outletName = (id: string) => outlets.find((o) => o.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Swiggy & Zomato"
        description="Receive Swiggy and Zomato orders in the POS through UrbanPiper, sync your menu and stock, and reconcile payouts."
        actions={
          settings ? (
            <Badge variant={settings.isActive ? 'success' : 'neutral'}>
              {settings.isActive ? 'Live' : 'Not connected'}
            </Badge>
          ) : null
        }
      />

      {settingsQuery.error ? (
        <ErrorBanner>
          {settingsQuery.error instanceof Error ? settingsQuery.error.message : 'Failed to load settings'}
        </ErrorBanner>
      ) : null}

      <section className="space-y-4 rounded-xl border border-line-subtle bg-bg-card p-4">
        <div>
          <h2 className="font-semibold">1. UrbanPiper account</h2>
          <p className="text-sm text-text-secondary">
            Use the API username and key from your UrbanPiper (Atlas) account. Your Swiggy and Zomato
            stores must already be linked inside UrbanPiper.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="API username"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            autoComplete="off"
          />
          <Input
            label="API key"
            type="password"
            value={form.apiKey}
            placeholder={settings?.apiKeyConfigured ? `Saved ${settings.apiKeyFingerprint ?? ''}` : 'Paste API key'}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            autoComplete="new-password"
          />
          <Select
            label="Environment"
            value={form.mode}
            onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as 'sandbox' | 'production' }))}
            options={[
              { value: 'sandbox', label: 'Sandbox (testing)' },
              { value: 'production', label: 'Production (live orders)' },
            ]}
          />
        </div>

        <h3 className="pt-2 text-sm font-semibold">Order handling</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Minutes to accept a new order (0 = no timer)"
            type="number"
            min={0}
            max={30}
            value={form.acceptTimeoutMinutes}
            onChange={(e) => setForm((f) => ({ ...f, acceptTimeoutMinutes: Number(e.target.value) }))}
          />
          <Input
            label="Default prep time (minutes)"
            type="number"
            min={5}
            max={120}
            value={form.defaultPrepTimeMinutes}
            onChange={(e) => setForm((f) => ({ ...f, defaultPrepTimeMinutes: Number(e.target.value) }))}
          />
          <div className="space-y-2 pt-6 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.autoRejectOnTimeout}
                onChange={(e) => setForm((f) => ({ ...f, autoRejectOnTimeout: e.target.checked }))}
              />
              Auto-reject when the timer runs out
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.autoPushMenu}
                onChange={(e) => setForm((f) => ({ ...f, autoPushMenu: e.target.checked }))}
              />
              Re-push menu automatically after menu edits
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" loading={saveMutation.isPending} onClick={() => saveMutation.mutate(undefined)}>
            Save
          </Button>
          <Button
            type="button"
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate(!settings?.isActive)}
          >
            {settings?.isActive ? 'Disconnect' : 'Save & go live'}
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-line-subtle bg-bg-card p-4">
        <div>
          <h2 className="font-semibold">2. Webhooks</h2>
          <p className="text-sm text-text-secondary">
            In UrbanPiper, add these callback URLs and the custom header below so orders reach your POS.
          </p>
        </div>
        {settings ? (
          <div className="space-y-1.5 rounded-lg bg-bg-elevated p-3 text-sm">
            {(
              [
                ['Order relay', settings.webhookPaths.orders],
                ['Order status', settings.webhookPaths.status],
                ['Rider status', settings.webhookPaths.rider],
              ] as const
            ).map(([label, path]) => (
              <p key={label} className="break-all">
                <span className="text-text-muted">{label}:</span>{' '}
                <code className="text-xs">{absoluteApiUrl(path)}</code>
              </p>
            ))}
            <p>
              <span className="text-text-muted">Header:</span>{' '}
              <code className="text-xs">
                x-aggregator-secret: {revealedSecret ?? settings.webhookSecretFingerprint ?? '(generate a secret)'}
              </code>
            </p>
            {revealedSecret ? (
              <p className="text-xs text-status-warning">Copy the secret now. It will not be shown again.</p>
            ) : null}
          </div>
        ) : null}
        <Button type="button" variant="secondary" loading={secretMutation.isPending} onClick={() => secretMutation.mutate()}>
          {settings?.webhookSecretFingerprint ? 'Regenerate secret' : 'Generate secret'}
        </Button>
      </section>

      <section className="rounded-xl border border-line-subtle bg-bg-card p-4">
        <h2 className="font-semibold">3. Outlets</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Link each outlet to its UrbanPiper store. The store ref id defaults to the Cullinos outlet id.
        </p>
        <ul className="mt-4 divide-y divide-line-subtle">
          {outlets.map((outlet) => {
            const cfg = settings?.outlets[outlet.id] ?? EMPTY_OUTLET;
            const refDraft = storeRefDrafts[outlet.id] ?? cfg.storeRefId ?? '';
            const save = (payload: Parameters<typeof urbanPiperApi.updateOutlet>[1]) =>
              outletMutation.mutate({ outletId: outlet.id, payload });
            return (
              <li key={outlet.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-4">
                  <p className="min-w-[160px] font-medium">
                    {outlet.name}
                    {outlet.id === selectedOutletId ? (
                      <span className="ml-2 text-xs text-text-muted">(selected)</span>
                    ) : null}
                  </p>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={cfg.connected} onChange={(e) => save({ connected: e.target.checked })} />
                    Connected
                  </label>
                  {(['swiggy', 'zomato'] as const).map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={cfg.platforms[p]}
                        disabled={!cfg.connected}
                        onChange={(e) => save({ platforms: { [p]: e.target.checked } })}
                      />
                      {p === 'swiggy' ? 'Swiggy' : 'Zomato'}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-64">
                    <Input
                      label="UrbanPiper store ref id"
                      value={refDraft}
                      placeholder={outlet.id}
                      onChange={(e) => setStoreRefDrafts((d) => ({ ...d, [outlet.id]: e.target.value }))}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={refDraft === (cfg.storeRefId ?? '')}
                    onClick={() => save({ storeRefId: refDraft.trim() || null })}
                  >
                    Save ref
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!settings?.isActive || !cfg.connected}
                    loading={pushMutation.isPending && pushMutation.variables === outlet.id}
                    onClick={() => pushMutation.mutate(outlet.id)}
                  >
                    Push menu
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!settings?.isActive || !cfg.connected}
                    loading={storeMutation.isPending && storeMutation.variables?.outletId === outlet.id}
                    onClick={() => storeMutation.mutate({ outletId: outlet.id, online: cfg.storeOnline === false })}
                  >
                    {cfg.storeOnline === false ? 'Go online' : 'Pause orders'}
                  </Button>
                </div>
                {cfg.lastMenuPushAt ? (
                  <p className={`text-xs ${cfg.lastMenuPushError ? 'text-status-error' : 'text-text-muted'}`}>
                    Last menu push {formatDate(cfg.lastMenuPushAt)}
                    {cfg.lastMenuPushError ? `: failed (${cfg.lastMenuPushError})` : ': ok'}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-line-subtle bg-bg-card p-4">
        <div>
          <h2 className="font-semibold">4. Item availability on Swiggy & Zomato</h2>
          <p className="text-sm text-text-secondary">
            Switch items off for one outlet when they run out. The Online toggle on the Menu page
            switches an item off everywhere and also syncs here.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-60">
            <Select
              label="Outlet"
              value={availabilityOutletId}
              onChange={(e) => setAvailabilityOutletId(e.target.value)}
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
            />
          </div>
          <div className="w-60">
            <Input label="Search items" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
          </div>
        </div>
        {!availabilityCfg?.connected ? (
          <p className="text-sm text-text-muted">Connect this outlet above to manage item availability.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-line-subtle overflow-y-auto rounded-lg border border-line-subtle">
            {filteredItems.map((item) => {
              const globallyOff = item.onlineAvailable === false;
              const available = !globallyOff && !disabledIds.has(item.id);
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {item.name}
                    {globallyOff ? <span className="ml-2 text-xs text-text-muted">Online off in Menu</span> : null}
                  </span>
                  <label className="flex shrink-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={available}
                      disabled={globallyOff || !settings?.isActive || availabilityMutation.isPending}
                      onChange={(e) => availabilityMutation.mutate({ itemId: item.id, available: e.target.checked })}
                    />
                    {available ? 'In stock' : 'Out of stock'}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-line-subtle bg-bg-card p-4">
        <div>
          <h2 className="font-semibold">5. Link unknown items</h2>
          <p className="text-sm text-text-secondary">
            Items pushed from Cullinos are linked automatically. Items created directly on Swiggy or
            Zomato show up here so you can link them for KOT routing, stock and reports.
          </p>
        </div>
        {settings?.unmappedItems.length ? (
          <ul className="divide-y divide-line-subtle rounded-lg border border-line-subtle">
            {settings.unmappedItems.map((u) => {
              const key = `${u.outletId}:${u.externalItemId}`;
              return (
                <li key={key} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-xs text-text-muted">
                      {u.platform ?? 'aggregator'} · {outletName(u.outletId)} · seen {u.count}× · id {u.externalItemId}
                    </p>
                  </div>
                  <select
                    value={mapDrafts[key] ?? ''}
                    onChange={(e) => setMapDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    className="h-9 w-56 rounded-lg border border-line bg-bg-elevated px-2 text-sm"
                    aria-label={`Menu item for ${u.name}`}
                  >
                    <option value="">Choose menu item…</option>
                    {menuItems.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!mapDrafts[key]}
                    loading={mapMutation.isPending}
                    onClick={() =>
                      mapMutation.mutate({
                        outletId: u.outletId,
                        externalItemId: u.externalItemId,
                        menuItemId: mapDrafts[key],
                      })
                    }
                  >
                    Link
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">All incoming items are linked.</p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-line-subtle bg-bg-card p-4">
        <div>
          <h2 className="font-semibold">6. Payout reconciliation</h2>
          <p className="text-sm text-text-secondary">
            Paste the settlement CSV from Swiggy or Zomato (columns: provider, external_order_id,
            order_date, gross_amount, commission, payout, outlet_id) to match payouts to POS orders.
          </p>
        </div>
        <textarea
          value={settlementCsv}
          onChange={(e) => setSettlementCsv(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-line bg-bg-elevated p-2 font-mono text-xs"
          placeholder="provider,external_order_id,order_date,gross_amount,commission,payout,outlet_id"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!settlementCsv.trim()}
          loading={importMutation.isPending}
          onClick={() => importMutation.mutate()}
        >
          Import settlements
        </Button>
        {reconciliationQuery.data ? (
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            <p>
              <span className="text-text-muted">Last 30 days:</span> {reconciliationQuery.data.summary.count} rows
            </p>
            <p>
              <span className="text-text-muted">Matched:</span> {reconciliationQuery.data.summary.matched} /{' '}
              {reconciliationQuery.data.summary.count}
            </p>
            <p>
              <span className="text-text-muted">Commission:</span>{' '}
              {formatMoney(Math.round(reconciliationQuery.data.summary.totalCommission * 100))}
            </p>
            <p>
              <span className="text-text-muted">Payout:</span>{' '}
              {formatMoney(Math.round(reconciliationQuery.data.summary.totalPayout * 100))}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
