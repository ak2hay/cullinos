import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input, PageHeader, useToast } from '@cullinos/ui';
import { ImageUploadField } from '@/components/ImageUploadField';
import { couponsApi, type CouponRow } from '@/lib/api';

type FormState = {
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
};

const EMPTY: FormState = {
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
};

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromForm(form: FormState) {
  return {
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
  };
}

export function CouponsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: couponsApi.list,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = fromForm(form);
      if (!payload.code) throw new Error('Code is required');
      if (!payload.value) throw new Error('Value is required');
      if (editingId) return couponsApi.update(editingId, payload);
      return couponsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      setForm(EMPTY);
      setEditingId(null);
      toast.success(editingId ? 'Coupon updated.' : 'Coupon created.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => couponsApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast.success('Coupon deactivated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => couponsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      if (editingId) {
        setEditingId(null);
        setForm(EMPTY);
      }
      toast.success('Coupon deleted.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function startEdit(c: CouponRow) {
    setEditingId(c.id);
    setForm({
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
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons & offers"
        description="Create discount codes for the Cullinos App and POS. Active windows and minimum order apply at checkout."
      />

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="text-lg font-medium">{editingId ? 'Edit coupon' : 'New coupon'}</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="WELCOME10"
            required
          />
          <Input
            label="Title (Cullinos App card)"
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
            <ImageUploadField
              slot="coupon"
              value={form.imageUrl}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              onUpload={async (file) => {
                const res = await couponsApi.uploadImage(file);
                return res.imageUrl;
              }}
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
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="submit" disabled={saveMutation.isPending}>
              {editingId ? 'Save changes' : 'Create coupon'}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="text-lg font-medium">All coupons</h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : coupons.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No coupons yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5">
            {coupons.map((c) => (
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
                  </p>
                  <p className="text-sm text-text-secondary">
                    {c.title || 'Untitled'}
                    {c.expiresAt
                      ? ` · expires ${new Date(c.expiresAt).toLocaleDateString()}`
                      : ''}
                    {c.usedCount != null ? ` · used ${c.usedCount}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
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
                          `Delete ${c.code}? Used coupons cannot be deleted — deactivate instead.`,
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
