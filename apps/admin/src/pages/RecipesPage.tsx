import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Button,
  DataTable,
  ErrorBanner,
  PageHeader,
  Select,
  useToast,
} from '@cullinos/ui';
import { RecipeEditor } from '@/components/recipes/RecipeEditor';
import { StockDeductionSetting } from '@/components/recipes/StockDeductionSetting';
import { inventoryApi, menuApi, recipesApi, type RecipeRow } from '@/lib/api';
import { formatServesPerPack } from '@/lib/inventory-packs';

export function RecipesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RecipeRow | null>(null);
  const [menuItemId, setMenuItemId] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);

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
    queryFn: () => inventoryApi.listItems(),
  });

  const deleteMutation = useMutation({
    mutationFn: recipesApi.remove,
    onSuccess: () => {
      toast.success('Recipe deleted.');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function resetForm() {
    setShowForm(false);
    setEditing(null);
    setMenuItemId('');
  }

  function startEdit(recipe: RecipeRow) {
    setEditing(recipe);
    setMenuItemId(recipe.menuItemId);
    setShowForm(true);
  }

  function startNew(forMenuItemId = '') {
    setEditing(null);
    setMenuItemId(forMenuItemId);
    setShowForm(true);
  }

  const recipes = recipesQuery.data ?? [];
  const menuItems = menuQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];
  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));
  const canCreate = menuItems.length > 0 && (inventoryItems.length > 0 || recipes.length > 0);
  const linkedMenuIds = new Set(recipes.map((r) => r.menuItemId));
  const unlinkedMenuItems = menuItems.filter((m) => !linkedMenuIds.has(m.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recipes"
        description="Connect each menu item to the inventory it uses. When the item is sold, those ingredients are deducted from the selling outlet's stock."
        actions={
          canCreate ? (
            <Button
              onClick={() => {
                if (showForm && !editing) resetForm();
                else startNew();
              }}
            >
              {showForm && !editing ? 'Cancel' : 'Add recipe'}
            </Button>
          ) : undefined
        }
      />

      <StockDeductionSetting />

      {recipesQuery.error ? (
        <ErrorBanner>
          {recipesQuery.error instanceof Error
            ? recipesQuery.error.message
            : 'Failed to load recipes'}
        </ErrorBanner>
      ) : null}

      {!canCreate ? (
        <div className="rounded-xl border border-dashed border-line bg-bg-card/60 px-6 py-8 text-center space-y-2">
          <p className="font-medium text-text-secondary">Prerequisites needed</p>
          <p className="text-sm text-text-muted">
            Recipes link menu items to inventory stock so counts deduct automatically on each sale.
            {menuItems.length === 0 && inventoryItems.length === 0 ? (
              <> Head to <strong>Menu &amp; catalog → Menu</strong> to add items and <strong>Inventory</strong> to add stock before creating recipes.</>
            ) : menuItems.length === 0 ? (
              <> Add at least one item under <strong>Menu &amp; catalog → Menu</strong> first.</>
            ) : (
              <> Add at least one item under <strong>Inventory</strong> first.</>
            )}
          </p>
        </div>
      ) : null}

      {showForm && canCreate ? (
        <section className="rounded-xl border border-line-subtle bg-bg-card p-6">
          <h2 className="mb-4 font-medium">{editing ? 'Edit recipe' : 'New recipe'}</h2>
          <RecipeEditor
            key={editing?.id ?? `new-${menuItemId}`}
            menuItemId={menuItemId}
            recipe={editing}
            allRecipes={recipes}
            inventoryItems={inventoryItems}
            onSaved={resetForm}
            onCancel={resetForm}
            header={
              editing ? (
                <div className="text-sm">
                  <span className="text-text-secondary">Menu item</span>
                  <p className="mt-1 font-medium">
                    {menuItems.find((m) => m.id === menuItemId)?.name ?? menuItemId}
                  </p>
                </div>
              ) : (
                <Select
                  label="Menu item"
                  options={[
                    { value: '', label: 'Select…' },
                    ...unlinkedMenuItems.map((item) => ({ value: item.id, label: item.name })),
                  ]}
                  value={menuItemId}
                  onChange={(e) => setMenuItemId(e.target.value)}
                  required
                />
              )
            }
          />
        </section>
      ) : null}

      {canCreate && unlinkedMenuItems.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-warning/30 bg-status-warning/10 px-4 py-3 text-sm">
          <span>
            <strong>{unlinkedMenuItems.length}</strong> of {menuItems.length} menu items have no
            recipe, so selling them does not deduct any stock.
          </span>
          <label className="flex cursor-pointer items-center gap-2 text-text-secondary">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-primary"
              checked={missingOnly}
              onChange={(e) => setMissingOnly(e.target.checked)}
            />
            Show items without a recipe
          </label>
        </div>
      ) : null}

      {missingOnly ? (
        <DataTable
          columns={[
            {
              key: 'menu',
              header: 'Menu item',
              cell: (item) => <span className="font-medium">{item.name}</span>,
            },
            {
              key: 'actions',
              header: '',
              cell: (item) => (
                <Button size="sm" variant="secondary" onClick={() => startNew(item.id)}>
                  Add recipe
                </Button>
              ),
            },
          ]}
          rows={unlinkedMenuItems}
          getRowKey={(item) => item.id}
          emptyMessage="Every menu item has a recipe."
        />
      ) : (
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
                <ul className="text-text-secondary">
                  {(recipe.ingredients ?? []).map((ing) => (
                    <li key={ing.id}>
                      {ing.subRecipeId
                        ? `Sub: ${ing.subRecipe?.menuItem?.name ?? ing.subRecipeId}`
                        : (ing.inventoryItem?.name ?? 'Item')}{' '}
                      — {Number(ing.quantity)}{' '}
                      {ing.inventoryItem?.unit ?? ''}
                      {(() => {
                        const inv = ing.inventoryItemId ? inventoryById.get(ing.inventoryItemId) : undefined;
                        const recipeYield = Number(recipe.yield) > 0 ? Number(recipe.yield) : 1;
                        const serves = inv ? formatServesPerPack(inv, Number(ing.quantity) / recipeYield) : null;
                        return serves ? <span className="text-text-muted"> ({serves})</span> : null;
                      })()}
                    </li>
                  ))}
                </ul>
              ),
            },
            {
              key: 'actions',
              header: '',
              cell: (recipe) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(recipe)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm('Delete this recipe?')) {
                        deleteMutation.mutate(recipe.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
          rows={recipes}
          getRowKey={(recipe) => recipe.id}
          loading={recipesQuery.isLoading}
          emptyMessage={canCreate ? 'No recipes yet — click "Add recipe" above to link your first menu item to ingredients.' : 'No recipes yet.'}
        />
      )}
    </div>
  );
}
