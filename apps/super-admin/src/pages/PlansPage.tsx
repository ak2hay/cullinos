import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PLAN_MODULES } from '@cullinos/shared';
import { superAdminApi, type PlanSummary } from '@/lib/api';
import { useCan } from '@/lib/permissions';

function planModules(plan: PlanSummary): string[] {
  if (plan.modules?.length) return plan.modules;
  return (plan.features ?? []).filter((f) => f.enabled).map((f) => f.module);
}

type PlanVisibility = 'public' | 'private';
type VisibilityFilter = 'all' | PlanVisibility;

type PlanDraft = {
  name: string;
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

function draftFromPlan(plan: PlanSummary): PlanDraft {
  return {
    name: plan.name,
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

const emptyCreate: PlanDraft & { slug: string } = {
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

function ModuleChecklist({
  selected,
  onChange,
  catalog,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  catalog: string[];
}) {
  function toggle(mod: string) {
    if (selected.includes(mod)) {
      onChange(selected.filter((m) => m !== mod));
    } else {
      onChange([...selected, mod]);
    }
  }

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {catalog.map((mod) => (
        <label
          key={mod}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-bg-elevated px-2 py-1.5 text-xs"
        >
          <input type="checkbox" checked={selected.includes(mod)} onChange={() => toggle(mod)} />
          <span className="font-mono">{mod}</span>
        </label>
      ))}
    </div>
  );
}

export function PlansPage() {
  const queryClient = useQueryClient();
  const canManage = useCan()('plans.manage');
  const [filter, setFilter] = useState<VisibilityFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyCreate);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const { data: plans = [], isLoading, error } = useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: () => superAdminApi.listPlans(),
  });

  const filteredPlans = useMemo(() => {
    if (filter === 'all') return plans;
    return plans.filter((p) => (p.visibility ?? 'public') === filter);
  }, [plans, filter]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] });

  const syncMutation = useMutation({
    mutationFn: () => superAdminApi.syncPlansToRazorpay(),
    onSuccess: (synced) => {
      setSaveError(null);
      setSyncMessage(
        synced.length > 0
          ? `Synced ${synced.length} plan${synced.length === 1 ? '' : 's'} to Razorpay: ${synced.join(', ')}`
          : 'No active plans to sync (or Razorpay keys are not configured).',
      );
      invalidate();
    },
    onError: (err: Error) => {
      setSyncMessage(null);
      setSaveError(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: PlanDraft }) => {
      await superAdminApi.updatePlan(id, {
        name: next.name,
        description: next.description || null,
        priceMonthly: Number(next.priceMonthly) || 0,
        priceYearly: Number(next.priceYearly) || 0,
        maxOutlets: Number(next.maxOutlets) || 1,
        maxTerminals: Number(next.maxTerminals) || 2,
        maxUsers: Number(next.maxUsers) || 5,
        visibility: next.visibility,
        isActive: next.isActive,
      });
      return superAdminApi.updatePlanModules(id, next.modules);
    },
    onSuccess: () => {
      setEditingId(null);
      setDraft(null);
      setSaveError(null);
      invalidate();
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      superAdminApi.createPlan({
        name: createDraft.name,
        slug: createDraft.slug,
        description: createDraft.description || undefined,
        priceMonthly: Number(createDraft.priceMonthly) || 0,
        priceYearly: Number(createDraft.priceYearly) || 0,
        maxOutlets: Number(createDraft.maxOutlets) || 1,
        maxTerminals: Number(createDraft.maxTerminals) || 2,
        maxUsers: Number(createDraft.maxUsers) || 5,
        visibility: createDraft.visibility,
        modules: createDraft.modules,
      }),
    onSuccess: () => {
      setShowCreate(false);
      setCreateDraft(emptyCreate);
      setSaveError(null);
      invalidate();
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => superAdminApi.deactivatePlan(id),
    onSuccess: invalidate,
    onError: (err: Error) => setSaveError(err.message),
  });

  const moduleCatalog = useMemo(() => {
    const set = new Set<string>(PLAN_MODULES);
    for (const plan of plans) {
      for (const m of planModules(plan)) set.add(m);
      for (const f of plan.features ?? []) set.add(f.module);
    }
    return [...set].sort();
  }, [plans]);

  function startEdit(plan: PlanSummary) {
    setEditingId(plan.id);
    setDraft(draftFromPlan(plan));
    setSaveError(null);
  }

  const filterTabs: { id: VisibilityFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'public', label: 'Public' },
    { id: 'private', label: 'Private' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Plans</h1>
          <p className="mt-1 text-text-secondary">
            Public plans appear on admin billing and marketing. Private plans are custom quotes —
            assignable to restaurants, never shown publicly.
          </p>
        </div>
        {canManage ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={syncMutation.isPending}
            onClick={() => {
              setSyncMessage(null);
              setSaveError(null);
              syncMutation.mutate();
            }}
            className="rounded-lg border border-white/10 bg-bg-elevated px-4 py-2 text-sm font-medium text-text-primary disabled:opacity-50"
          >
            {syncMutation.isPending ? 'Syncing…' : 'Sync to Razorpay'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setCreateDraft(emptyCreate);
              setSaveError(null);
              setSyncMessage(null);
            }}
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary"
          >
            Create plan
          </button>
        </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter === tab.id
                ? 'bg-brand-primary text-bg-primary'
                : 'border border-white/10 text-text-secondary hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load plans'}
        </div>
      ) : null}

      {syncMessage ? (
        <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-4 py-3 text-sm text-status-success">
          {syncMessage}
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {saveError}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading plans…</p>
      ) : filteredPlans.length === 0 ? (
        <p className="text-sm text-text-muted">No plans in this filter.</p>
      ) : (
        <div className="space-y-4">
          {filteredPlans.map((plan) => {
            const modules = planModules(plan);
            const isEditing = editingId === plan.id;
            const isPrivate = (plan.visibility ?? 'public') === 'private';
            return (
              <div key={plan.id} className="rounded-xl border border-white/5 bg-bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium">
                      {plan.name}
                      {isPrivate ? (
                        <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-xs font-normal text-text-secondary">
                          private
                        </span>
                      ) : null}
                      {plan.isActive === false ? (
                        <span className="ml-2 text-xs text-status-warning">(inactive)</span>
                      ) : null}
                    </h2>
                    <p className="text-sm text-text-muted">
                      {plan.slug} · ₹{plan.priceMonthly}/mo · max {plan.maxOutlets ?? 1} outlets ·{' '}
                      {plan.maxUsers ?? 5} users · {plan.subscriptionCount ?? 0} subs
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canManage && !isEditing ? (
                      <button
                        type="button"
                        onClick={() => startEdit(plan)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
                      >
                        Edit
                      </button>
                    ) : null}
                    {canManage && plan.isActive !== false ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Deactivate plan ${plan.name}?`)) {
                            deactivateMutation.mutate(plan.id);
                          }
                        }}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-status-warning hover:bg-white/5"
                      >
                        Deactivate
                      </button>
                    ) : null}
                  </div>
                </div>

                {isEditing && draft ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="text-text-muted">Name</span>
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-text-muted">Description</span>
                      <input
                        value={draft.description}
                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-text-muted">Price monthly</span>
                      <input
                        type="number"
                        value={draft.priceMonthly}
                        onChange={(e) => setDraft({ ...draft, priceMonthly: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-text-muted">Price yearly</span>
                      <input
                        type="number"
                        value={draft.priceYearly}
                        onChange={(e) => setDraft({ ...draft, priceYearly: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-text-muted">Max outlets</span>
                      <input
                        type="number"
                        value={draft.maxOutlets}
                        onChange={(e) => setDraft({ ...draft, maxOutlets: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-text-muted">Max terminals</span>
                      <input
                        type="number"
                        value={draft.maxTerminals}
                        onChange={(e) => setDraft({ ...draft, maxTerminals: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-text-muted">Max users</span>
                      <input
                        type="number"
                        value={draft.maxUsers}
                        onChange={(e) => setDraft({ ...draft, maxUsers: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-text-muted">Visibility</span>
                      <select
                        value={draft.visibility}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            visibility: e.target.value === 'private' ? 'private' : 'public',
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 outline-none focus:border-brand-accent"
                      >
                        <option value="public">Public (catalog)</option>
                        <option value="private">Private (custom quote)</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                      />
                      Active
                    </label>
                    <div className="sm:col-span-2">
                      <span className="text-sm text-text-muted">Modules</span>
                      <ModuleChecklist
                        selected={draft.modules}
                        catalog={moduleCatalog}
                        onChange={(modules) => setDraft({ ...draft, modules })}
                      />
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setDraft(null);
                        }}
                        className="rounded-lg px-4 py-2 text-sm hover:bg-white/5"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: plan.id, next: draft })}
                        className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary disabled:opacity-60"
                      >
                        {updateMutation.isPending ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {modules.map((m) => (
                      <span
                        key={m}
                        className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-text-secondary"
                      >
                        {m}
                      </span>
                    ))}
                    {modules.length === 0 ? (
                      <span className="text-sm text-text-muted">No modules enabled</span>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-bg-secondary p-6">
            <h2 className="text-lg font-medium">Create plan</h2>
            <p className="mt-1 text-sm text-text-muted">
              Defaults to private so custom quotes stay off the public catalog.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="text-text-muted">Name</span>
                <input
                  value={createDraft.name}
                  onChange={(e) => setCreateDraft({ ...createDraft, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-text-muted">Slug</span>
                <input
                  value={createDraft.slug}
                  onChange={(e) => setCreateDraft({ ...createDraft, slug: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 font-mono"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-text-muted">Description</span>
                <input
                  value={createDraft.description}
                  onChange={(e) =>
                    setCreateDraft({ ...createDraft, description: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Price monthly</span>
                <input
                  type="number"
                  value={createDraft.priceMonthly}
                  onChange={(e) =>
                    setCreateDraft({ ...createDraft, priceMonthly: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Price yearly</span>
                <input
                  type="number"
                  value={createDraft.priceYearly}
                  onChange={(e) =>
                    setCreateDraft({ ...createDraft, priceYearly: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Max outlets</span>
                <input
                  type="number"
                  value={createDraft.maxOutlets}
                  onChange={(e) =>
                    setCreateDraft({ ...createDraft, maxOutlets: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Max terminals</span>
                <input
                  type="number"
                  value={createDraft.maxTerminals}
                  onChange={(e) =>
                    setCreateDraft({ ...createDraft, maxTerminals: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Max users</span>
                <input
                  type="number"
                  value={createDraft.maxUsers}
                  onChange={(e) =>
                    setCreateDraft({ ...createDraft, maxUsers: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Visibility</span>
                <select
                  value={createDraft.visibility}
                  onChange={(e) =>
                    setCreateDraft({
                      ...createDraft,
                      visibility: e.target.value === 'private' ? 'private' : 'public',
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                >
                  <option value="private">Private (custom quote)</option>
                  <option value="public">Public (catalog)</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <span className="text-sm text-text-muted">Modules</span>
                <ModuleChecklist
                  selected={createDraft.modules}
                  catalog={moduleCatalog}
                  onChange={(modules) => setCreateDraft({ ...createDraft, modules })}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-4 py-2 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !createDraft.name.trim() ||
                  !createDraft.slug.trim() ||
                  createMutation.isPending
                }
                onClick={() => createMutation.mutate()}
                className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary disabled:opacity-60"
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
