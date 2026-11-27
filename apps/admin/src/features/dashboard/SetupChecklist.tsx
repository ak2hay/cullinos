import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PERMISSIONS, hasPermission } from '@cullinos/shared';
import { analyticsApi, menuApi, organizationsApi, taxApi, usersApi } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';

const STORAGE_PREFIX = 'cullinos.admin.checklist.v1';

interface ChecklistStore {
  dismissed: boolean;
  kotTested: boolean;
}

function storageKey(orgId: string) {
  return `${STORAGE_PREFIX}.${orgId}`;
}

function readStore(orgId: string): ChecklistStore {
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) return { dismissed: false, kotTested: false };
    const parsed = JSON.parse(raw) as Partial<ChecklistStore>;
    return {
      dismissed: parsed.dismissed === true,
      kotTested: parsed.kotTested === true,
    };
  } catch {
    return { dismissed: false, kotTested: false };
  }
}

function writeStore(orgId: string, next: ChecklistStore) {
  localStorage.setItem(storageKey(orgId), JSON.stringify(next));
}

export function SetupChecklist() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const permissions = useAuthStore((s) => s.permissions);
  const outletId = useAuthStore((s) => s.selectedOutletId);
  const orgQuery = useQuery({
    queryKey: ['organizations', 'current'],
    queryFn: organizationsApi.current,
  });
  const orgId = orgQuery.data?.id;
  const [store, setStore] = useState<ChecklistStore>({ dismissed: false, kotTested: false });
  const ensuredTax = useRef(false);

  useEffect(() => {
    if (!orgId) return;
    setStore(readStore(orgId));
  }, [orgId]);

  const canMenu = hasPermission(permissions, PERMISSIONS.MENU_READ);
  const canTax = hasPermission(permissions, PERMISSIONS.SETTINGS_UPDATE);
  const canStaff = hasPermission(permissions, PERMISSIONS.STAFF_READ);
  const canReports = hasPermission(permissions, PERMISSIONS.REPORTS_READ);

  const itemsQuery = useQuery({
    queryKey: ['menu', 'items'],
    queryFn: menuApi.listItems,
    enabled: canMenu,
  });
  const taxQuery = useQuery({
    queryKey: ['tax'],
    queryFn: taxApi.list,
    enabled: canTax || hasPermission(permissions, PERMISSIONS.SETTINGS_READ),
  });
  const staffQuery = useQuery({
    queryKey: ['staff', 'users'],
    queryFn: usersApi.list,
    enabled: canStaff,
  });
  const dailyQuery = useQuery({
    queryKey: ['analytics', 'daily', 'checklist', outletId],
    queryFn: () => analyticsApi.daily({ outletId: outletId ?? undefined }),
    enabled: canReports,
  });

  useEffect(() => {
    if (ensuredTax.current || !canTax || !taxQuery.isSuccess) return;
    if ((taxQuery.data?.length ?? 0) > 0) return;
    ensuredTax.current = true;
    void taxApi
      .ensurePresets()
      .then(() => queryClient.invalidateQueries({ queryKey: ['tax'] }))
      .catch(() => {
        ensuredTax.current = false;
      });
  }, [canTax, taxQuery.isSuccess, taxQuery.data, queryClient]);

  const steps = useMemo(() => {
    const menuDone = (itemsQuery.data?.length ?? 0) > 0;
    const taxDone =
      Boolean(orgQuery.data?.gstin) ||
      (taxQuery.data ?? []).some((group) => /5%|gst/i.test(group.name));
    const staffDone = (staffQuery.data?.length ?? 0) > 1;
    const orderDone = (dailyQuery.data?.summary.totalOrders ?? 0) > 0;
    const all = [
      canMenu
        ? {
            id: 'menu',
            done: menuDone,
            to: '/menu',
            title: t('checklist.menu'),
            hint: t('checklist.menuHint'),
            manual: false,
          }
        : null,
      canTax
        ? {
            id: 'tax',
            done: taxDone,
            to: '/settings?tab=tax',
            title: t('checklist.tax'),
            hint: t('checklist.taxHint'),
            manual: false,
          }
        : null,
      canStaff
        ? {
            id: 'staff',
            done: staffDone,
            to: '/staff',
            title: t('checklist.staff'),
            hint: t('checklist.staffHint'),
            manual: false,
          }
        : null,
      {
        id: 'kot',
        done: store.kotTested,
        to: '/displays',
        title: t('checklist.kot'),
        hint: t('checklist.kotHint'),
        manual: true,
      },
      {
        id: 'order',
        done: orderDone,
        to: '/orders',
        title: t('checklist.order'),
        hint: t('checklist.orderHint'),
        manual: false,
      },
    ];
    return all.filter((step): step is NonNullable<typeof step> => step !== null);
  }, [
    itemsQuery.data,
    orgQuery.data?.gstin,
    taxQuery.data,
    staffQuery.data,
    dailyQuery.data,
    store.kotTested,
    canMenu,
    canTax,
    canStaff,
    t,
  ]);

  if (!orgId) return null;
  if (!canMenu && !canTax && !canStaff) return null;

  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;

  function update(next: ChecklistStore) {
    setStore(next);
    writeStore(orgId!, next);
  }

  if (allDone) return null;

  if (store.dismissed) {
    return (
      <button
        type="button"
        onClick={() => update({ ...store, dismissed: false })}
        className="min-h-11 rounded-xl border border-line-subtle bg-bg-card px-4 text-sm font-medium text-brand-primary"
      >
        {t('checklist.resume')} · {t('checklist.progress', { done: doneCount, total: steps.length })}
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-brand-primary/30 bg-brand-primary/5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-text-primary">{t('checklist.title')}</h2>
          <p className="mt-1 text-sm text-text-secondary">{t('checklist.hint')}</p>
          <p className="mt-1 text-xs font-medium text-brand-primary">
            {t('checklist.progress', { done: doneCount, total: steps.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => update({ ...store, dismissed: true })}
          className="min-h-11 rounded-lg px-3 text-sm font-medium text-text-secondary hover:bg-hover"
        >
          {t('checklist.skip')}
        </button>
      </div>
      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-subtle bg-bg-card px-3 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-text-primary">
                <span className="mr-2 text-text-muted">{index + 1}.</span>
                {step.done ? <span className="text-status-success">✓ </span> : null}
                {step.title}
              </p>
              <p className="mt-0.5 text-sm text-text-secondary">{step.hint}</p>
            </div>
            <div className="flex gap-2">
              {step.manual && !step.done ? (
                <button
                  type="button"
                  onClick={() => update({ ...store, kotTested: true })}
                  className="min-h-11 rounded-lg border border-line px-3 text-sm font-medium"
                >
                  {t('checklist.markDone')}
                </button>
              ) : null}
              <Link
                to={step.to}
                className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-4 text-sm font-semibold text-on-brand"
              >
                {t('checklist.open')}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
