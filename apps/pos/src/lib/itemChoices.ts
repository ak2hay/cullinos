export interface ChoiceModifier {
  id: string;
  name: string;
  /** Paise */
  price: number;
}

export interface ChoiceGroup {
  id: string;
  name: string;
  minSelect?: number | null;
  maxSelect?: number | null;
  isRequired?: boolean;
  modifiers: ChoiceModifier[];
}

export interface ChoiceVariant {
  id: string;
  name: string;
  /** Paise */
  price: number;
  isDefault?: boolean;
}

export interface ChoiceItem {
  id: string;
  name: string;
  /** Paise */
  price: number;
  variants?: ChoiceVariant[];
  modifierGroups?: ChoiceGroup[];
}

export interface RememberedChoice {
  variantId?: string;
  modifierIds: string[];
}

export interface ResolvedSelection {
  menuItemId: string;
  name: string;
  /** Paise */
  unitPrice: number;
  variantId?: string;
  modifiers: Array<{ modifierId: string; name: string; price: number }>;
}

export type ItemTap =
  | { needsModal: true }
  | { needsModal: false; selection: ResolvedSelection };

function requiredMin(group: ChoiceGroup): number {
  const min = group.minSelect ?? 0;
  if (group.isRequired && min < 1) return 1;
  return min;
}

function activeGroups(item: ChoiceItem): ChoiceGroup[] {
  return (item.modifierGroups ?? []).filter((group) => group.modifiers.length > 0);
}

/** True when a long-press should open the size / modifier dialog. */
export function itemHasChoices(item: ChoiceItem): boolean {
  return Boolean(item.variants?.length || activeGroups(item).length);
}

/**
 * One tap adds the item. A dialog is required only when a size or a required
 * modifier cannot be resolved from the last choice, a single option, or the default.
 */
export function resolveItemTap(item: ChoiceItem, remembered?: RememberedChoice | null): ItemTap {
  const variants = item.variants ?? [];
  const variant =
    variants.find((v) => v.id === remembered?.variantId) ??
    (variants.length === 1 ? variants[0] : undefined) ??
    variants.find((v) => v.isDefault);

  if (variants.length > 0 && !variant) return { needsModal: true };

  const rememberedIds = new Set(remembered?.modifierIds ?? []);
  const chosen: ChoiceModifier[] = [];
  for (const group of activeGroups(item)) {
    const picked = group.modifiers.filter((modifier) => rememberedIds.has(modifier.id));
    if (picked.length < requiredMin(group)) return { needsModal: true };
    const max = group.maxSelect && group.maxSelect > 0 ? group.maxSelect : picked.length;
    chosen.push(...picked.slice(0, max));
  }

  const unitPrice = (variant?.price ?? item.price) + chosen.reduce((sum, modifier) => sum + modifier.price, 0);
  const name = [
    variant ? `${item.name} (${variant.name})` : item.name,
    ...chosen.map((modifier) => modifier.name),
  ].join(" + ");

  return {
    needsModal: false,
    selection: {
      menuItemId: item.id,
      name,
      unitPrice,
      ...(variant ? { variantId: variant.id } : {}),
      modifiers: chosen.map((modifier) => ({
        modifierId: modifier.id,
        name: modifier.name,
        price: modifier.price,
      })),
    },
  };
}

export function choiceFromSelection(selection: ResolvedSelection): RememberedChoice {
  return {
    ...(selection.variantId ? { variantId: selection.variantId } : {}),
    modifierIds: selection.modifiers.map((modifier) => modifier.modifierId),
  };
}
