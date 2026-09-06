import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, DataTable, ErrorBanner, Input, PageHeader, useToast } from '@cullinos/ui';
import { brandsApi } from '@/lib/api';

export function BrandsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const brandsQuery = useQuery({ queryKey: ['brands'], queryFn: brandsApi.list });

  const createMutation = useMutation({
    mutationFn: () => brandsApi.create({ name: name.trim(), code: code.trim() || undefined }),
    onSuccess: () => {
      setName('');
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast.success('Brand created.');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to create brand.');
    },
  });

  const brands = brandsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands"
        description="Manage virtual brands under this kitchen or multi-brand organisation."
      />

      {brandsQuery.error ? (
        <ErrorBanner>
          {brandsQuery.error instanceof Error
            ? brandsQuery.error.message
            : 'Failed to load brands'}
        </ErrorBanner>
      ) : null}

      <div className="grid gap-3 rounded-xl border border-white/5 bg-bg-card p-4 sm:grid-cols-3">
        <Input
          label="Brand name"
          placeholder="Bowl & Co"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Code / slug"
          placeholder="bowl-co"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <div className="flex items-end">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim()}
            loading={createMutation.isPending}
          >
            Add brand
          </Button>
        </div>
      </div>

      <DataTable
        columns={[
          {
            key: 'name',
            header: 'Name',
            cell: (brand) => <span className="font-medium">{brand.name}</span>,
          },
          {
            key: 'slug',
            header: 'Slug',
            cell: (brand) => (
              <span className="font-mono text-xs text-text-secondary">{brand.slug}</span>
            ),
          },
          {
            key: 'outlets',
            header: 'Outlets',
            cell: (brand) => brand._count?.outlets ?? 0,
          },
          {
            key: 'default',
            header: 'Default',
            cell: (brand) => (
              <span className="text-text-secondary">{brand.isDefault ? 'Yes' : '—'}</span>
            ),
          },
        ]}
        rows={brands}
        getRowKey={(brand) => brand.id}
        loading={brandsQuery.isLoading}
        emptyMessage="No brands yet."
      />
    </div>
  );
}
