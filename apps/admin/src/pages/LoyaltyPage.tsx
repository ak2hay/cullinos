import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button, Input, PageHeader, useToast } from '@cullinos/ui';
import { loyaltyApi, type LoyaltySettings } from '@/lib/api';

const DEFAULT_SETTINGS: LoyaltySettings = {
  pointsPerCurrency: 1,
  redemptionValue: 0.25,
  minRedeem: 100,
  stampCardEnabled: true,
};

export function LoyaltyPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_SETTINGS);
  const [tierName, setTierName] = useState('');
  const [tierMin, setTierMin] = useState('0');
  const [rewardName, setRewardName] = useState('');
  const [rewardPoints, setRewardPoints] = useState('100');

  const settingsQuery = useQuery({
    queryKey: ['loyalty', 'settings'],
    queryFn: loyaltyApi.getSettings,
  });

  const tiersQuery = useQuery({
    queryKey: ['loyalty', 'tiers'],
    queryFn: loyaltyApi.listTiers,
  });

  const rewardsQuery = useQuery({
    queryKey: ['loyalty', 'rewards'],
    queryFn: loyaltyApi.listRewards,
  });

  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data);
  }, [settingsQuery.data]);

  function showNotice(type: 'success' | 'error', text: string) {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  }

  const saveMutation = useMutation({
    mutationFn: () => loyaltyApi.updateSettings(settings),
    onSuccess: (data) => {
      setSettings(data);
      queryClient.invalidateQueries({ queryKey: ['loyalty', 'settings'] });
      showNotice('success', 'Loyalty settings saved.');
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const createTierMutation = useMutation({
    mutationFn: () =>
      loyaltyApi.createTier({
        name: tierName,
        minPoints: Number(tierMin) || 0,
      }),
    onSuccess: () => {
      setTierName('');
      setTierMin('0');
      queryClient.invalidateQueries({ queryKey: ['loyalty', 'tiers'] });
      showNotice('success', 'Tier created.');
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const createRewardMutation = useMutation({
    mutationFn: () =>
      loyaltyApi.createReward({
        name: rewardName,
        pointsCost: Number(rewardPoints) || 100,
      }),
    onSuccess: () => {
      setRewardName('');
      setRewardPoints('100');
      queryClient.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
      showNotice('success', 'Reward created.');
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const toggleRewardMutation = useMutation({
    mutationFn: (input: { id: string; isActive: boolean }) =>
      loyaltyApi.updateReward(input.id, { isActive: input.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const deleteRewardMutation = useMutation({
    mutationFn: (id: string) => loyaltyApi.deleteReward(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty', 'rewards'] });
      showNotice('success', 'Reward removed.');
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const deleteTierMutation = useMutation({
    mutationFn: (id: string) => loyaltyApi.deleteTier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loyalty', 'tiers'] });
      showNotice('success', 'Tier removed.');
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loyalty"
        description="Points wallet, catalog rewards (e.g. free drink for 100 pts), stamps, and tiers."
      />

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="font-semibold">Settings</h2>
        {settingsQuery.isLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading…</p>
        ) : (
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Input
              label="Points per currency unit"
              type="number"
              step="0.01"
              min={0}
              value={String(settings.pointsPerCurrency)}
              onChange={(e) =>
                setSettings((s) => ({ ...s, pointsPerCurrency: Number(e.target.value) || 0 }))
              }
            />
            <Input
              label="Redemption value (₹ per point)"
              type="number"
              step="0.01"
              min={0}
              value={String(settings.redemptionValue)}
              onChange={(e) =>
                setSettings((s) => ({ ...s, redemptionValue: Number(e.target.value) || 0 }))
              }
            />
            <Input
              label="Minimum redeem points"
              type="number"
              min={0}
              value={String(settings.minRedeem)}
              onChange={(e) =>
                setSettings((s) => ({ ...s, minRedeem: Number(e.target.value) || 0 }))
              }
            />
            <label className="flex items-center gap-3 pt-7 text-sm">
              <input
                type="checkbox"
                checked={settings.stampCardEnabled}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, stampCardEnabled: e.target.checked }))
                }
                className="accent-brand-primary"
              />
              Stamp card enabled
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" loading={saveMutation.isPending}>
                Save settings
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="font-semibold">Tiers</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(tiersQuery.data ?? []).map((tier) => (
            <li
              key={tier.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-bg-elevated/50 px-3 py-2"
            >
              <div className="text-text-secondary">
                <span className="font-medium text-text-primary">{tier.name}</span>
                {' — '}
                min {tier.minPoints} pts · {Number(tier.multiplier)}× multiplier
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!window.confirm(`Remove tier "${tier.name}"?`)) return;
                  deleteTierMutation.mutate(tier.id);
                }}
                loading={deleteTierMutation.isPending}
              >
                Remove
              </Button>
            </li>
          ))}
          {!tiersQuery.isLoading && (tiersQuery.data ?? []).length === 0 ? (
            <li className="text-text-muted">No tiers yet.</li>
          ) : null}
        </ul>

        <form
          className="mt-4 grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!tierName.trim()) return;
            createTierMutation.mutate();
          }}
        >
          <Input
            label="Tier name"
            required
            value={tierName}
            onChange={(e) => setTierName(e.target.value)}
            placeholder="Gold"
          />
          <Input
            label="Min points"
            type="number"
            min={0}
            value={tierMin}
            onChange={(e) => setTierMin(e.target.value)}
          />
          <div className="flex items-end">
            <Button type="submit" loading={createTierMutation.isPending}>
              Create tier
            </Button>
          </div>
        </form>
      </section>
      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="font-semibold">Reward catalog</h2>
        <p className="mt-1 text-sm text-text-muted">
          Example: Free cold drink for 100 points. Customers redeem from POS or checkout.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {(rewardsQuery.data ?? []).map((reward) => (
            <li
              key={reward.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-bg-elevated/50 px-3 py-2"
            >
              <div>
                <span className="font-medium text-text-primary">{reward.name}</span>
                <span className="text-text-secondary">
                  {' — '}
                  {reward.pointsCost} pts
                  {reward.menuItem ? ` · ${reward.menuItem.name}` : ''}
                  {!reward.isActive ? ' · inactive' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    toggleRewardMutation.mutate({
                      id: reward.id,
                      isActive: !reward.isActive,
                    })
                  }
                >
                  {reward.isActive ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!window.confirm(`Remove "${reward.name}" from the catalog?`)) return;
                    deleteRewardMutation.mutate(reward.id);
                  }}
                  loading={deleteRewardMutation.isPending}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
          {!rewardsQuery.isLoading && (rewardsQuery.data ?? []).length === 0 ? (
            <li className="text-text-muted">No rewards yet. Create one below.</li>
          ) : null}
        </ul>

        <form
          className="mt-4 grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rewardName.trim() || !rewardPoints.trim()) return;
            createRewardMutation.mutate();
          }}
        >
          <Input
            label="Reward name"
            required
            value={rewardName}
            onChange={(e) => setRewardName(e.target.value)}
            placeholder="Free cold drink"
          />
          <Input
            label="Points cost"
            type="number"
            min={1}
            required
            value={rewardPoints}
            onChange={(e) => setRewardPoints(e.target.value)}
            placeholder="100"
          />
          <div className="flex items-end">
            <Button type="submit" loading={createRewardMutation.isPending}>
              Add reward
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
