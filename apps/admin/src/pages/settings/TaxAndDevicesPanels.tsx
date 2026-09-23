/**
 * Settings tax + devices panels — extracted for maintainability.
 * Used only by SettingsPage.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, Input, useToast } from '@cullinos/ui';
import {
  devicesApi,
  outletsApi,
  taxApi,
  type DeviceRow,
  type TaxGroupRow,
} from '@/lib/api';
import {
  buildTestPrintOrder,
  printWithProfile,
} from '@/features/pos/printHelper';
import { useAuthStore } from '@/stores/auth';

const ONLINE_MS = 2 * 60_000;

function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_MS;
}

function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return 'Never';
  const d = new Date(lastSeenAt);
  return d.toLocaleString();
}

function DeviceTypeIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  const label = t === 'printer' ? 'Printer' : t === 'kds' ? 'KDS' : t === 'pos' ? 'POS' : type;
  const glyph = t === 'printer' ? 'P' : t === 'kds' ? 'K' : t === 'pos' ? '$' : '?';
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-xs font-bold text-brand-primary"
      title={label}
      aria-label={label}
    >
      {glyph}
    </span>
  );
}

export function TaxGroupsSettingsPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [taxName, setTaxName] = useState('');
  const [cgstRate, setCgstRate] = useState('2.5');
  const [sgstRate, setSgstRate] = useState('2.5');
  const [mode, setMode] = useState<'gst' | 'excise'>('gst');
  const [exciseRate, setExciseRate] = useState('0');

  const taxQuery = useQuery({ queryKey: ['tax'], queryFn: taxApi.list });

  const createTaxMutation = useMutation({
    mutationFn: () => {
      if (mode === 'excise') {
        return taxApi.createGroup({
          name: taxName.trim() || 'State Excise (alcohol)',
          rates: [
            {
              name: 'State Excise',
              rate: Number(exciseRate) || 0,
              type: 'EXCISE',
            },
          ],
        });
      }
      return taxApi.createGroup({
        name: taxName,
        rates: [
          { name: 'CGST', rate: Number(cgstRate) || 0, type: 'CGST' },
          { name: 'SGST', rate: Number(sgstRate) || 0, type: 'SGST' },
        ],
      });
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ['tax'] });
      setTaxName('');
      setCgstRate('2.5');
      setSgstRate('2.5');
      toast.success(`${group.name} created`);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create tax group.'),
  });

  const ensurePresetsMutation = useMutation({
    mutationFn: taxApi.ensurePresets,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tax'] });
      toast.success(
        res.created.length
          ? `Added ${res.created.length} preset group(s)`
          : 'All India presets already present',
      );
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to seed presets.'),
  });

  const deleteTaxMutation = useMutation({
    mutationFn: (id: string) => taxApi.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax'] });
      toast.success('Tax group deleted');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to delete.'),
  });

  return (
    <div className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Tax groups</h2>
          <p className="mt-1 text-sm text-text-secondary">
            CGST and SGST are stored separately for each GST group. Use State Excise for alcohol
            (outside GST).
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          loading={ensurePresetsMutation.isPending}
          onClick={() => ensurePresetsMutation.mutate()}
        >
          Seed India presets
        </Button>
      </div>
      <ul className="divide-y divide-white/5">
        {(taxQuery.data ?? []).map((group: TaxGroupRow) => (
          <li key={group.id} className="flex items-start justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{group.name}</p>
              <p className="text-xs text-text-muted">
                {(group.rates ?? [])
                  .map((r) => `${r.name} ${Number(r.rate)}% (${r.type})`)
                  .join(' · ') || 'No rates'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="text-xs text-red-400"
              onClick={() => {
                if (window.confirm(`Delete tax group "${group.name}"?`)) {
                  deleteTaxMutation.mutate(group.id);
                }
              }}
            >
              Delete
            </Button>
          </li>
        ))}
        {(taxQuery.data ?? []).length === 0 ? (
          <li className="py-3 text-sm text-text-muted">No tax groups yet.</li>
        ) : null}
      </ul>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          createTaxMutation.mutate();
        }}
      >
        <Input
          label="Group name"
          required={mode === 'gst'}
          placeholder={mode === 'gst' ? 'Restaurant (5%)' : 'State Excise (alcohol)'}
          value={taxName}
          onChange={(e) => setTaxName(e.target.value)}
        />
        <label className="space-y-1 text-sm">
          <span className="text-text-secondary">Type</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as 'gst' | 'excise')}
            className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
          >
            <option value="gst">GST (CGST + SGST)</option>
            <option value="excise">State Excise</option>
          </select>
        </label>
        {mode === 'gst' ? (
          <>
            <Input
              label="CGST %"
              type="number"
              min={0}
              step="any"
              value={cgstRate}
              onChange={(e) => setCgstRate(e.target.value)}
            />
            <Input
              label="SGST %"
              type="number"
              min={0}
              step="any"
              value={sgstRate}
              onChange={(e) => setSgstRate(e.target.value)}
            />
          </>
        ) : (
          <Input
            label="Excise %"
            type="number"
            min={0}
            step="any"
            value={exciseRate}
            onChange={(e) => setExciseRate(e.target.value)}
          />
        )}
        <div className="sm:col-span-2">
          <Button
            type="submit"
            loading={createTaxMutation.isPending}
            disabled={mode === 'gst' && !taxName.trim()}
          >
            Create tax group
          </Button>
        </div>
      </form>
    </div>
  );
}

type DeviceFormState = {
  name: string;
  type: 'printer' | 'kds' | 'pos';
  outletId: string;
  paperWidthMm: string;
  connectionType: 'wifi' | 'bluetooth' | 'usb';
  printCategories: Array<'kitchen' | 'bar' | 'billing'>;
};

const emptyDeviceForm = (): DeviceFormState => ({
  name: '',
  type: 'printer',
  outletId: '',
  paperWidthMm: '80',
  connectionType: 'wifi',
  printCategories: ['billing'],
});

export function DevicesSettingsPanel() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const selectedOutletId = useAuthStore((s) => s.selectedOutletId);
  const [form, setForm] = useState<DeviceFormState>(emptyDeviceForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pairing, setPairing] = useState<{
    code: string;
    qrPayload: string;
  } | null>(null);

  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: () => devicesApi.list() });
  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const failedJobsQuery = useQuery({
    queryKey: ['devices', 'print-jobs', 'failed'],
    queryFn: () => devicesApi.listPrintJobs('failed'),
  });

  const grouped = useMemo(() => {
    const rows = devicesQuery.data ?? [];
    const sections: Array<{ key: string; title: string; devices: DeviceRow[] }> = [
      { key: 'printer', title: 'Printers', devices: [] },
      { key: 'kds', title: 'KDS', devices: [] },
      { key: 'pos', title: 'POS Terminals', devices: [] },
      { key: 'other', title: 'Other', devices: [] },
    ];
    for (const d of rows) {
      const section =
        sections.find((s) => s.key === d.type) ?? sections.find((s) => s.key === 'other')!;
      section.devices.push(d);
    }
    return sections.filter((s) => s.devices.length > 0);
  }, [devicesQuery.data]);

  const createMutation = useMutation({
    mutationFn: () =>
      devicesApi.create({
        name: form.name,
        type: form.type,
        outletId: form.outletId || undefined,
        metadata:
          form.type === 'printer'
            ? {
                paperWidthMm: Number(form.paperWidthMm) || 80,
                connectionType: form.connectionType,
                printCategories: form.printCategories,
              }
            : { printCategories: form.printCategories },
      }),
    onSuccess: (device) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setForm(emptyDeviceForm());
      setEditingId(null);
      toast.success(`${device.name} added successfully`);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to register device.'),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      devicesApi.update(editingId!, {
        name: form.name,
        type: form.type,
        outletId: form.outletId || null,
        metadata:
          form.type === 'printer'
            ? {
                paperWidthMm: Number(form.paperWidthMm) || 80,
                connectionType: form.connectionType,
                printCategories: form.printCategories,
              }
            : { printCategories: form.printCategories },
      }),
    onSuccess: (device) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setForm(emptyDeviceForm());
      setEditingId(null);
      toast.success(`${device.name} updated`);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to update device.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => devicesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device removed');
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to delete.'),
  });

  const pairingMutation = useMutation({
    mutationFn: () =>
      devicesApi.createPairingSession({
        type: form.type,
        outletId: form.outletId || selectedOutletId || undefined,
        nameHint: form.name || undefined,
      }),
    onSuccess: (res) => {
      setPairing({ code: res.code, qrPayload: res.qrPayload });
      toast.success(`Pairing code ${res.code} ready`);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Failed to create pairing code.'),
  });

  const claimMutation = useMutation({
    mutationFn: (code: string) =>
      devicesApi.claimPairing({
        code,
        name: form.name || undefined,
        platform: 'browser',
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setPairing(null);
      toast.success(`${res.device.name} paired successfully`);
    },
    onError: (err: Error) => toast.error(err.message ?? 'Pairing failed.'),
  });

  function startEdit(device: DeviceRow) {
    const meta = device.metadata ?? {};
    setEditingId(device.id);
    setForm({
      name: device.name,
      type: (['printer', 'kds', 'pos'].includes(device.type)
        ? device.type
        : 'printer') as DeviceFormState['type'],
      outletId: device.outletId ?? '',
      paperWidthMm: String(meta.paperWidthMm ?? 80),
      connectionType: (meta.connectionType as DeviceFormState['connectionType']) || 'wifi',
      printCategories: (meta.printCategories as DeviceFormState['printCategories']) ?? [
        'billing',
      ],
    });
  }

  async function testPrint(device: DeviceRow) {
    const outletId = device.outletId || selectedOutletId;
    if (!outletId) {
      toast.error('Select an outlet or assign one to the printer');
      return;
    }
    try {
      await printWithProfile('receipt', outletId, buildTestPrintOrder(device.name), {
        deviceId: device.id,
        recordJob: true,
      });
      toast.success('Test print sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test print failed');
      await devicesApi
        .createPrintJob({
          outletId,
          deviceId: device.id,
          kind: 'receipt',
          status: 'failed',
          error: err instanceof Error ? err.message : 'Test print failed',
          payloadSummary: `Test print · ${device.name}`,
        })
        .catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ['devices', 'print-jobs'] });
    }
  }

  async function retryJob(jobId: string, deviceId: string | null, outletId: string | null) {
    const oid = outletId || selectedOutletId;
    if (!oid) {
      toast.error('No outlet for reprint');
      return;
    }
    try {
      await printWithProfile(
        'receipt',
        oid,
        buildTestPrintOrder('Reprint'),
        { deviceId: deviceId ?? undefined, recordJob: true },
      );
      await devicesApi.updatePrintJob(jobId, { status: 'done', error: null });
      queryClient.invalidateQueries({ queryKey: ['devices', 'print-jobs'] });
      toast.success('Reprint sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reprint failed');
    }
  }

  function toggleCategory(cat: 'kitchen' | 'bar' | 'billing') {
    setForm((f) => ({
      ...f,
      printCategories: f.printCategories.includes(cat)
        ? f.printCategories.filter((c) => c !== cat)
        : [...f.printCategories, cat],
    }));
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-5">
      <div>
        <h2 className="font-semibold">Devices</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Register printers, kitchen displays, and POS terminals. Virtual display heartbeats are
          hidden here.
        </p>
      </div>

      {devicesQuery.isLoading ? (
        <p className="text-sm text-text-muted">Loading devices…</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-text-muted">No devices registered.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map((section) => (
            <div key={section.key}>
              <h3 className="mb-2 text-sm font-medium text-text-secondary">{section.title}</h3>
              <ul className="space-y-2">
                {section.devices.map((device) => {
                  const online = isOnline(device.lastSeenAt);
                  return (
                    <li
                      key={device.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-bg-elevated/40 px-3 py-3"
                    >
                      <DeviceTypeIcon type={device.type} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-400'}`}
                            title={online ? 'Online' : 'Offline'}
                          />
                          <p className="font-medium">{device.name}</p>
                        </div>
                        <p className="text-xs text-text-muted">
                          {online ? 'Online' : 'Offline'} · Last seen {formatLastSeen(device.lastSeenAt)}
                          {device.metadata?.connectionType
                            ? ` · ${String(device.metadata.connectionType)}`
                            : ''}
                          {device.metadata?.printCategories?.length
                            ? ` · ${(device.metadata.printCategories as string[]).join(', ')}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {device.type === 'printer' ? (
                          <Button type="button" variant="secondary" onClick={() => void testPrint(device)}>
                            Test print
                          </Button>
                        ) : null}
                        <Button type="button" variant="ghost" onClick={() => startEdit(device)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-400"
                          onClick={() => {
                            if (window.confirm(`Delete "${device.name}"?`)) {
                              deleteMutation.mutate(device.id);
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {(failedJobsQuery.data ?? []).length > 0 ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <h3 className="text-sm font-medium text-red-300">Failed print jobs</h3>
          <ul className="mt-2 space-y-2">
            {(failedJobsQuery.data ?? []).map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-text-secondary">
                  {job.payloadSummary || job.kind} · {job.error || 'failed'}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void retryJob(job.id, job.deviceId, job.outletId)}
                >
                  Retry
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pairing ? (
        <div className="rounded-lg border border-brand-primary/30 bg-bg-elevated p-4 text-center">
          <p className="text-sm text-text-secondary">Pairing code</p>
          <p className="mt-1 font-mono text-2xl tracking-widest text-brand-primary">{pairing.code}</p>
          <img
            alt="Pairing QR"
            className="mx-auto mt-3 rounded bg-white p-2"
            width={128}
            height={128}
            src={`https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=${encodeURIComponent(pairing.qrPayload)}`}
          />
          <div className="mt-3 flex justify-center gap-2">
            <Button
              type="button"
              loading={claimMutation.isPending}
              onClick={() => claimMutation.mutate(pairing.code)}
            >
              Complete pairing here
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPairing(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (editingId) updateMutation.mutate();
          else createMutation.mutate();
        }}
      >
        <Input
          label="Device name"
          required
          placeholder="Receipt printer"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <label className="space-y-1 text-sm">
          <span className="text-text-secondary">Type</span>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value as DeviceFormState['type'],
              }))
            }
            className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
          >
            <option value="printer">Printer</option>
            <option value="kds">KDS</option>
            <option value="pos">POS</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-text-secondary">Outlet</span>
          <select
            value={form.outletId}
            onChange={(e) => setForm((f) => ({ ...f, outletId: e.target.value }))}
            className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
          >
            <option value="">Any / unset</option>
            {(outletsQuery.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        {form.type === 'printer' ? (
          <>
            <Input
              label="Paper size (mm)"
              type="number"
              value={form.paperWidthMm}
              onChange={(e) => setForm((f) => ({ ...f, paperWidthMm: e.target.value }))}
            />
            <label className="space-y-1 text-sm">
              <span className="text-text-secondary">Connection type</span>
              <select
                value={form.connectionType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    connectionType: e.target.value as DeviceFormState['connectionType'],
                  }))
                }
                className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
              >
                <option value="wifi">WiFi</option>
                <option value="bluetooth">Bluetooth</option>
                <option value="usb">USB</option>
              </select>
            </label>
          </>
        ) : null}
        <div className="sm:col-span-2 space-y-2">
          <span className="text-sm text-text-secondary">Print categories</span>
          <div className="flex flex-wrap gap-3 text-sm">
            {(['kitchen', 'bar', 'billing'] as const).map((cat) => (
              <label key={cat} className="flex items-center gap-2 capitalize">
                <input
                  type="checkbox"
                  checked={form.printCategories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                />
                {cat}
              </label>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!form.name.trim()}
          >
            {editingId ? 'Save device' : 'Register device'}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(emptyDeviceForm());
              }}
            >
              Cancel edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            loading={pairingMutation.isPending}
            onClick={() => pairingMutation.mutate()}
          >
            Add via QR / pairing code
          </Button>
        </div>
      </form>
    </div>
  );
}
