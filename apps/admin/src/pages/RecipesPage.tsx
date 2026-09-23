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
import { inventoryApi, menuApi, recipesApi, type RecipeRow } from '@/lib/api';

type IngredientLine = {
  kind: 'inventory' | 'subRecipe';
  inventoryItemId: string;
  subRecipeId: string;
  quantity: string;
};

const emptyLine = (): IngredientLine => ({
  kind: 'inventory',
  inventoryItemId: '',
  subRecipeId: '',
  quantity: '1',
});

export function RecipesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuItemId, setMenuItemId] = useState('');
  const [yieldQty, setYieldQty] = useState('1');
  const [ingredients, setIngredients] = useState<IngredientLine[]>([emptyLine()]);

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
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof recipesApi.update>[1] }) =>
      recipesApi.update(id, payload),
    onSuccess: () => {
      toast.success('Recipe updated.');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
    onError: (err: Error) => toast.error(err.message),
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
    setEditingId(null);
    setMenuItemId('');
    setYieldQty('1');
    setIngredients([emptyLine()]);
  }

  function startEdit(recipe: RecipeRow) {
    setEditingId(recipe.id);
    setShowForm(true);
    setMenuItemId(recipe.menuItemId);
    setYieldQty(String(Number(recipe.yield)));
    setIngredients(
      recipe.ingredients?.length
        ? recipe.ingredients.map((ing) => ({
            kind: ing.subRecipeId ? ('subRecipe' as const) : ('inventory' as const),
            inventoryItemId: ing.inventoryItemId ?? ing.inventoryItem?.id ?? '',
            subRecipeId: ing.subRecipeId ?? ing.subRecipe?.id ?? '',
            quantity: String(Number(ing.quantity)),
          }))
        : [emptyLine()],
    );
  }

  function parseIngredients() {
    const parsed = ingredients
      .filter((line) =>
        line.kind === 'inventory' ? Boolean(line.inventoryItemId) : Boolean(line.subRecipeId),
      )
      .map((line) =>
        line.kind === 'inventory'
          ? { inventoryItemId: line.inventoryItemId, quantity: Number(line.quantity) || 0 }
          : { subRecipeId: line.subRecipeId, quantity: Number(line.quantity) || 0 },
      );
    if (!parsed.length) {
      toast.error('Add at least one ingredient.');
      return null;
    }
    return parsed;
  }

  const recipes = recipesQuery.data ?? [];
  const menuItems = menuQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];
  const canCreate = menuItems.length > 0 && (inventoryItems.length > 0 || recipes.length > 0);
  const subRecipeOptions = recipes.filter((r) => r.id !== editingId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recipes"
        description="Link menu items to inventory ingredients or sub-recipes. Stock deducts automatically when orders are served or completed."
        actions={
          canCreate ? (
            <Button
              onClick={() => {
                if (showForm && !editingId) resetForm();
                else {
                  setEditingId(null);
                  setShowForm((v) => !v);
                }
              }}
            >
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
        <div className="rounded-xl border border-dashed border-white/10 bg-bg-card/60 px-6 py-8 text-center space-y-2">
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
        <section className="rounded-xl border border-white/5 bg-bg-card p-6">
          <h2 className="font-medium">{editingId ? 'Edit recipe' : 'New recipe'}</h2>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = parseIngredients();
              if (!parsed) return;

              if (editingId) {
                updateMutation.mutate({
                  id: editingId,
                  payload: {
                    yieldQty: Number(yieldQty) || 1,
                    ingredients: parsed,
                  },
                });
              } else {
                if (!menuItemId) {
                  toast.error('Select a menu item.');
                  return;
                }
                createMutation.mutate({
                  menuItemId,
                  yieldQty: Number(yieldQty) || 1,
                  ingredients: parsed,
                });
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {editingId ? (
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
                    ...menuItems.map((item) => ({ value: item.id, label: item.name })),
                  ]}
                  value={menuItemId}
                  onChange={(e) => setMenuItemId(e.target.value)}
                  required
                />
              )}
              <Input
                label="Yield quantity"
                type="number"
                min={0.01}
                step="any"
                value={yieldQty}
                onChange={(e) => setYieldQty(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-text-secondary">Ingredients</p>
              {ingredients.map((line, idx) => (
                <div key={idx} className="grid gap-3 sm:grid-cols-[140px_1fr_120px_auto]">
                  <Select
                    label={idx === 0 ? 'Type' : ' '}
                    options={[
                      { value: 'inventory', label: 'Inventory' },
                      { value: 'subRecipe', label: 'Sub-recipe' },
                    ]}
                    value={line.kind}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[idx] = {
                        ...next[idx],
                        kind: e.target.value as 'inventory' | 'subRecipe',
                        inventoryItemId: '',
                        subRecipeId: '',
                      };
                      setIngredients(next);
                    }}
                  />
                  {line.kind === 'inventory' ? (
                    <Select
                      label={idx === 0 ? 'Inventory item' : ' '}
                      options={[
                        { value: '', label: 'Select…' },
                        ...inventoryItems.map((item) => ({
                          value: item.id,
                          label: `${item.name} (${item.unit})`,
                        })),
                      ]}
                      value={line.inventoryItemId}
                      onChange={(e) => {
                        const next = [...ingredients];
                        next[idx] = { ...next[idx], inventoryItemId: e.target.value };
                        setIngredients(next);
                      }}
                    />
                  ) : (
                    <Select
                      label={idx === 0 ? 'Sub-recipe' : ' '}
                      options={[
                        { value: '', label: 'Select…' },
                        ...subRecipeOptions.map((r) => ({
                          value: r.id,
                          label: r.menuItem?.name ?? r.menuItemId,
                        })),
                      ]}
                      value={line.subRecipeId}
                      onChange={(e) => {
                        const next = [...ingredients];
                        next[idx] = { ...next[idx], subRecipeId: e.target.value };
                        setIngredients(next);
                      }}
                    />
                  )}
                  <Input
                    label={idx === 0 ? 'Qty' : ' '}
                    type="number"
                    min={0.001}
                    step="any"
                    value={line.quantity}
                    onChange={(e) => {
                      const next = [...ingredients];
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      setIngredients(next);
                    }}
                  />
                  {ingredients.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="self-end"
                      onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIngredients([...ingredients, emptyLine()])}
              >
                Add ingredient
              </Button>
            </div>

            <Button
              type="submit"
              loading={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? 'Save changes' : 'Create recipe'}
            </Button>
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
              <ul className="text-text-secondary">
                {(recipe.ingredients ?? []).map((ing) => (
                  <li key={ing.id}>
                    {ing.subRecipeId
                      ? `Sub: ${ing.subRecipe?.menuItem?.name ?? ing.subRecipeId}`
                      : (ing.inventoryItem?.name ?? 'Item')}{' '}
                    — {Number(ing.quantity)}{' '}
                    {ing.inventoryItem?.unit ?? ''}
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
    </div>
  );
}
