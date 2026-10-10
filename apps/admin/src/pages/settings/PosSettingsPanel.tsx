import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardHeader, ErrorBanner, Input, Select, useToast } from '@cullinos/ui';
import { POS_QUICK_KEY_SLOTS, posQuickKeyLabel } from '@cullinos/shared';
import {
  menuApi,
  outletsApi,
  type KdsServedCompletesOrder,
  type MenuItem,
  type PosQuickKey,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const KDS_OPTIONS: Array<{ value: KdsServedCompletesOrder; label: string }> = [
  { value: 'always', label: 'Always complete the order (even with a balance due)' },
  { value: 'paid_only', label: 'Complete only when fully paid' },
  { value: 'off', label: 'Never — staff completes it manually' },
];

const SLOTS = Array.from({ length: POS_QUICK_KEY_SLOTS }, (_, i) => i + 1);

function slotHint(slot: number) {
  return slot <= 9 ? `${posQuickKeyLabel(slot)} / Alt+${slot}` : posQuickKeyLabel(slot);
}

export function PosSettingsPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const itemsQuery = useQuery({ queryKey: ['menu', 'items'], queryFn: menuApi.listItems });

  const [outletId, setOutletId] = useState<string | null>(selectedOutletId);
  const outlet =
    outletsQuery.data?.find((o) => o.id === outletId) ?? outletsQuery.data?.[0] ?? null;

  const [timeout, setTimeoutMinutes] = useState('60');
  const [kdsMode, setKdsMode] = useState<KdsServedCompletesOrder>('always');
  const [slots, setSlots] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!outlet) return;
    setTimeoutMinutes(String(outlet.qrSessionTimeoutMinutes ?? 60));
    setKdsMode(outlet.kdsServedCompletesOrder ?? 'always');
    setSlots(
      Object.fromEntries((outlet.posQuickKeys ?? []).map((k) => [k.slot, k.menuItemId])),
    );
  }, [outlet]);

  const saveOutlet = useMutation({
    mutationFn: (payload: Parameters<typeof outletsApi.update>[1]) => {
      if (!outlet) throw new Error('Select an outlet');
      return outletsApi.update(outlet.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      toast.success('POS settings saved.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const items = useMemo(
    () => [...(itemsQuery.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [itemsQuery.data],
  );
  const itemOptions = useMemo(
    () => [
      { value: '', label: '— Empty —' },
      ...items.map((i) => ({
        value: i.id,
        label: i.shortCode ? `${i.name} (${i.shortCode})` : i.name,
      })),
    ],
    [items],
  );

  function saveService() {
    const minutes = Number(timeout);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
      toast.error('Session timeout must be between 0 and 1440 minutes.');
      return;
    }
    saveOutlet.mutate({ qrSessionTimeoutMinutes: minutes, kdsServedCompletesOrder: kdsMode });
  }

  function saveQuickKeys() {
    const posQuickKeys: PosQuickKey[] = SLOTS.filter((slot) => slots[slot]).map((slot) => ({
      slot,
      menuItemId: slots[slot],
    }));
    saveOutlet.mutate({ posQuickKeys });
  }

  if (outletsQuery.error) {
    return <ErrorBanner>Could not load outlets.</ErrorBanner>;
  }

  return (
    <div className="space-y-6">
      {(outletsQuery.data?.length ?? 0) > 1 ? (
        <div className="max-w-xs">
          <Select
            label="Outlet"
            value={outlet?.id ?? ''}
            onChange={(e) => setOutletId(e.target.value)}
            options={(outletsQuery.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
          />
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Table service"
          description="How long idle QR tables stay open, and what happens when the kitchen serves an order."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Input
              label="QR session timeout (minutes)"
              type="number"
              min={0}
              max={1440}
              value={timeout}
              onChange={(e) => setTimeoutMinutes(e.target.value)}
            />
            <p className="text-xs text-text-muted">
              After this much inactivity, unsent QR carts are cancelled and the table is freed.
              Tables with orders already in the kitchen are flagged “Stale” for staff instead. 0
              turns expiry off.
            </p>
          </div>
          <div className="space-y-1">
            <Select
              label="When KDS marks an order served"
              value={kdsMode}
              onChange={(e) => setKdsMode(e.target.value as KdsServedCompletesOrder)}
              options={KDS_OPTIONS}
            />
            <p className="text-xs text-text-muted">
              Completing frees the table. Any unpaid balance is recorded on the order timeline.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={saveService} loading={saveOutlet.isPending} disabled={!outlet}>
            Save table service
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="POS quick keys"
          description="Pin best-sellers to keyboard keys. Cashiers press the key to add the item instantly."
        />
        {itemsQuery.isLoading ? (
          <p className="text-sm text-text-muted">Loading menu…</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SLOTS.map((slot) => (
              <Select
                key={slot}
                label={slotHint(slot)}
                value={slots[slot] ?? ''}
                onChange={(e) => setSlots((s) => ({ ...s, [slot]: e.target.value }))}
                options={itemOptions}
              />
            ))}
          </div>
        )}
        <div className="mt-4">
          <Button onClick={saveQuickKeys} loading={saveOutlet.isPending} disabled={!outlet}>
            Save quick keys
          </Button>
        </div>
      </Card>

      <ShortCodesCard items={items} loading={itemsQuery.isLoading} />
    </div>
  );
}

function ShortCodesCard({ items, loading }: { items: MenuItem[]; loading: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const saveCode = useMutation({
    mutationFn: ({ id, shortCode }: { id: string; shortCode: string }) =>
      menuApi.updateItem(id, { shortCode: shortCode || null }),
    onSuccess: (saved) => {
      setDrafts((d) => {
        const next = { ...d };
        delete next[saved.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      toast.success(`Short code saved for ${saved.name}.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const q = filter.trim().toLowerCase();
  const visible = q
    ? items.filter(
        (i) => i.name.toLowerCase().includes(q) || i.shortCode?.toLowerCase().includes(q),
      )
    : items;

  return (
    <Card>
      <CardHeader
        title="Item short codes"
        description="Type a code in POS search and press Enter to add the item. Letters and digits, up to 8 characters."
      />
      <div className="mb-3 max-w-xs">
        <Input
          label="Find item"
          placeholder="Name or code"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {loading ? (
        <p className="text-sm text-text-muted">Loading menu…</p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-line-subtle overflow-y-auto rounded-lg border border-line-subtle">
          {visible.map((item) => {
            const draft = drafts[item.id];
            const value = draft ?? item.shortCode ?? '';
            const dirty = draft !== undefined && draft !== (item.shortCode ?? '');
            return (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                <input
                  aria-label={`Short code for ${item.name}`}
                  value={value}
                  maxLength={8}
                  placeholder="—"
                  onChange={(e) =>
                    setDrafts((d) => ({
                      ...d,
                      [item.id]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && dirty) saveCode.mutate({ id: item.id, shortCode: value });
                  }}
                  className="h-9 w-24 rounded-lg border border-line bg-bg-elevated px-2 font-mono text-sm uppercase outline-none focus:border-brand-primary"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!dirty}
                  loading={saveCode.isPending && saveCode.variables?.id === item.id}
                  onClick={() => saveCode.mutate({ id: item.id, shortCode: value })}
                >
                  Save
                </Button>
              </li>
            );
          })}
          {visible.length === 0 ? (
            <li className="px-3 py-4 text-sm text-text-muted">No matching items.</li>
          ) : null}
        </ul>
      )}
    </Card>
  );
}
