import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Button,
  DataTable,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
  useToast,
} from '@cullinos/ui';
import {
  centralKitchenApi,
  inventoryApi,
  outletsApi,
  type CentralKitchenIndentRow,
  type CentralKitchenRow,
} from '@/lib/api';

export function CentralKitchenPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showCkForm, setShowCkForm] = useState(false);
  const [showIndentForm, setShowIndentForm] = useState(false);
  const [ckName, setCkName] = useState('');
  const [ckOutletId, setCkOutletId] = useState('');
  const [indentCkId, setIndentCkId] = useState('');
  const [indentOutletId, setIndentOutletId] = useState('');
  const [indentItemId, setIndentItemId] = useState('');
  const [indentQty, setIndentQty] = useState('1');

  const outletsQuery = useQuery({ queryKey: ['outlets'], queryFn: outletsApi.list });
  const ckQuery = useQuery({ queryKey: ['central-kitchen'], queryFn: centralKitchenApi.list });
  const indentsQuery = useQuery({
    queryKey: ['central-kitchen', 'indents'],
    queryFn: () => centralKitchenApi.listIndents(),
  });
  const inventoryQuery = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: inventoryApi.listItems,
  });

  const createCkMutation = useMutation({
    mutationFn: centralKitchenApi.create,
    onSuccess: () => {
      toast.success('Central kitchen created.');
      setShowCkForm(false);
      setCkName('');
      setCkOutletId('');
      queryClient.invalidateQueries({ queryKey: ['central-kitchen'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const indentMutation = useMutation({
    mutationFn: centralKitchenApi.createIndent,
    onSuccess: () => {
      toast.success('Indent request submitted.');
      setShowIndentForm(false);
      setIndentItemId('');
      setIndentQty('1');
      queryClient.invalidateQueries({ queryKey: ['central-kitchen', 'indents'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const fulfillMutation = useMutation({
    mutationFn: centralKitchenApi.fulfillIndent,
    onSuccess: () => {
      toast.success('Indent fulfilled — stock transferred.');
      queryClient.invalidateQueries({ queryKey: ['central-kitchen', 'indents'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const planRoutesMutation = useMutation({
    mutationFn: () => centralKitchenApi.planRoutes(),
    onSuccess: () => {
      toast.success('Route planned — fulfill indents in sequence order.');
      queryClient.invalidateQueries({ queryKey: ['central-kitchen', 'indents'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const outlets = outletsQuery.data ?? [];
  const kitchens = ckQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];
  const pendingCount = (indentsQuery.data ?? []).filter(
    (i) => i.status === 'pending' || i.status === 'approved',
  ).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Central kitchen"
        description="Hub-and-spoke inventory: outlets request stock from a central kitchen via indents."
        actions={
          <div className="flex flex-wrap gap-2">
            {outlets.length > 0 ? (
              <Button variant="secondary" onClick={() => setShowCkForm((v) => !v)}>
                {showCkForm ? 'Cancel' : 'Add hub'}
              </Button>
            ) : null}
            {kitchens.length > 0 ? (
              <Button onClick={() => setShowIndentForm((v) => !v)}>
                {showIndentForm ? 'Cancel' : 'New indent'}
              </Button>
            ) : null}
            {pendingCount > 0 ? (
              <Button
                variant="secondary"
                loading={planRoutesMutation.isPending}
                onClick={() => planRoutesMutation.mutate()}
              >
                Plan route
              </Button>
            ) : null}
          </div>
        }
      />

      {(ckQuery.error || indentsQuery.error) ? (
        <ErrorBanner>Failed to load central kitchen data.</ErrorBanner>
      ) : null}

      {showCkForm ? (
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">Register central kitchen hub</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createCkMutation.mutate({
                outletId: ckOutletId,
                name: ckName,
                linkedOutletIds: outlets
                  .filter((o) => o.id !== ckOutletId)
                  .map((o) => o.id),
              });
            }}
          >
            <Input label="Hub name" required value={ckName} onChange={(e) => setCkName(e.target.value)} />
            <Select
              label="Hub outlet"
              options={[
                { value: '', label: 'Select…' },
                ...outlets.map((o) => ({ value: o.id, label: o.name })),
              ]}
              value={ckOutletId}
              onChange={(e) => setCkOutletId(e.target.value)}
              required
            />
            <p className="sm:col-span-2 text-sm text-text-muted">
              All other outlets will be linked automatically for indent requests.
            </p>
            <div className="sm:col-span-2">
              <Button type="submit" loading={createCkMutation.isPending}>
                Create hub
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {showIndentForm ? (
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">Stock indent request</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              indentMutation.mutate({
                centralKitchenId: indentCkId,
                requestingOutletId: indentOutletId,
                items: [{ inventoryItemId: indentItemId, quantity: Number(indentQty) || 1 }],
              });
            }}
          >
            <Select
              label="Central kitchen"
              options={[
                { value: '', label: 'Select…' },
                ...kitchens.map((k) => ({ value: k.id, label: k.name })),
              ]}
              value={indentCkId}
              onChange={(e) => setIndentCkId(e.target.value)}
              required
            />
            <Select
              label="Requesting outlet"
              options={[
                { value: '', label: 'Select…' },
                ...outlets.map((o) => ({ value: o.id, label: o.name })),
              ]}
              value={indentOutletId}
              onChange={(e) => setIndentOutletId(e.target.value)}
              required
            />
            <Select
              label="Inventory item"
              options={[
                { value: '', label: 'Select…' },
                ...inventoryItems.map((i) => ({ value: i.id, label: i.name })),
              ]}
              value={indentItemId}
              onChange={(e) => setIndentItemId(e.target.value)}
              required
            />
            <Input
              label="Quantity"
              type="number"
              min={0.001}
              step="any"
              value={indentQty}
              onChange={(e) => setIndentQty(e.target.value)}
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={indentMutation.isPending}>
                Submit indent
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-medium">Kitchen hubs</h2>
        <DataTable<CentralKitchenRow>
          columns={[
            { key: 'name', header: 'Name', cell: (k) => k.name },
            { key: 'outlet', header: 'Hub outlet', cell: (k) => k.outlet?.name ?? '—' },
            {
              key: 'linked',
              header: 'Linked outlets',
              cell: (k) => k.linkedOutlets?.length ?? 0,
            },
          ]}
          rows={kitchens}
          getRowKey={(k) => k.id}
          loading={ckQuery.isLoading}
          emptyMessage="No central kitchen configured."
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Indent requests</h2>
          <p className="text-sm text-text-muted">
            After planning a route, fulfill pending indents in sequence order.
          </p>
        </div>
        <DataTable<CentralKitchenIndentRow>
          columns={[
            {
              key: 'seq',
              header: 'Seq',
              cell: (i) =>
                i.sequence != null ? (
                  <span className="font-mono">
                    {i.routeCode ? `${i.routeCode}-` : ''}
                    {i.sequence}
                  </span>
                ) : (
                  '—'
                ),
            },
            {
              key: 'outlet',
              header: 'From outlet',
              cell: (i) => (
                <span>
                  {i.requestingOutlet?.name ?? '—'}
                  {i.requestingOutlet?.city ? (
                    <span className="ml-1 text-text-muted">({i.requestingOutlet.city})</span>
                  ) : null}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (i) => <span className="capitalize">{i.status}</span>,
            },
            {
              key: 'items',
              header: 'Lines',
              cell: (i) => i.items?.length ?? 0,
            },
            {
              key: 'actions',
              header: '',
              cell: (i) =>
                i.status === 'pending' || i.status === 'approved' ? (
                  <Button
                    size="sm"
                    loading={fulfillMutation.isPending}
                    onClick={() => fulfillMutation.mutate(i.id)}
                  >
                    Fulfill
                  </Button>
                ) : null,
            },
          ]}
          rows={indentsQuery.data ?? []}
          getRowKey={(i) => i.id}
          loading={indentsQuery.isLoading}
          emptyMessage="No indent requests yet."
        />
      </section>
    </div>
  );
}
