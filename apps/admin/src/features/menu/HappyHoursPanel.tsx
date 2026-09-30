import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input, Select, useToast } from '@cullinos/ui';
import {
  happyHoursApi,
  outletsApi,
  type HappyHourPayload,
  type HappyHourRule,
  type MenuCategory,
} from '@/lib/api';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type FormState = {
  name: string;
  outletId: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  discountType: 'percent' | 'amount';
  discountValue: string;
  categoryIds: string[];
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: 'Happy hour',
  outletId: '',
  daysOfWeek: [1, 2, 3, 4, 5],
  startTime: '17:00',
  endTime: '19:00',
  discountType: 'percent',
  discountValue: '50',
  categoryIds: [],
  isActive: true,
};

function describeDiscount(rule: Pick<HappyHourRule, 'discountType' | 'discountValue'>) {
  return rule.discountType === 'percent'
    ? `${rule.discountValue}% off`
    : `₹${rule.discountValue} off each`;
}

export function HappyHoursPanel({ categories }: { categories: MenuCategory[] }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<HappyHourRule | null>(null);

  const rulesQuery = useQuery({ queryKey: ['happy-hours'], queryFn: happyHoursApi.list });
  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const rules = rulesQuery.data ?? [];
  const outlets = outletsQuery.data ?? [];
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  function reset() {
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  const save = useMutation({
    mutationFn: () => {
      const payload: HappyHourPayload = {
        name: form.name.trim(),
        outletId: form.outletId || null,
        daysOfWeek: form.daysOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        categoryIds: form.categoryIds,
        menuItemIds: editing?.menuItemIds ?? [],
        isActive: form.isActive,
      };
      return editing ? happyHoursApi.update(editing.id, payload) : happyHoursApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['happy-hours'] });
      toast.success(editing ? 'Happy hour updated.' : 'Happy hour created.');
      reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: happyHoursApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['happy-hours'] });
      toast.success('Happy hour deleted.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: (rule: HappyHourRule) => happyHoursApi.update(rule.id, { isActive: !rule.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['happy-hours'] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const overnight = form.endTime <= form.startTime;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-line-subtle bg-bg-card p-5">
        <h2 className="font-semibold">{editing ? 'Edit happy hour' : 'New happy hour'}</h2>
        <p className="mt-1 text-sm text-text-muted">
          Discounted prices apply automatically on POS, waiter and guest orders during the window,
          using your business timezone.
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (form.daysOfWeek.length === 0) {
              toast.error('Pick at least one day.');
              return;
            }
            save.mutate();
          }}
        >
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            label="Outlet"
            value={form.outletId}
            onChange={(e) => setForm((f) => ({ ...f, outletId: e.target.value }))}
            options={[
              { value: '', label: 'All outlets' },
              ...outlets.map((o) => ({ value: o.id, label: o.name })),
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Start time"
              type="time"
              required
              value={form.startTime}
              onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
            <Input
              label="End time"
              type="time"
              required
              value={form.endTime}
              onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </div>
          {overnight && form.endTime !== form.startTime ? (
            <p className="text-xs text-text-muted">
              Ends after midnight — the window belongs to the day it starts on.
            </p>
          ) : null}
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Days</p>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, day) => (
                <label
                  key={day}
                  className="flex items-center gap-1 rounded border border-line px-2 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.daysOfWeek.includes(day)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        daysOfWeek: e.target.checked
                          ? [...f.daysOfWeek, day].sort()
                          : f.daysOfWeek.filter((d) => d !== day),
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Discount type"
              value={form.discountType}
              onChange={(e) =>
                setForm((f) => ({ ...f, discountType: e.target.value as FormState['discountType'] }))
              }
              options={[
                { value: 'percent', label: 'Percent off' },
                { value: 'amount', label: 'Rupees off each item' },
              ]}
            />
            <Input
              label={form.discountType === 'percent' ? 'Percent off' : 'Rupees off'}
              type="number"
              min={0.01}
              max={form.discountType === 'percent' ? 100 : undefined}
              step="0.01"
              required
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">
              Categories (leave empty for the whole menu)
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.categoryIds.includes(c.id)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        categoryIds: e.target.checked
                          ? [...f.categoryIds, c.id]
                          : f.categoryIds.filter((id) => id !== c.id),
                      }))
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex gap-2">
            <Button type="submit" loading={save.isPending}>
              {editing ? 'Save happy hour' : 'Create happy hour'}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" onClick={reset}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-line-subtle bg-bg-card p-5">
        <h2 className="font-semibold">Happy hours</h2>
        {rulesQuery.isLoading ? (
          <p className="mt-4 text-sm text-text-muted">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">No happy hours yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line-subtle">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {rule.name}
                    {rule.isActive ? '' : ' (paused)'}
                  </p>
                  <p className="text-sm text-text-muted">
                    {rule.startTime} – {rule.endTime} · {describeDiscount(rule)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {rule.daysOfWeek.map((d) => DAY_LABELS[d]).join(', ')} ·{' '}
                    {rule.outletId
                      ? (outlets.find((o) => o.id === rule.outletId)?.name ?? 'One outlet')
                      : 'All outlets'}{' '}
                    ·{' '}
                    {rule.categoryIds.length === 0 && rule.menuItemIds.length === 0
                      ? 'Whole menu'
                      : rule.categoryIds.map((id) => categoryName.get(id) ?? 'Removed category').join(', ')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    loading={toggle.isPending && toggle.variables?.id === rule.id}
                    onClick={() => toggle.mutate(rule)}
                  >
                    {rule.isActive ? 'Pause' : 'Resume'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditing(rule);
                      setForm({
                        name: rule.name,
                        outletId: rule.outletId ?? '',
                        daysOfWeek: rule.daysOfWeek,
                        startTime: rule.startTime,
                        endTime: rule.endTime,
                        discountType: rule.discountType,
                        discountValue: String(rule.discountValue),
                        categoryIds: rule.categoryIds,
                        isActive: rule.isActive,
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (window.confirm(`Delete happy hour "${rule.name}"?`)) remove.mutate(rule.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
