import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BUSINESS_TYPE_LABELS,
  BUSINESS_TYPE_PARENT_LABELS,
  BUSINESS_TYPES,
  FEATURES,
  RESTAURANT_SIZES,
  getBusinessTypeParent,
  isNavFeatureVisible,
  type BusinessType,
  type RestaurantSize,
} from '@cullinos/shared';
import { Button, Input } from '@cullinos/ui';
import {
  devicesApi,
  organizationsApi,
  outletsApi,
  settingsApi,
  taxApi,
} from '@/lib/api';

function parseRestaurantSize(value: string | null | undefined): RestaurantSize | null {
  if (!value) return null;
  return (RESTAURANT_SIZES as readonly string[]).includes(value)
    ? (value as RestaurantSize)
    : null;
}

const ORDER_OPTIONS = [
  { id: 'dine_in', label: 'Dine-in', hint: 'Customers sit at tables' },
  { id: 'takeaway', label: 'Takeaway / pickup', hint: 'Orders packed to go' },
  { id: 'delivery', label: 'Home delivery', hint: 'Sent to the customer address' },
  { id: 'qr', label: 'QR ordering', hint: 'Scan a table code to order' },
] as const;

type OrderOptionId = (typeof ORDER_OPTIONS)[number]['id'];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [outletForm, setOutletForm] = useState({ name: '', city: '', phone: '' });
  const [outletNotice, setOutletNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    gstin: '',
  });
  const [orderTypes, setOrderTypes] = useState<Record<OrderOptionId, boolean>>({
    dine_in: true,
    takeaway: true,
    delivery: false,
    qr: false,
  });
  const [preOrdersEnabled, setPreOrdersEnabled] = useState(true);
  const [taxName, setTaxName] = useState('');
  const [taxRateName, setTaxRateName] = useState('CGST');
  const [taxRate, setTaxRate] = useState('2.5');
  const [taxNotice, setTaxNotice] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<'printer' | 'kds' | 'pos'>('printer');
  const [deviceNotice, setDeviceNotice] = useState<string | null>(null);

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const orgQuery = useQuery({ queryKey: ['organizations', 'current'], queryFn: organizationsApi.current });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const taxQuery = useQuery({ queryKey: ['tax'], queryFn: taxApi.list });
  const devicesQuery = useQuery({ queryKey: ['devices'], queryFn: devicesApi.list });

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

  const createTaxMutation = useMutation({
    mutationFn: () =>
      taxApi.createGroup({
        name: taxName,
        rates: [{ name: taxRateName || 'Rate', rate: Number(taxRate) || 0 }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax'] });
      setTaxName('');
      setTaxRateName('CGST');
      setTaxRate('2.5');
      setTaxNotice('Tax group created.');
      setTimeout(() => setTaxNotice(null), 4000);
    },
    onError: (err: Error) => {
      setTaxNotice(err.message ?? 'Failed to create tax group.');
    },
  });

  const createDeviceMutation = useMutation({
    mutationFn: () =>
      devicesApi.create({
        name: deviceName,
        type: deviceType,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setDeviceName('');
      setDeviceType('printer');
      setDeviceNotice('Device registered.');
      setTimeout(() => setDeviceNotice(null), 4000);
    },
    onError: (err: Error) => {
      setDeviceNotice(err.message ?? 'Failed to register device.');
    },
  });

  useEffect(() => {
    const org = orgQuery.data;
    if (!org) return;
    setForm({
      name: org.name ?? '',
      phone: org.phone ?? '',
      email: org.email ?? '',
      address: org.address ?? '',
      city: org.city ?? '',
      gstin: org.gstin ?? '',
    });
  }, [orgQuery.data]);

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    if (!settings) return;
    const raw = settings.enabledOrderTypes;
    if (Array.isArray(raw)) {
      const enabled = new Set(raw.filter((value): value is string => typeof value === 'string'));
      setOrderTypes({
        dine_in: enabled.has('dine_in'),
        takeaway: enabled.has('takeaway'),
        delivery: enabled.has('delivery'),
        qr: enabled.has('qr'),
      });
    }
    if (typeof settings.preOrdersEnabled === 'boolean') {
      setPreOrdersEnabled(settings.preOrdersEnabled);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await organizationsApi.updateCurrent({
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        gstin: form.gstin || null,
      });
      const enabledOrderTypes = ORDER_OPTIONS.filter((option) => orderTypes[option.id]).map((option) => option.id);
      await settingsApi.update({ enabledOrderTypes, preOrdersEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
    },
  });

  const rawType = orgQuery.data?.businessType;
  const businessType =
    rawType && (BUSINESS_TYPES as readonly string[]).includes(rawType)
      ? (rawType as BusinessType)
      : null;
  const restaurantSize = parseRestaurantSize(orgQuery.data?.restaurantSize);
  const parent = businessType ? getBusinessTypeParent(businessType) : null;
  const showPreOrders = isNavFeatureVisible(businessType, FEATURES.PRE_ORDERS, restaurantSize);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Everyday restaurant details. No technical setup required.
        </p>
      </div>

      {orgQuery.error || settingsQuery.error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          Failed to load settings
        </div>
      ) : null}

      {saveMutation.isSuccess ? (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          Settings saved.
        </div>
      ) : null}

      {saveMutation.isError ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {saveMutation.error instanceof Error ? saveMutation.error.message : 'Could not save settings.'}
        </div>
      ) : null}

      <div className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">Restaurant details</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Shown on bills, staff apps, and customer-facing screens.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Restaurant name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="GSTIN"
            value={form.gstin}
            onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
          />
          <Input
            label="City"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-white/5 bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">How customers order</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Turn on the order types you actually use.
          </p>
        </div>
        <div className="space-y-2">
          {ORDER_OPTIONS.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-bg-elevated px-3 py-3"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand-primary"
                checked={orderTypes[option.id]}
                onChange={(e) =>
                  setOrderTypes((current) => ({ ...current, [option.id]: e.target.checked }))
                }
              />
              <span>
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {showPreOrders ? (
        <div className="space-y-3 rounded-xl border border-white/5 bg-bg-card p-5">
          <div>
            <h2 className="font-semibold">Pre-orders</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Allow customers and staff to schedule a pickup time when placing orders.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/5 bg-bg-elevated px-3 py-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-brand-primary"
              checked={preOrdersEnabled}
              onChange={(e) => setPreOrdersEnabled(e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">Enable pre-orders & scheduling</span>
              <span className="block text-xs text-text-muted">
                When on, scheduled orders appear with a badge on the Orders page.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      <div className="space-y-2 rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="font-semibold">Business category</h2>
        <p className="text-sm text-text-secondary">
          {businessType && parent ? (
            <>
              {BUSINESS_TYPE_PARENT_LABELS[parent]}
              {parent === 'qsr' ? ` · ${BUSINESS_TYPE_LABELS[businessType]}` : null}
            </>
          ) : (
            'Not set yet.'
          )}
        </p>
        <p className="text-xs text-text-muted">
          This controls which screens you see (tables, kitchen, pickup queue, and so on).
        </p>
        <Link
          to="/onboarding"
          className="inline-flex h-11 items-center rounded-lg bg-bg-elevated px-4 text-sm font-medium text-text-primary hover:bg-white/5"
        >
          Open restaurant setup
        </Link>
      </div>

      <div className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">Locations</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Each outlet is a restaurant location. Add another if you have more than one place.
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
          <h3 className="mb-3 text-sm font-medium">Add a location</h3>
          {outletNotice && (
            <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${outletNotice.type === 'success' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
              {outletNotice.text}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Location name *"
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
              Add location
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">Tax groups</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Create GST / tax groups and rates used on menu items.
          </p>
        </div>
        <ul className="divide-y divide-white/5">
          {(taxQuery.data ?? []).map((group) => (
            <li key={group.id} className="py-3">
              <p className="font-medium">{group.name}</p>
              <p className="text-xs text-text-muted">
                {(group.rates ?? [])
                  .map((r) => `${r.name} ${Number(r.rate)}%`)
                  .join(' · ') || 'No rates'}
              </p>
            </li>
          ))}
          {(taxQuery.data ?? []).length === 0 ? (
            <li className="py-3 text-sm text-text-muted">No tax groups yet.</li>
          ) : null}
        </ul>
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            createTaxMutation.mutate();
          }}
        >
          <Input
            label="Group name"
            required
            placeholder="GST 5%"
            value={taxName}
            onChange={(e) => setTaxName(e.target.value)}
          />
          <Input
            label="Rate name"
            value={taxRateName}
            onChange={(e) => setTaxRateName(e.target.value)}
          />
          <Input
            label="Rate %"
            type="number"
            min={0}
            step="any"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
          />
          <div className="sm:col-span-3 flex items-center gap-3">
            <Button type="submit" loading={createTaxMutation.isPending} disabled={!taxName.trim()}>
              Create tax group
            </Button>
            {taxNotice ? <p className="text-sm text-text-secondary">{taxNotice}</p> : null}
          </div>
        </form>
      </div>

      <div className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">Devices</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Register printers, kitchen displays, and POS terminals.
          </p>
        </div>
        <ul className="divide-y divide-white/5">
          {(devicesQuery.data ?? []).map((device) => (
            <li key={device.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{device.name}</p>
                <p className="text-xs text-text-muted">{device.type}</p>
              </div>
            </li>
          ))}
          {(devicesQuery.data ?? []).length === 0 ? (
            <li className="py-3 text-sm text-text-muted">No devices registered.</li>
          ) : null}
        </ul>
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            createDeviceMutation.mutate();
          }}
        >
          <Input
            label="Device name"
            required
            placeholder="Receipt printer"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
          <label className="space-y-1 text-sm">
            <span className="text-text-secondary">Type</span>
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as 'printer' | 'kds' | 'pos')}
              className="block h-11 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary"
            >
              <option value="printer">Printer</option>
              <option value="kds">KDS</option>
              <option value="pos">POS</option>
            </select>
          </label>
          <div className="flex items-end">
            <Button type="submit" loading={createDeviceMutation.isPending} disabled={!deviceName.trim()}>
              Register device
            </Button>
          </div>
          {deviceNotice ? (
            <p className="sm:col-span-3 text-sm text-text-secondary">{deviceNotice}</p>
          ) : null}
        </form>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={!form.name.trim()}
        loading={saveMutation.isPending}
      >
        Save settings
      </Button>
    </div>
  );
}
