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
import { Button, Input, PageShell, PhoneField } from '@cullinos/ui';
import {
  organizationsApi,
  outletsApi,
  settingsApi,
} from '@/lib/api';
import { DevicesSettingsPanel, TaxGroupsSettingsPanel } from './settings/TaxAndDevicesPanels';

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
  const [outletForm, setOutletForm] = useState({ name: '', city: '', phone: '', gstin: '' });
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

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const orgQuery = useQuery({ queryKey: ['organizations', 'current'], queryFn: organizationsApi.current });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });

  const createOutletMutation = useMutation({
    mutationFn: () => outletsApi.create({
      name: outletForm.name,
      city: outletForm.city || undefined,
      phone: outletForm.phone || undefined,
      gstin: outletForm.gstin || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      setOutletForm({ name: '', city: '', phone: '', gstin: '' });
      setOutletNotice({ type: 'success', text: 'Outlet created successfully!' });
      setTimeout(() => setOutletNotice(null), 5000);
    },
    onError: (err: Error) => {
      setOutletNotice({ type: 'error', text: err.message ?? 'Failed to create outlet.' });
      setTimeout(() => setOutletNotice(null), 5000);
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
    <PageShell
      className="mx-auto max-w-3xl"
      title="Settings"
      description="Everyday restaurant details. No technical setup required."
    >
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
          <PhoneField
            label="Phone"
            value={form.phone}
            onChange={(phone) => setForm((f) => ({ ...f, phone }))}
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
              {parent === 'qsr' ? ` Â· ${BUSINESS_TYPE_LABELS[businessType]}` : null}
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
                <p className="text-xs text-text-muted">
                  {[outlet.city, outlet.phone, outlet.gstin ? `GSTIN ${outlet.gstin}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'No details'}
                </p>
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
          <div className="grid gap-3 sm:grid-cols-2">
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
            <PhoneField
              label="Phone"
              placeholder="+91 9900000000"
              value={outletForm.phone}
              onChange={(phone) => setOutletForm((f) => ({ ...f, phone }))}
            />
            <Input
              label="GSTIN"
              placeholder="27AAAAA0000A1Z5"
              value={outletForm.gstin}
              onChange={(e) => setOutletForm((f) => ({ ...f, gstin: e.target.value }))}
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

      <TaxGroupsSettingsPanel />
      <DevicesSettingsPanel />

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={!form.name.trim()}
        loading={saveMutation.isPending}
      >
        Save settings
      </Button>
    </PageShell>
  );
}
