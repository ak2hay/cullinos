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
import { inventoryApi, menuApi, recipesApi } from '@/lib/api';

export function RecipesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [menuItemId, setMenuItemId] = useState('');
  const [yieldQty, setYieldQty] = useState('1');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [quantity, setQuantity] = useState('1');

  const recipesQuery = useQuery({
    queryKey: ['recipes'],
    queryFn: recipesApi.list,
  });

  const menuQuery = useQuery({
    queryKey: ['menu', 'items'],
    queryFn: menuApi.listItems,
  });

  const inventoryQuery = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: inventoryApi.listItems,
  });

  const createMutation = useMutation({
    mutationFn: recipesApi.create,
    onSuccess: () => {
      toast.success('Recipe created.');
      setMenuItemId('');
      setYieldQty('1');
      setInventoryItemId('');
      setQuantity('1');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const recipes = recipesQuery.data ?? [];
  const menuItems = menuQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];
  const canCreate = menuItems.length > 0 && inventoryItems.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recipes"
        description="Menu item recipes and ingredient quantities used by production batches."
        actions={
          canCreate ? (
            <Button onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Cancel' : 'Add recipe'}
            </Button>
          ) : undefined
        }
      />

      {recipesQuery.error ? (
        <ErrorBanner>
          {recipesQuery.error instanceof Error
            ? recipesQuery.error.message
            : 'Failed to load recipes'}
        </ErrorBanner>
      ) : null}

      {!canCreate ? (
        <p className="text-sm text-text-muted">
          Add menu items and inventory items first to create recipes.
        </p>
      ) : null}

      {showForm && canCreate ? (
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">New recipe</h2>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!menuItemId || !inventoryItemId) {
                toast.error('Select a menu item and an ingredient.');
                return;
              }
              createMutation.mutate({
                menuItemId,
                yieldQty: Number(yieldQty) || 1,
                ingredients: [
                  {
                    inventoryItemId,
                    quantity: Number(quantity) || 1,
                  },
                ],
              });
            }}
          >
            <Select
              label="Menu item"
              options={[
                { value: '', label: 'Select…' },
                ...menuItems.map((item) => ({ value: item.id, label: item.name })),
              ]}
              value={menuItemId}
              onChange={(e) => setMenuItemId(e.target.value)}
              required
            />
            <Input
              label="Yield quantity"
              type="number"
              min={0.01}
              step="any"
              value={yieldQty}
              onChange={(e) => setYieldQty(e.target.value)}
            />
            <Select
              label="Ingredient (inventory)"
              options={[
                { value: '', label: 'Select…' },
                ...inventoryItems.map((item) => ({
                  value: item.id,
                  label: `${item.name} (${item.unit})`,
                })),
              ]}
              value={inventoryItemId}
              onChange={(e) => setInventoryItemId(e.target.value)}
              required
            />
            <Input
              label="Ingredient qty"
              type="number"
              min={0.001}
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <div className="sm:col-span-2">
              <Button type="submit" loading={createMutation.isPending}>
                Create recipe
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <DataTable
        columns={[
          {
            key: 'menu',
            header: 'Menu item',
            cell: (recipe) => (
              <span className="font-medium">
                {recipe.menuItem?.name ?? recipe.menuItemId}
              </span>
            ),
          },
          {
            key: 'yield',
            header: 'Yield',
            cell: (recipe) => Number(recipe.yield),
          },
          {
            key: 'ingredients',
            header: 'Ingredients',
            cell: (recipe) => (
              <span className="text-text-secondary">
                {recipe.ingredients?.length ?? 0} items
              </span>
            ),
          },
        ]}
        rows={recipes}
        getRowKey={(recipe) => recipe.id}
        loading={recipesQuery.isLoading}
        emptyMessage="No recipes yet."
      />
    </div>
  );
}
