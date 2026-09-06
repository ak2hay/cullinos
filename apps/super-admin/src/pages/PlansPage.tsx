import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { superAdminApi, type PlanSummary } from '@/lib/api';

function planModules(plan: PlanSummary): string[] {
  if (plan.modules?.length) return plan.modules;
  return (plan.features ?? []).filter((f) => f.enabled).map((f) => f.module);
}

type PlanDraft = {
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  maxOutlets: string;
  maxTerminals: string;
  isActive: boolean;
  modulesCsv: string;
};

function draftFromPlan(plan: PlanSummary): PlanDraft {
  return {
    name: plan.name,
    description: plan.description ?? '',
    priceMonthly: String(plan.priceMonthly ?? 0),
    priceYearly: String(plan.priceYearly ?? 0),
    maxOutlets: String(plan.maxOutlets ?? 1),
    maxTerminals: String(plan.maxTerminals ?? 2),
    isActive: plan.isActive !== false,
    modulesCsv: planModules(plan).join(', '),
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
  isActive: true,
  modulesCsv: '',
};

export function PlansPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState(emptyCreate);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: plans = [], isLoading, error } = useQuery({
    queryKey: ['super-admin', 'plans'],
    queryFn: () => superAdminApi.listPlans(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['super-admin', 'plans'] });

  const updateMutation = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: PlanDraft }) => {
      await superAdminApi.updatePlan(id, {
        name: next.name,
        description: next.description || null,
        priceMonthly: Number(next.priceMonthly) || 0,
        priceYearly: Number(next.priceYearly) || 0,
        maxOutlets: Number(next.maxOutlets) || 1,
        maxTerminals: Number(next.maxTerminals) || 2,
        isActive: next.isActive,
      });
      const modules = next.modulesCsv
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean);
      return superAdminApi.updatePlanModules(id, modules);
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
        modules: createDraft.modulesCsv
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean),
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

  const allKnownModules = useMemo(() => {
    const set = new Set<string>();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Plans</h1>
          <p className="mt-1 text-text-secondary">
            Manage plan pricing, limits, and enabled modules.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setSaveError(null);
          }}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-bg-primary"
        >
          Create plan
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error instanceof Error ? error.message : 'Failed to load plans'}
        </div>
      ) : null}

      {saveError ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {saveError}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading plans…</p>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const modules = planModules(plan);
            const isEditing = editingId === plan.id;
            return (
              <div key={plan.id} className="rounded-xl border border-white/5 bg-bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium">
                      {plan.name}
                      {plan.isActive === false ? (
                        <span className="ml-2 text-xs text-status-warning">(inactive)</span>
                      ) : null}
                    </h2>
                    <p className="text-sm text-text-muted">
                      {plan.slug} · ₹{plan.priceMonthly}/mo · max {plan.maxOutlets ?? 1} outlets ·{' '}
                      {plan.subscriptionCount ?? 0} subs
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => startEdit(plan)}
                        className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
                      >
                        Edit
                      </button>
                    ) : null}
                    {plan.isActive !== false ? (
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
                    <label className="flex items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
                      />
                      Active
                    </label>
                    <label className="block text-sm sm:col-span-2">
                      <span className="text-text-muted">Modules (comma-separated)</span>
                      <textarea
                        value={draft.modulesCsv}
                        onChange={(e) => setDraft({ ...draft, modulesCsv: e.target.value })}
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 font-mono text-xs outline-none focus:border-brand-accent"
                      />
                      {allKnownModules.length > 0 ? (
                        <span className="mt-1 block text-xs text-text-muted">
                          Known: {allKnownModules.join(', ')}
                        </span>
                      ) : null}
                    </label>
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
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-bg-secondary p-6">
            <h2 className="text-lg font-medium">Create plan</h2>
            <div className="mt-4 grid gap-3">
              <label className="block text-sm">
                <span className="text-text-muted">Name</span>
                <input
                  value={createDraft.name}
                  onChange={(e) => setCreateDraft({ ...createDraft, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-text-muted">Slug</span>
                <input
                  value={createDraft.slug}
                  onChange={(e) => setCreateDraft({ ...createDraft, slug: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 font-mono"
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
                <span className="text-text-muted">Modules (comma-separated)</span>
                <textarea
                  value={createDraft.modulesCsv}
                  onChange={(e) => setCreateDraft({ ...createDraft, modulesCsv: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-bg-elevated px-3 py-2 font-mono text-xs"
                />
              </label>
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
