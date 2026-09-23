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
import { inventoryApi, purchasingApi, type PurchaseOrderRow } from '@/lib/api';

export function PurchasingPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [itemName, setItemName] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');

  const poQuery = useQuery({
    queryKey: ['purchasing'],
    queryFn: purchasingApi.list,
  });
  const suppliersQuery = useQuery({
    queryKey: ['purchasing', 'suppliers'],
    queryFn: purchasingApi.listSuppliers,
  });
  const inventoryQuery = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: inventoryApi.listItems,
  });

  const createMutation = useMutation({
    mutationFn: purchasingApi.create,
    onSuccess: () => {
      toast.success('Purchase order created.');
      setShowForm(false);
      setSupplierId('');
      setItemName('');
      setInventoryItemId('');
      setQuantity('1');
      setUnitPrice('0');
      queryClient.invalidateQueries({ queryKey: ['purchasing'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: purchasingApi.send,
    onSuccess: () => {
      toast.success('Purchase order sent to supplier.');
      queryClient.invalidateQueries({ queryKey: ['purchasing'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const grnMutation = useMutation({
    mutationFn: async (po: PurchaseOrderRow) => {
      const grn = await purchasingApi.createGrn(po.id, {
        items: (po.items ?? []).map((line) => ({
          inventoryItemId: line.inventoryItemId ?? undefined,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
        })),
      });
      return grn;
    },
    onSuccess: async (grn) => {
      await purchasingApi.confirmGrn(grn.id);
      toast.success('Goods received — stock updated.');
      queryClient.invalidateQueries({ queryKey: ['purchasing'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const suppliers = suppliersQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchasing"
        description="Create purchase orders, send to suppliers, and receive goods (GRN) into inventory."
        actions={
          suppliers.length > 0 ? (
            <Button onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : 'New PO'}
            </Button>
          ) : undefined
        }
      />

      {poQuery.error ? (
        <ErrorBanner>
          {poQuery.error instanceof Error ? poQuery.error.message : 'Failed to load POs'}
        </ErrorBanner>
      ) : null}

      {suppliers.length === 0 ? (
        <p className="text-sm text-text-muted">
          Add a supplier first on the Suppliers page before creating purchase orders.
        </p>
      ) : null}

      {showForm && suppliers.length > 0 ? (
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">New purchase order</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!supplierId || !itemName.trim()) {
                toast.error('Select supplier and enter item name.');
                return;
              }
              createMutation.mutate({
                supplierId,
                items: [
                  {
                    inventoryItemId: inventoryItemId || undefined,
                    name: itemName.trim(),
                    quantity: Number(quantity) || 1,
                    unitPrice: Number(unitPrice) || 0,
                  },
                ],
              });
            }}
          >
            <Select
              label="Supplier"
              options={[
                { value: '', label: 'Select…' },
                ...suppliers.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
            />
            <Input
              label="Line item name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
            <Select
              label="Inventory item (optional)"
              options={[
                { value: '', label: 'None — name only' },
                ...inventoryItems.map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              ]}
              value={inventoryItemId}
              onChange={(e) => setInventoryItemId(e.target.value)}
            />
            <Input
              label="Quantity"
              type="number"
              min={0.001}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <Input
              label="Unit price (₹)"
              type="number"
              min={0}
              step="any"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={createMutation.isPending}>
                Create draft PO
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <DataTable
        columns={[
          {
            key: 'po',
            header: 'PO #',
            cell: (po) => <span className="font-medium">{po.poNumber}</span>,
          },
          {
            key: 'supplier',
            header: 'Supplier',
            cell: (po) => po.supplier?.name ?? '—',
          },
          {
            key: 'status',
            header: 'Status',
            cell: (po) => (
              <span className="capitalize text-text-secondary">{po.status}</span>
            ),
          },
          {
            key: 'total',
            header: 'Total',
            cell: (po) => `₹${Number(po.total).toFixed(2)}`,
          },
          {
            key: 'actions',
            header: '',
            cell: (po) => (
              <div className="flex flex-wrap gap-2">
                {po.status === 'draft' ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={sendMutation.isPending}
                    onClick={() => sendMutation.mutate(po.id)}
                  >
                    Send
                  </Button>
                ) : null}
                {po.status === 'sent' || po.status === 'partial' ? (
                  <Button
                    size="sm"
                    loading={grnMutation.isPending}
                    onClick={() => grnMutation.mutate(po)}
                  >
                    Receive (GRN)
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
        rows={poQuery.data ?? []}
        getRowKey={(po) => po.id}
        loading={poQuery.isLoading}
        emptyMessage="No purchase orders yet."
      />
    </div>
  );
}
