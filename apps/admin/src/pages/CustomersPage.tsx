import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input, PageHeader, PhoneField, useToast } from '@cullinos/ui';
import { customersApi, loyaltyApi, type Customer } from '@/lib/api';

export function CustomersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [redeemPoints, setRedeemPoints] = useState('');

  const customersQuery = useQuery({
    queryKey: ['customers', query],
    queryFn: () => customersApi.list(query || undefined),
  });

  const detailQuery = useQuery({
    queryKey: ['customers', selectedId],
    queryFn: () => customersApi.get(selectedId!),
    enabled: Boolean(selectedId),
  });

  const settingsQuery = useQuery({
    queryKey: ['loyalty', 'settings'],
    queryFn: loyaltyApi.getSettings,
    enabled: Boolean(selectedId),
  });

  function showNotice(type: 'success' | 'error', text: string) {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  }

  const createMutation = useMutation({
    mutationFn: () =>
      customersApi.create({
        name,
        phone: phone || undefined,
        email: email || undefined,
        marketingEmailOptIn,
      }),
    onSuccess: () => {
      setName('');
      setPhone('');
      setEmail('');
      setMarketingEmailOptIn(false);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showNotice('success', 'Customer created.');
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const stampMutation = useMutation({
    mutationFn: (customerId: string) => loyaltyApi.addStamp(customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showNotice('success', 'Stamp added.');
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const eraseMutation = useMutation({
    mutationFn: (customerId: string) => customersApi.erase(customerId),
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showNotice('success', 'Customer personal data anonymized.');
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const exportMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const data = await customersApi.export(customerId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customer-${customerId}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => showNotice('success', 'Export downloaded.'),
    onError: (err: Error) => showNotice('error', err.message),
  });

  const redeemMutation = useMutation({
    mutationFn: ({ customerId, points }: { customerId: string; points: number }) =>
      loyaltyApi.redeem(customerId, points),
    onSuccess: (result) => {
      setRedeemPoints('');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      showNotice(
        'success',
        `Redeemed ${result.pointsRedeemed} pts for ₹${result.discountAmount}. Remaining ${result.remainingPoints}.`,
      );
    },
    onError: (err: Error) => showNotice('error', err.message),
  });

  const customers = customersQuery.data ?? [];
  const selected: Customer | undefined =
    detailQuery.data ?? customers.find((c) => c.id === selectedId);
  const minRedeem = settingsQuery.data?.minRedeem ?? 0;
  const redemptionValue = settingsQuery.data?.redemptionValue ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customer list, marketing consent, export, and erasure (DPDP)."
      />

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="font-semibold">Add customer</h2>
        <p className="mt-1 text-xs text-text-muted">
          Personal data is collected to provide loyalty and order services. Marketing email
          requires explicit opt-in.
        </p>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createMutation.mutate();
          }}
        >
          <Input
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Guest name"
          />
          <PhoneField label="Phone" value={phone} onChange={setPhone} />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="guest@example.com"
          />
          <div className="flex flex-col justify-end gap-2">
            <label className="flex items-start gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={marketingEmailOptIn}
                onChange={(e) => setMarketingEmailOptIn(e.target.checked)}
              />
              <span>Opt in to promotional email</span>
            </label>
            <Button type="submit" loading={createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, phone, or email"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery(search.trim());
            }}
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => setQuery(search.trim())}>
          Search
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <section className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/5 bg-bg-elevated text-text-secondary">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email opt-in</th>
                <th className="px-4 py-3 font-medium">Points</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customersQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    Loading customers…
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className={`cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03] ${
                      selectedId === customer.id ? 'bg-brand-primary/10' : ''
                    }`}
                    onClick={() => setSelectedId(customer.id)}
                  >
                    <td className="px-4 py-3 font-medium">{customer.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{customer.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {customer.marketingEmailOptIn ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-3 font-mono">{customer.loyaltyPoints}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {customer.loyaltyTier?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 px-3 text-xs"
                          loading={stampMutation.isPending}
                          onClick={() => stampMutation.mutate(customer.id)}
                        >
                          Add stamp
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 px-3 text-xs"
                          loading={exportMutation.isPending}
                          onClick={() => exportMutation.mutate(customer.id)}
                        >
                          Export
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 px-3 text-xs"
                          loading={eraseMutation.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Anonymize this customer’s personal data? This cannot be undone.',
                              )
                            ) {
                              eraseMutation.mutate(customer.id);
                            }
                          }}
                        >
                          Erase
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <aside className="rounded-xl border border-white/5 bg-bg-card p-5">
          {!selectedId ? (
            <p className="text-sm text-text-muted">
              Select a customer to view details and redeem loyalty points at the counter.
            </p>
          ) : detailQuery.isLoading && !selected ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : !selected ? (
            <p className="text-sm text-text-muted">Customer not found.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <p className="text-sm text-text-secondary">{selected.phone ?? 'No phone'}</p>
                  <p className="text-sm text-text-secondary">{selected.email ?? 'No email'}</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-text-primary"
                  onClick={() => setSelectedId(null)}
                >
                  Close
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-text-muted">Loyalty points</dt>
                  <dd className="font-mono text-lg">{selected.loyaltyPoints}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Tier</dt>
                  <dd>{selected.loyaltyTier?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Stamps</dt>
                  <dd>{selected.stampCount}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Email opt-in</dt>
                  <dd>{selected.marketingEmailOptIn ? 'Yes' : 'No'}</dd>
                </div>
              </dl>

              <section className="space-y-3 rounded-lg border border-white/10 bg-bg-elevated/50 p-3">
                <h3 className="text-sm font-medium">Redeem loyalty at counter</h3>
                <p className="text-xs text-text-muted">
                  Min redeem {minRedeem} pts
                  {redemptionValue > 0
                    ? ` · ₹${redemptionValue} value per point`
                    : ''}
                </p>
                <Input
                  label="Points to redeem"
                  type="number"
                  min={minRedeem || 1}
                  value={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.value)}
                  placeholder={String(minRedeem || 100)}
                />
                <Button
                  type="button"
                  loading={redeemMutation.isPending}
                  disabled={!redeemPoints || Number(redeemPoints) <= 0}
                  onClick={() => {
                    const points = Math.floor(Number(redeemPoints));
                    if (!Number.isFinite(points) || points <= 0) return;
                    redeemMutation.mutate({ customerId: selected.id, points });
                  }}
                >
                  Redeem points
                </Button>
              </section>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
