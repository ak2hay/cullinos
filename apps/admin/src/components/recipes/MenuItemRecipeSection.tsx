import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button, useToast } from '@cullinos/ui';
import { ApiRequestError, inventoryApi, recipesApi } from '@/lib/api';
import { RecipeEditor } from './RecipeEditor';

/** Recipe (ingredients used) for one menu item, shown inside the menu item drawer. */
export function MenuItemRecipeSection({
  menuItemId,
  enabled,
}: {
  menuItemId: string | null;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const active = enabled && Boolean(menuItemId);

  const recipesQuery = useQuery({
    queryKey: ['recipes'],
    queryFn: recipesApi.list,
    enabled: active,
    retry: false,
  });
  const inventoryQuery = useQuery({
    queryKey: ['inventory', 'items'],
    queryFn: () => inventoryApi.listItems(),
    enabled: active,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: recipesApi.remove,
    onSuccess: () => {
      toast.success('Recipe removed.');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const forbidden = [recipesQuery.error, inventoryQuery.error].some(
    (err) => err instanceof ApiRequestError && (err.status === 403 || err.status === 404),
  );
  if (forbidden) return null;

  if (!menuItemId) {
    return (
      <section className="rounded-lg border border-dashed border-line p-3 text-sm text-text-muted">
        <p className="font-medium text-text-secondary">Add recipe</p>
        Save the item first, then choose the inventory items and quantities deducted when it is sold.
      </section>
    );
  }

  const recipes = recipesQuery.data ?? [];
  const inventoryItems = inventoryQuery.data ?? [];
  const recipe = recipes.find((r) => r.menuItemId === menuItemId) ?? null;

  return (
    <section
      className="space-y-3 rounded-lg border border-line-subtle p-3"
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') e.preventDefault();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{recipe ? 'Recipe' : 'Add recipe'}</p>
          <p className="text-xs text-text-muted">
            These inventory items and quantities are deducted from stock when this item is sold.
            Variant “Stock ×” scales these quantities.
          </p>
        </div>
        {recipe ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            loading={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm('Remove this recipe? Sales will stop deducting stock.')) {
                deleteMutation.mutate(recipe.id);
              }
            }}
          >
            Remove recipe
          </Button>
        ) : null}
      </div>

      {recipesQuery.isLoading || inventoryQuery.isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : inventoryItems.length === 0 && recipes.length === 0 ? (
        <p className="text-sm text-text-muted">
          No inventory items yet. Add ingredients under{' '}
          <Link to="/inventory" className="text-brand-primary underline">
            Inventory
          </Link>{' '}
          first.
        </p>
      ) : (
        <RecipeEditor
          key={recipe?.id ?? `new-${menuItemId}`}
          menuItemId={menuItemId}
          recipe={recipe}
          allRecipes={recipes}
          inventoryItems={inventoryItems}
        />
      )}
    </section>
  );
}
