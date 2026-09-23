import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Button,
  DataTable,
  ErrorBanner,
  Input,
  PageHeader,
  PhoneField,
  useToast,
} from '@cullinos/ui';
import { purchasingApi, type SupplierRow } from '@/lib/api';

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const suppliersQuery = useQuery({
    queryKey: ['purchasing', 'suppliers'],
    queryFn: purchasingApi.listSuppliers,
  });

  const createMutation = useMutation({
    mutationFn: purchasingApi.createSupplier,
    onSuccess: () => {
      toast.success('Supplier added.');
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'suppliers'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: purchasingApi.deleteSupplier,
    onSuccess: () => {
      toast.success('Supplier removed.');
      queryClient.invalidateQueries({ queryKey: ['purchasing', 'suppliers'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Vendor directory for purchase orders and goods receipt."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Add supplier'}
          </Button>
        }
      />

      {suppliersQuery.error ? (
        <ErrorBanner>
          {suppliersQuery.error instanceof Error
            ? suppliersQuery.error.message
            : 'Failed to load suppliers'}
        </ErrorBanner>
      ) : null}

      {showForm ? (
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">New supplier</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                name,
                email: email || undefined,
                phone: phone || undefined,
                address: address || undefined,
              });
            }}
          >
            <Input label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <PhoneField label="Phone" value={phone} onChange={setPhone} />
            <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
            <div className="sm:col-span-2">
              <Button type="submit" loading={createMutation.isPending}>
                Save supplier
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <DataTable<SupplierRow>
        columns={[
          { key: 'name', header: 'Name', cell: (s) => <span className="font-medium">{s.name}</span> },
          { key: 'email', header: 'Email', cell: (s) => s.email ?? '—' },
          { key: 'phone', header: 'Phone', cell: (s) => s.phone ?? '—' },
          {
            key: 'actions',
            header: '',
            cell: (s) => (
              <Button
                size="sm"
                variant="ghost"
                loading={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm(`Delete supplier "${s.name}"?`)) {
                    deleteMutation.mutate(s.id);
                  }
                }}
              >
                Delete
              </Button>
            ),
          },
        ]}
        rows={suppliersQuery.data ?? []}
        getRowKey={(s) => s.id}
        loading={suppliersQuery.isLoading}
        emptyMessage="No suppliers yet."
      />
    </div>
  );
}
