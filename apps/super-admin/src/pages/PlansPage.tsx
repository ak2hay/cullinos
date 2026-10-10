import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Check, Lock, Pencil, Plus, Power, RefreshCcw, Store, Users } from 'lucide-react';
import { PLAN_MODULES } from '@cullinos/shared';
import { Button } from '@cullinos/ui';
import { inputClass, LabeledInput, Notice } from '@/components/common';
import { ActionMenu, Card, ConfirmDialog, EmptyState, FilterTabs, FormDrawer, PageHeader, StatusPill } from '@/components/ui';
import { superAdminApi, type PlanSummary } from '@/lib/api';
import { formatInr } from '@/lib/format';
import { useCan } from '@/lib/permissions';

function planModules(plan: PlanSummary): string[] {
  if (plan.modules?.length) return plan.modules;
  return (plan.features ?? []).filter((f) => f.enabled).map((f) => f.module);
}

type PlanVisibility = 'public' | 'private';
type VisibilityFilter = 'all' | PlanVisibility;

type PlanDraft = {
  name: string;
  slug: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  maxOutlets: string;
  maxTerminals: string;
  maxUsers: string;
  visibility: PlanVisibility;
  isActive: boolean;
  modules: string[];
};

const emptyDraft: PlanDraft = {
  name: '',
  slug: '',
  description: '',
  priceMonthly: '0',
  priceYearly: '0',
  maxOutlets: '1',
  maxTerminals: '2',
  maxUsers: '5',
  visibility: 'private',
  isActive: true,
  modules: [],
};

function draftFromPlan(plan: PlanSummary): PlanDraft {
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description ?? '',
    priceMonthly: String(plan.priceMonthly ?? 0),
    priceYearly: String(plan.priceYearly ?? 0),
    maxOutlets: String(plan.maxOutlets ?? 1),
    maxTerminals: String(plan.maxTerminals ?? 2),
    maxUsers: String(plan.maxUsers ?? 5),
    visibility: plan.visibility === 'private' ? 'private' : 'public',
    isActive: plan.isActive !== false,
    modules: planModules(plan),
  };
}

function ModuleChecklist({ selected, onChange, catalog }: { selected: string[]; onChange: (next: string[]) => void; catalog: string[] }) {
  function toggle(mod: string) {
    onChange(selected.includes(mod) ? selected.filter((m) => m !== mod) : [...selected, mod]);
  }
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {catalog.map((mod) => {
        const on = selected.includes(mod);
        return (
          <label
            key={mod}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
              on ? 'border-accent/40 bg-accent/8 text-text-primary' : 'border-line text-text-secondary hover:bg-hover'
            }`}
          >
            <input type="checkbox" className="accent-accent" checked={on} onChange={() => toggle(mod)} />
            <span className="truncate">{mod.replace(/_/g, ' ')}</span>
          </label>
        );
      })}
    </div>
  );
}

export function PlansPage() {
  const queryClient = useQueryClient();
  const canManage = useCan()('plans.manage');
  const [filter, setFilter] = useState<VisibilityFilter>('all');
  const [editing, setEditing] = useState<PlanSummary | 'new' | null>(null);
  const [draft, setDraft] = useState<PlanDraft>(emptyDraft);
  const [deactivating, setDeactivating] = useState<PlanSummary | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const { data: plans = [], isLoading, error } = useQuery({ queryKey: ['super-admin', 'plans'], queryFn: () => superAdminApi.listPlans() });

  const counts = useMemo(
    () => ({
      all: plans.length,
      public: plans.filter((p) => (p.visibility ?? 'public') === 'public').length,
      private: plans.filter((p) => p.visibility === 'private').length,
    }),
    [plans],
  );
  const filteredPlans = filter === 'all' ? plans : plans.filter((p) => (p.visibility ?? 'public') === filter);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] });

  const syncMutation = useMutation({
    mutationFn: () => superAdminApi.syncPlansToRazorpay(),
    onSuccess: (synced) => {
      setPageError(null);
      setSyncMessage(
        synced.length > 0
          ? `Synced ${synced.length} plan${synced.length === 1 ? '' : 's'} to Razorpay: ${synced.join(', ')}`
          : 'No active plans to sync (or Razorpay keys are not configured).',
      );
      invalidate();
    },
    onError: (err: Error) => {
      setSyncMessage(null);
      setPageError(err.message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const common = {
        name: draft.name,
        priceMonthly: Number(draft.priceMonthly) || 0,
        priceYearly: Number(draft.priceYearly) || 0,
        maxOutlets: Number(draft.maxOutlets) || 1,
        maxTerminals: Number(draft.maxTerminals) || 2,
        maxUsers: Number(draft.maxUsers) || 5,
        visibility: draft.visibility,
      };
      if (editing === 'new') {
        return superAdminApi.createPlan({ ...common, slug: draft.slug, description: draft.description || undefined, modules: draft.modules });
      }
      if (!editing) return null;
      await superAdminApi.updatePlan(editing.id, { ...common, description: draft.description || null, isActive: draft.isActive });
      return superAdminApi.updatePlanModules(editing.id, draft.modules);
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deactivatePlan(id),
    onSuccess: () => {
      setDeactivating(null);
      invalidate();
    },
  });

  const moduleCatalog = useMemo(() => {
    const set = new Set<string>(PLAN_MODULES);
    for (const plan of plans) {
      for (const m of planModules(plan)) set.add(m);
      for (const f of plan.features ?? []) set.add(f.module);
    }
    return [...set].sort();
  }, [plans]);

  function openEditor(target: PlanSummary | 'new') {
    setEditing(target);
    setDraft(target === 'new' ? emptyDraft : draftFromPlan(target));
    saveMutation.reset();
  }

  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const numberField = (key: 'priceMonthly' | 'priceYearly' | 'maxOutlets' | 'maxTerminals' | 'maxUsers', label: string) => (
    <LabeledInput label={label}>
      <input type="number" min={0} value={draft[key]} onChange={(e) => set(key, e.target.value)} className={inputClass} />
    </LabeledInput>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Public plans appear on admin billing and marketing. Private plans are custom quotes, assignable to restaurants but never shown publicly."
        actions={
          canManage ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="gap-2"
                loading={syncMutation.isPending}
                onClick={() => {
                  setSyncMessage(null);
                  setPageError(null);
                  syncMutation.mutate();
                }}
              >
                <RefreshCcw size={15} aria-hidden="true" />
                Sync to Razorpay
              </Button>
              <Button size="sm" className="gap-2" onClick={() => openEditor('new')}>
                <Plus size={16} aria-hidden="true" />
                Create plan
              </Button>
            </>
          ) : null
        }
      />

      <FilterTabs<VisibilityFilter>
        label="Plan visibility"
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: 'all', label: 'All plans', count: counts.all },
          { id: 'public', label: 'Public', count: counts.public },
          { id: 'private', label: 'Private', count: counts.private },
        ]}
      />

      {error ? <Notice tone="error">{error instanceof Error ? error.message : 'Failed to load plans'}</Notice> : null}
      {syncMessage ? <Notice tone="success">{syncMessage}</Notice> : null}
      {pageError ? <Notice tone="error">{pageError}</Notice> : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ui-skeleton h-72 rounded-xl" />
          ))}
        </div>
      ) : filteredPlans.length === 0 ? (
        <Card>
          <EmptyState title="No plans in this filter" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPlans.map((plan) => {
            const modules = planModules(plan);
            const isPrivate = plan.visibility === 'private';
            const inactive = plan.isActive === false;
            return (
              <Card key={plan.id} className={`flex flex-col p-5 ${inactive ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight">{plan.name}</h2>
                      {isPrivate ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-bg-elevated px-1.5 py-0.5 text-xs text-text-secondary">
                          <Lock size={11} aria-hidden="true" />
                          Private
                        </span>
                      ) : null}
                      {inactive ? <StatusPill status="inactive" /> : null}
                    </div>
                    <p className="font-mono text-xs text-text-muted">{plan.slug}</p>
                  </div>
                  {canManage ? (
                    <ActionMenu
                      actions={[
                        { label: 'Edit plan', icon: Pencil, onSelect: () => openEditor(plan) },
                        { label: 'Deactivate', icon: Power, danger: true, hidden: inactive, onSelect: () => setDeactivating(plan) },
                      ]}
                    />
                  ) : null}
                </div>

                <p className="mt-4">
                  <span className="font-display text-3xl font-bold tracking-tight">{formatInr(plan.priceMonthly)}</span>
                  <span className="text-sm text-text-muted"> / month</span>
                </p>
                {plan.priceYearly ? <p className="text-xs text-text-muted">{formatInr(plan.priceYearly)} billed yearly</p> : null}
                {plan.description ? <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{plan.description}</p> : null}

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-bg-elevated/60 p-3 text-center text-xs">
                  <div>
                    <Store size={14} className="mx-auto text-text-muted" aria-hidden="true" />
                    <p className="mt-1 font-semibold text-text-primary">{plan.maxOutlets ?? 1}</p>
                    <p className="text-text-muted">outlets</p>
                  </div>
                  <div>
                    <Users size={14} className="mx-auto text-text-muted" aria-hidden="true" />
                    <p className="mt-1 font-semibold text-text-primary">{plan.maxUsers ?? 5}</p>
                    <p className="text-text-muted">users</p>
                  </div>
                  <div>
                    <Check size={14} className="mx-auto text-text-muted" aria-hidden="true" />
                    <p className="mt-1 font-semibold text-text-primary">{plan.subscriptionCount ?? 0}</p>
                    <p className="text-text-muted">subscribers</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {modules.slice(0, 10).map((m) => (
                    <span key={m} className="rounded-md bg-accent/8 px-2 py-0.5 text-xs text-accent">
                      {m.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {modules.length > 10 ? <span className="px-1 text-xs text-text-muted">+{modules.length - 10} more</span> : null}
                  {modules.length === 0 ? <span className="text-sm text-text-muted">No modules enabled</span> : null}
                </div>

                {canManage ? (
                  <div className="mt-auto pt-5">
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => openEditor(plan)}>
                      Edit plan
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <FormDrawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Create plan' : `Edit ${editing?.name ?? 'plan'}`}
        description={editing === 'new' ? 'Defaults to private so custom quotes stay off the public catalog.' : undefined}
        submitLabel={editing === 'new' ? 'Create plan' : 'Save changes'}
        width="xl"
        loading={saveMutation.isPending}
        error={saveMutation.error}
        submitDisabled={!draft.name.trim() || (editing === 'new' && !draft.slug.trim())}
        onSubmit={() => saveMutation.mutate()}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledInput label="Name">
            <input required value={draft.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
          </LabeledInput>
          <LabeledInput label="Slug" hint={editing === 'new' ? 'Lowercase, used in URLs and APIs.' : 'Slug cannot be changed.'}>
            <input
              required
              value={draft.slug}
              disabled={editing !== 'new'}
              onChange={(e) => set('slug', e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </LabeledInput>
          <div className="sm:col-span-2">
            <LabeledInput label="Description">
              <input value={draft.description} onChange={(e) => set('description', e.target.value)} className={inputClass} />
            </LabeledInput>
          </div>
          {numberField('priceMonthly', 'Price monthly (₹)')}
          {numberField('priceYearly', 'Price yearly (₹)')}
          {numberField('maxOutlets', 'Max outlets')}
          {numberField('maxTerminals', 'Max terminals')}
          {numberField('maxUsers', 'Max users')}
          <LabeledInput label="Visibility">
            <select value={draft.visibility} onChange={(e) => set('visibility', e.target.value === 'private' ? 'private' : 'public')} className={inputClass}>
              <option value="public">Public (catalog)</option>
              <option value="private">Private (custom quote)</option>
            </select>
          </LabeledInput>
          {editing !== 'new' ? (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="accent-accent" checked={draft.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              Active
            </label>
          ) : null}
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-text-secondary">
            Modules <span className="font-normal text-text-muted">({draft.modules.length} selected)</span>
          </p>
          <ModuleChecklist selected={draft.modules} catalog={moduleCatalog} onChange={(modules) => set('modules', modules)} />
        </div>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(deactivating)}
        onClose={() => {
          setDeactivating(null);
          deactivateMutation.reset();
        }}
        title={`Deactivate ${deactivating?.name ?? 'plan'}?`}
        description="Existing subscribers keep the plan; it can no longer be assigned."
        confirmLabel="Deactivate"
        tone="danger"
        loading={deactivateMutation.isPending}
        error={deactivateMutation.error}
        onConfirm={() => deactivating && deactivateMutation.mutate(deactivating.id)}
      />
    </div>
  );
}
