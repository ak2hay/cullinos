import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Input, PageHeader, useToast } from '@cullinos/ui';
import { customersApi, loyaltyApi } from '@/lib/api';

export function CustomersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const customersQuery = useQuery({
    queryKey: ['customers', query],
    queryFn: () => customersApi.list(query || undefined),
  });

  function showNotice(type: 'success' | 'error', text: string) {
    if (type === 'success') toast.success(text);
    else toast.error(text);
  }

  const createMutation = useMutation({
    mutationFn: () => customersApi.create({ name, phone: phone || undefined }),
    onSuccess: () => {
      setName('');
      setPhone('');
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

  const customers = customersQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Customer list, search, and stamp-card loyalty actions."
      />

      <section className="rounded-xl border border-white/5 bg-bg-card p-5">
        <h2 className="font-semibold">Add customer</h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-3"
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
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
          />
          <div className="flex items-end">
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

      <section className="overflow-hidden rounded-xl border border-white/5 bg-bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/5 bg-bg-elevated text-text-secondary">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium">Points</th>
              <th className="px-4 py-3 font-medium">Stamps</th>
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
                <tr key={customer.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{customer.name}</td>
                  <td className="px-4 py-3 text-text-secondary">{customer.phone ?? '—'}</td>
                  <td className="px-4 py-3 font-mono">{customer.loyaltyPoints}</td>
                  <td className="px-4 py-3 font-mono">{customer.stampCount}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {customer.loyaltyTier?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-9 px-3 text-xs"
                      loading={stampMutation.isPending}
                      onClick={() => stampMutation.mutate(customer.id)}
                    >
                      Add stamp
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
