import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, Input } from '@cullinos/ui';
import {
  superAdminApi,
  type GuestCouponOversightRow,
} from '@/lib/api';

type FormState = {
  organizationId: string;
  code: string;
  title: string;
  description: string;
  imageUrl: string;
  type: 'percent' | 'fixed';
  value: string;
  minOrder: string;
  maxUses: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  marketplaceFeatured: boolean;
};

const EMPTY: FormState = {
  organizationId: '',
  code: '',
  title: '',
  description: '',
  imageUrl: '',
  type: 'percent',
  value: '10',
  minOrder: '',
  maxUses: '',
  startsAt: '',
  expiresAt: '',
  isActive: true,
  marketplaceFeatured: false,
};

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fromForm(form: FormState) {
  return {
    organizationId: form.organizationId,
    code: form.code.trim().toUpperCase(),
    title: form.title.trim() || undefined,
    description: form.description.trim() || undefined,
    imageUrl: form.imageUrl.trim() || undefined,
    type: form.type,
    value: Number(form.value) || 0,
    minOrder: form.minOrder ? Number(form.minOrder) : undefined,
    maxUses: form.maxUses ? Number(form.maxUses) : undefined,
    startsAt: form.startsAt || undefined,
    expiresAt: form.expiresAt || undefined,
    isActive: form.isActive,
    marketplaceFeatured: form.marketplaceFeatured,
  };
}

export function GuestOpsOffersPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState('');

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['super-admin', 'guest-coupons'],
    queryFn: superAdminApi.listGuestCoupons,
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['super-admin', 'organizations', 'coupon-picker'],
    queryFn: () => superAdminApi.listOrganizations(1, 200),
  });

  const tenants = tenantsData?.data ?? [];

  const filteredCoupons = useMemo(() => {
    if (!orgFilter) return coupons;
    return coupons.filter((c) => c.organizationId === orgFilter);
  }, [coupons, orgFilter]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = fromForm(form);
      if (!payload.organizationId && !editingId) {
        throw new Error('Select a tenant');
      }
      if (!payload.code) throw new Error('Code is required');
      if (!payload.value) throw new Error('Value is required');
      if (editingId) {
        const { organizationId: _org, ...rest } = payload;
        void _org;
        return superAdminApi.updateGuestCoupon(editingId, rest);
      }
      return superAdminApi.createGuestCoupon(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'guest-coupons'] });
      setForm((f) => ({ ...EMPTY, organizationId: f.organizationId }));
      setEditingId(null);
      setMessage(editingId ? 'Offer updated.' : 'Offer created.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deactivateGuestCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'guest-coupons'] });
      setMessage('Offer deactivated.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deleteGuestCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'guest-coupons'] });
      if (editingId) {
        setEditingId(null);
        setForm((f) => ({ ...EMPTY, organizationId: f.organizationId }));
      }
      setMessage('Offer deleted.');
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setMessage(null);
    },
  });

  function startEdit(c: GuestCouponOversightRow) {
    setEditingId(c.id);
    setForm({
      organizationId: c.organizationId,
      code: c.code,
      title: c.title ?? '',
      description: c.description ?? '',
      imageUrl: c.imageUrl ?? '',
      type: c.type === 'fixed' ? 'fixed' : 'percent',
      value: String(c.value ?? ''),
      minOrder: c.minOrder != null ? String(c.minOrder) : '',
      maxUses: c.maxUses != null ? String(c.maxUses) : '',
      startsAt: toDatetimeLocal(c.startsAt),
      expiresAt: toDatetimeLocal(c.expiresAt),
      isActive: c.isActive,
      marketplaceFeatured: Boolean(c.marketplaceFeatured),
    });
    setMessage(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Offers & coupons</h1>
        <p className="mt-1 max-w-2xl text-text-secondary">
          Create, edit, or remove offer codes across tenants. Mark offers as marketplace featured
          for discover placement.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="text-lg font-medium">{editingId ? 'Edit offer' : 'New offer'}</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-text-secondary">Tenant</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={form.organizationId}
              disabled={!!editingId}
              onChange={(e) => setForm((f) => ({ ...f, organizationId: e.target.value }))}
              required={!editingId}
            >
              <option value="">Select tenant…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="WELCOME10"
            required
          />
          <Input
            label="Title (app card)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Welcome offer"
          />
          <label className="block text-sm">
            <span className="mb-1 block text-text-secondary">Type</span>
            <select
              className="w-full rounded-lg border border-white/10 bg-bg-primary px-3 py-2"
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  type: e.target.value === 'fixed' ? 'fixed' : 'percent',
                }))
              }
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </label>
          <Input
            label={form.type === 'percent' ? 'Percent' : 'Amount'}
            type="number"
            min="0"
            value={form.value}
            onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            required
          />
          <Input
            label="Min order"
            type="number"
            min="0"
            value={form.minOrder}
            onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))}
          />
          <Input
            label="Max uses"
            type="number"
            min="0"
            value={form.maxUses}
            onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
          />
          <Input
            label="Starts at"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
          />
          <Input
            label="Expires at"
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Image URL"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={form.marketplaceFeatured}
              onChange={(e) =>
                setForm((f) => ({ ...f, marketplaceFeatured: e.target.checked }))
              }
            />
            Marketplace featured
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {editingId ? 'Save changes' : 'Create offer'}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm((f) => ({ ...EMPTY, organizationId: f.organizationId }));
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">All offers</h2>
          <label className="block text-sm">
            <span className="sr-only">Filter by tenant</span>
            <select
              className="rounded-lg border border-white/10 bg-bg-primary px-3 py-2 text-sm"
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
            >
              <option value="">All tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : filteredCoupons.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No offers found.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {filteredCoupons.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {c.code}{' '}
                    <span className="text-text-muted">
                      · {c.type === 'percent' ? `${c.value}%` : `₹${c.value}`}
                    </span>
                    {!c.isActive ? (
                      <span className="ml-2 text-xs text-status-warning">Inactive</span>
                    ) : null}
                    {c.marketplaceFeatured ? (
                      <span className="ml-2 text-xs text-brand-primary">Featured</span>
                    ) : null}
                  </p>
                  <p className="text-sm text-text-secondary">
                    {c.organization?.name ?? c.organizationId}
                    {c.title ? ` · ${c.title}` : ''}
                    {c.usedCount != null ? ` · used ${c.usedCount}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={() => startEdit(c)}>
                    Edit
                  </Button>
                  {c.isActive ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (window.confirm(`Deactivate ${c.code}?`)) {
                          deactivateMutation.mutate(c.id);
                        }
                      }}
                    >
                      Deactivate
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${c.code}? Used offers cannot be deleted — deactivate instead.`,
                        )
                      ) {
                        deleteMutation.mutate(c.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
