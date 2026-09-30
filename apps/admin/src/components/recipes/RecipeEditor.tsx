import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Button, Input, Select, useToast } from '@cullinos/ui';
import { recipesApi, type InventoryItemRow, type RecipeRow } from '@/lib/api';
import { formatPackDefinition, formatServesPerPack } from '@/lib/inventory-packs';

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

function linesFromRecipe(recipe: RecipeRow | null): IngredientLine[] {
  if (!recipe?.ingredients?.length) return [emptyLine()];
  return recipe.ingredients.map((ing) => ({
    kind: ing.subRecipeId ? ('subRecipe' as const) : ('inventory' as const),
    inventoryItemId: ing.inventoryItemId ?? ing.inventoryItem?.id ?? '',
    subRecipeId: ing.subRecipeId ?? ing.subRecipe?.id ?? '',
    quantity: String(Number(ing.quantity)),
  }));
}

/**
 * One option per ingredient: outlet copies of the same item collapse (deduction
 * resolves to the selling outlet's copy), preferring the shared row. Rows already
 * linked by this recipe stay selectable.
 */
function ingredientOptions(items: InventoryItemRow[], keep: Set<string>): InventoryItemRow[] {
  const byKey = new Map<string, InventoryItemRow>();
  for (const item of items) {
    const key = item.catalogKey
      ? `ck:${item.catalogKey}`
      : `n:${item.name.trim().toLowerCase()}|${(item.sku ?? '').trim().toLowerCase()}|${item.unit}`;
    const current = byKey.get(key);
    if (!current || (!item.outletId && current.outletId)) byKey.set(key, item);
  }
  const chosen = new Set([...byKey.values()].map((i) => i.id));
  return items.filter((i) => chosen.has(i.id) || keep.has(i.id));
}

/**
 * Yield + ingredient lines for one menu item's recipe. Creates the recipe when
 * `recipe` is null, otherwise updates it. Remount (via `key`) to switch recipes.
 */
export function RecipeEditor({
  menuItemId,
  recipe,
  allRecipes,
  inventoryItems,
  header,
  onSaved,
  onCancel,
  submitLabel,
}: {
  menuItemId: string;
  recipe: RecipeRow | null;
  allRecipes: RecipeRow[];
  inventoryItems: InventoryItemRow[];
  header?: ReactNode;
  onSaved?: (recipe: RecipeRow) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [yieldQty, setYieldQty] = useState(recipe ? String(Number(recipe.yield)) : '1');
  const [ingredients, setIngredients] = useState<IngredientLine[]>(() => linesFromRecipe(recipe));

  const inventoryById = new Map(inventoryItems.map((item) => [item.id, item]));
  const inventoryOptions = ingredientOptions(
    inventoryItems,
    new Set(ingredients.map((l) => l.inventoryItemId).filter(Boolean)),
  );
  const subRecipeOptions = allRecipes.filter((r) => r.id !== recipe?.id && r.menuItemId !== menuItemId);

  const saveMutation = useMutation({
    mutationFn: (parsed: NonNullable<ReturnType<typeof parseIngredients>>) =>
      recipe
        ? recipesApi.update(recipe.id, { yieldQty: Number(yieldQty) || 1, ingredients: parsed })
        : recipesApi.create({ menuItemId, yieldQty: Number(yieldQty) || 1, ingredients: parsed }),
    onSuccess: (saved) => {
      toast.success(recipe ? 'Recipe updated.' : 'Recipe created.');
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      onSaved?.(saved);
    },
    onError: (err: Error) => toast.error(err.message),
  });

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

  function updateLine(idx: number, patch: Partial<IngredientLine>) {
    setIngredients((current) => {
      const next = [...current];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {header}
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
        <p className="text-sm font-medium text-text-secondary">Ingredients (per yield)</p>
        {ingredients.map((line, idx) => (
          <div key={idx} className="grid gap-3 sm:grid-cols-[140px_1fr_120px_auto]">
            <Select
              label={idx === 0 ? 'Type' : ' '}
              options={[
                { value: 'inventory', label: 'Inventory' },
                { value: 'subRecipe', label: 'Sub-recipe' },
              ]}
              value={line.kind}
              onChange={(e) =>
                updateLine(idx, {
                  kind: e.target.value as 'inventory' | 'subRecipe',
                  inventoryItemId: '',
                  subRecipeId: '',
                })
              }
            />
            {line.kind === 'inventory' ? (
              <Select
                label={idx === 0 ? 'Inventory item' : ' '}
                options={[
                  { value: '', label: 'Select…' },
                  ...inventoryOptions.map((item) => ({
                    value: item.id,
                    label: `${item.name} (${item.unit})`,
                  })),
                ]}
                value={line.inventoryItemId}
                onChange={(e) => updateLine(idx, { inventoryItemId: e.target.value })}
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
                onChange={(e) => updateLine(idx, { subRecipeId: e.target.value })}
              />
            )}
            <Input
              label={idx === 0 ? 'Qty' : ' '}
              type="number"
              min={0.001}
              step="any"
              value={line.quantity}
              onChange={(e) => updateLine(idx, { quantity: e.target.value })}
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
            {(() => {
              if (line.kind !== 'inventory') return null;
              const inv = inventoryById.get(line.inventoryItemId);
              if (!inv) return null;
              const perServe =
                (Number(line.quantity) || 0) / (Number(yieldQty) > 0 ? Number(yieldQty) : 1);
              const serves = formatServesPerPack(inv, perServe);
              const definition = formatPackDefinition(inv);
              if (!serves && !definition) return null;
              return (
                <p className="text-xs text-text-muted sm:col-span-4">
                  {[definition, serves].filter(Boolean).join(' · ')}
                </p>
              );
            })()}
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

      <div className="flex gap-2">
        <Button
          type="button"
          loading={saveMutation.isPending}
          onClick={() => {
            if (!menuItemId) {
              toast.error('Select a menu item.');
              return;
            }
            const parsed = parseIngredients();
            if (parsed) saveMutation.mutate(parsed);
          }}
        >
          {submitLabel ?? (recipe ? 'Save recipe' : 'Create recipe')}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
