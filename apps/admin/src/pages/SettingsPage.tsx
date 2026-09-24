import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
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
import { Button, Input, PageShell, PhoneField, TabPanel, Tabs } from '@cullinos/ui';
import {
  organizationsApi,
  outletsApi,
  settingsApi,
  type Outlet,
} from '@/lib/api';
import {
  SUPPORTED_LANGUAGES,
  applyLanguage,
  hasPersonalLanguage,
  isLanguageCode,
  type LanguageCode,
} from '@/i18n';
import { PaymentsSettingsPanel } from './settings/PaymentsSettingsPanel';
import { DevicesSettingsPanel, TaxGroupsSettingsPanel } from './settings/TaxAndDevicesPanels';

const SETTINGS_TAB_IDS = ['general', 'tax', 'devices', 'payments'] as const;

type SettingsTab = (typeof SETTINGS_TAB_IDS)[number];

function parseSettingsTab(value: string | null): SettingsTab {
  return SETTINGS_TAB_IDS.some((id) => id === value) ? (value as SettingsTab) : 'general';
}

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

const EMPTY_OUTLET_EDIT = { name: '', address: '', city: '', phone: '', gstin: '' };

function outletDetailParts(source: {
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  gstin?: string | null;
}): string[] {
  return [
    source.address,
    source.city,
    source.phone,
    source.gstin ? `GSTIN ${source.gstin}` : null,
  ].filter((part): part is string => Boolean(part && part.trim()));
}

export function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseSettingsTab(searchParams.get('tab'));
  const setActiveTab = (tab: SettingsTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'general') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };
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

  const [editingOutletId, setEditingOutletId] = useState<string | null>(null);
  const [outletEdit, setOutletEdit] = useState(EMPTY_OUTLET_EDIT);

  function startEditOutlet(outlet: Outlet) {
    setEditingOutletId(outlet.id);
    setOutletEdit({
      name: outlet.name,
      address: outlet.address ?? '',
      city: outlet.city ?? '',
      phone: outlet.phone ?? '',
      gstin: outlet.gstin ?? '',
    });
  }

  const updateOutletMutation = useMutation({
    mutationFn: (outletId: string) =>
      outletsApi.update(outletId, {
        name: outletEdit.name.trim(),
        address: outletEdit.address.trim(),
        city: outletEdit.city.trim(),
        phone: outletEdit.phone.trim(),
        gstin: outletEdit.gstin.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlets'] });
      setEditingOutletId(null);
      setOutletNotice({ type: 'success', text: 'Outlet details saved.' });
      setTimeout(() => setOutletNotice(null), 5000);
    },
  });

  const rawOrgLanguage = orgQuery.data?.language;
  const orgLanguage: LanguageCode = isLanguageCode(rawOrgLanguage) ? rawOrgLanguage : 'en';
  const languageMutation = useMutation({
    mutationFn: (language: LanguageCode) => settingsApi.update({ language }),
    onSuccess: (_data, language) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['organizations', 'current'] });
      if (!hasPersonalLanguage()) void applyLanguage(language);
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
      title={t('settings.title')}
      description={t('settings.description')}
    >
      <Tabs
        items={SETTINGS_TAB_IDS.map((id) => ({ id, label: t(`settings.tabs.${id}`) }))}
        value={activeTab}
        onChange={setActiveTab}
      />

      <TabPanel active={activeTab === 'general'} className="space-y-6">
      {orgQuery.error || settingsQuery.error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {t('settings.loadFailed')}
        </div>
      ) : null}

      {saveMutation.isSuccess ? (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {t('settings.saved')}
        </div>
      ) : null}

      {saveMutation.isError ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {saveMutation.error instanceof Error ? saveMutation.error.message : t('settings.saveFailed')}
        </div>
      ) : null}

      <div className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">{t('settings.restaurantDetails')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('settings.restaurantDetailsHint')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t('settings.restaurantName')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <PhoneField
            label={t('common.phone')}
            value={form.phone}
            onChange={(phone) => setForm((f) => ({ ...f, phone }))}
          />
          <Input
            label={t('common.email')}
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label={t('common.gstin')}
            value={form.gstin}
            onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value }))}
          />
          <Input
            label={t('common.city')}
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
          <Input
            label={t('common.address')}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-white/5 bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">{t('settings.languageTitle')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('settings.languageHint')}</p>
        </div>
        <select
          value={orgLanguage}
          disabled={languageMutation.isPending || !orgQuery.data}
          onChange={(e) => {
            if (isLanguageCode(e.target.value)) languageMutation.mutate(e.target.value);
          }}
          aria-label={t('settings.languageTitle')}
          className="h-11 w-full max-w-xs rounded-lg border border-white/10 bg-bg-elevated px-3 text-sm outline-none focus:border-brand-primary disabled:opacity-60"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
        {languageMutation.isSuccess ? (
          <p className="text-sm text-status-success">{t('settings.languageSaved')}</p>
        ) : null}
        {languageMutation.isError ? (
          <p className="text-sm text-status-error">
            {languageMutation.error instanceof Error
              ? languageMutation.error.message
              : t('settings.saveFailed')}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-white/5 bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">{t('settings.howCustomersOrder')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('settings.howCustomersOrderHint')}</p>
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
            <h2 className="font-semibold">{t('settings.preOrders')}</h2>
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
        <h2 className="font-semibold">{t('settings.businessCategory')}</h2>
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
          {t('settings.openSetup')}
        </Link>
      </div>

      <div className="space-y-4 rounded-xl border border-white/5 bg-bg-card p-5">
        <div>
          <h2 className="font-semibold">{t('settings.locations')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('settings.locationsHint')}</p>
        </div>
        <ul className="divide-y divide-white/5">
          {(outletsQuery.data ?? []).map((outlet) => {
            const own = outletDetailParts(outlet);
            const inherited = own.length === 0 ? outletDetailParts(orgQuery.data ?? {}) : [];
            const editing = editingOutletId === outlet.id;
            return (
              <li key={outlet.id} className="space-y-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{outlet.name}</p>
                    {own.length > 0 ? (
                      <p className="break-words text-xs text-text-muted">{own.join(' · ')}</p>
                    ) : inherited.length > 0 ? (
                      <p className="break-words text-xs text-text-muted">
                        {t('settings.usingRestaurantDetails', { details: inherited.join(' · ') })}
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="text-xs font-medium text-brand-primary hover:underline"
                        onClick={() => startEditOutlet(outlet)}
                      >
                        {t('settings.addOutletDetails')}
                      </button>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${outlet.isActive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                      {outlet.isActive ? t('settings.active') : t('settings.inactive')}
                    </span>
                    {!editing ? (
                      <Button type="button" variant="secondary" onClick={() => startEditOutlet(outlet)}>
                        {t('common.edit')}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {editing ? (
                  <div className="space-y-3 rounded-lg border border-white/5 bg-bg-elevated p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label={t('settings.locationName')}
                        value={outletEdit.name}
                        onChange={(e) => setOutletEdit((f) => ({ ...f, name: e.target.value }))}
                      />
                      <Input
                        label={t('common.city')}
                        value={outletEdit.city}
                        onChange={(e) => setOutletEdit((f) => ({ ...f, city: e.target.value }))}
                      />
                      <Input
                        label={t('common.address')}
                        value={outletEdit.address}
                        onChange={(e) => setOutletEdit((f) => ({ ...f, address: e.target.value }))}
                      />
                      <PhoneField
                        label={t('common.phone')}
                        value={outletEdit.phone}
                        onChange={(phone) => setOutletEdit((f) => ({ ...f, phone }))}
                      />
                      <Input
                        label={t('common.gstin')}
                        value={outletEdit.gstin}
                        onChange={(e) => setOutletEdit((f) => ({ ...f, gstin: e.target.value }))}
                      />
                    </div>
                    {updateOutletMutation.isError ? (
                      <p className="text-sm text-status-error">
                        {updateOutletMutation.error instanceof Error
                          ? updateOutletMutation.error.message
                          : 'Could not save outlet.'}
                      </p>
                    ) : null}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        disabled={outletEdit.name.trim().length < 2}
                        loading={updateOutletMutation.isPending}
                        onClick={() => updateOutletMutation.mutate(outlet.id)}
                      >
                        {t('settings.saveOutlet')}
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingOutletId(null)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div>
          <h3 className="mb-3 text-sm font-medium">{t('settings.addLocation')}</h3>
          {outletNotice && (
            <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${outletNotice.type === 'success' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
              {outletNotice.text}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={`${t('settings.locationName')} *`}
              placeholder="Bandra Outlet"
              value={outletForm.name}
              onChange={(e) => setOutletForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              label={t('common.city')}
              placeholder="Mumbai"
              value={outletForm.city}
              onChange={(e) => setOutletForm((f) => ({ ...f, city: e.target.value }))}
            />
            <PhoneField
              label={t('common.phone')}
              placeholder="+91 9900000000"
              value={outletForm.phone}
              onChange={(phone) => setOutletForm((f) => ({ ...f, phone }))}
            />
            <Input
              label={t('common.gstin')}
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
              {t('settings.addLocationButton')}
            </Button>
          </div>
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={!form.name.trim()}
        loading={saveMutation.isPending}
      >
        {t('settings.saveSettings')}
      </Button>
      </TabPanel>

      <TabPanel active={activeTab === 'tax'}>
        <TaxGroupsSettingsPanel />
      </TabPanel>
      <TabPanel active={activeTab === 'devices'}>
        <DevicesSettingsPanel />
      </TabPanel>
      <TabPanel active={activeTab === 'payments'}>
        <PaymentsSettingsPanel />
      </TabPanel>
    </PageShell>
  );
}
