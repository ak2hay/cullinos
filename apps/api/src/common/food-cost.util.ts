/** Pure helpers for food-cost reporting (unit-tested). */

export type CostIngredient = {
  quantity: number;
  unitCost: number;
};

/** Cost of ingredients for `soldQty` servings given recipe yield. */
export function ingredientCostForSales(
  ingredients: CostIngredient[],
  recipeYield: number,
  soldQty: number,
): number {
  const yieldQty = recipeYield > 0 ? recipeYield : 1;
  const scale = soldQty / yieldQty;
  let total = 0;
  for (const ing of ingredients) {
    total += Number(ing.quantity) * Number(ing.unitCost) * scale;
  }
  return Math.round(total * 100) / 100;
}

export function foodCostPct(ingredientCost: number, revenue: number): number {
  if (revenue <= 0) return 0;
  return Math.round((ingredientCost / revenue) * 10000) / 100;
}
