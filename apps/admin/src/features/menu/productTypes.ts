import type { MenuItemVariant, MenuModifierGroup } from '@/lib/api';

/** Keep ids in sync with MENU_PRODUCT_TYPES in apps/api/src/modules/menu/product-types.ts */
export type ProductTypeId =
  | 'other'
  | 'tea_coffee'
  | 'juice_shake'
  | 'cold_drink'
  | 'packaged_water'
  | 'pizza'
  | 'burger_sandwich'
  | 'main_course'
  | 'biryani_rice'
  | 'dessert'
  | 'alcohol';

export interface ProductTypePreset {
  id: ProductTypeId;
  label: string;
  /** False for items where a veg/non-veg choice makes no sense (drinks, water). */
  showVeg: boolean;
  defaultVeg: boolean;
  /** Prices are 0 so they fall back to the item's base price until the owner sets them. */
  variants: MenuItemVariant[];
  modifierGroups: MenuModifierGroup[];
}

const sizes = (...names: string[]): MenuItemVariant[] =>
  names.map((name, idx) => ({ name, price: 0, isDefault: idx === 0 }));

const pickOne = (name: string, options: string[], required = false): MenuModifierGroup => ({
  name,
  minSelect: required ? 1 : 0,
  maxSelect: 1,
  isRequired: required,
  modifiers: options.map((o) => ({ name: o, price: 0 })),
});

const pickMany = (name: string, options: string[], max: number): MenuModifierGroup => ({
  name,
  minSelect: 0,
  maxSelect: max,
  isRequired: false,
  modifiers: options.map((o) => ({ name: o, price: 0 })),
});

const SUGAR = ['No sugar', 'Less', 'Normal', 'Extra'];
const ICE = ['No ice', 'Normal', 'Extra'];
const SPICE = ['Mild', 'Medium', 'Spicy'];

export const PRODUCT_TYPE_PRESETS: ProductTypePreset[] = [
  { id: 'other', label: 'Other / General', showVeg: true, defaultVeg: false, variants: [], modifierGroups: [] },
  {
    id: 'tea_coffee',
    label: 'Tea / Coffee',
    showVeg: true,
    defaultVeg: true,
    variants: sizes('Regular', 'Large'),
    modifierGroups: [pickOne('Sugar', SUGAR, true), pickOne('Milk', ['Regular', 'No milk'])],
  },
  {
    id: 'juice_shake',
    label: 'Juice / Shake',
    showVeg: true,
    defaultVeg: true,
    variants: sizes('Regular', 'Large'),
    modifierGroups: [pickOne('Sugar', SUGAR, true), pickOne('Ice', ICE)],
  },
  {
    id: 'cold_drink',
    label: 'Cold drink',
    showVeg: false,
    defaultVeg: true,
    variants: sizes('250 ml', '500 ml', '750 ml'),
    modifierGroups: [pickOne('Serve', ['Chilled', 'Room temperature']), pickOne('Ice', ICE)],
  },
  {
    id: 'packaged_water',
    label: 'Packaged water',
    showVeg: false,
    defaultVeg: true,
    variants: sizes('500 ml', '1 L'),
    modifierGroups: [pickOne('Serve', ['Chilled', 'Normal'])],
  },
  {
    id: 'pizza',
    label: 'Pizza',
    showVeg: true,
    defaultVeg: true,
    variants: sizes('Small 7"', 'Medium 10"', 'Large 12"'),
    modifierGroups: [
      pickOne('Crust', ['Thin', 'Hand-tossed', 'Cheese burst'], true),
      pickMany('Extra toppings', ['Cheese', 'Onion', 'Capsicum', 'Paneer', 'Mushroom'], 5),
    ],
  },
  {
    id: 'burger_sandwich',
    label: 'Burger / Sandwich',
    showVeg: true,
    defaultVeg: false,
    variants: [],
    modifierGroups: [pickMany('Add-ons', ['Extra cheese', 'Extra patty', 'Fries'], 3)],
  },
  {
    id: 'main_course',
    label: 'Main course / Curry',
    showVeg: true,
    defaultVeg: false,
    variants: sizes('Half', 'Full'),
    modifierGroups: [pickOne('Spice level', SPICE, true)],
  },
  {
    id: 'biryani_rice',
    label: 'Biryani / Rice',
    showVeg: true,
    defaultVeg: false,
    variants: sizes('Half', 'Full'),
    modifierGroups: [pickOne('Spice level', SPICE, true)],
  },
  {
    id: 'dessert',
    label: 'Dessert / Ice cream',
    showVeg: true,
    defaultVeg: true,
    variants: sizes('Single scoop', 'Double scoop'),
    modifierGroups: [pickMany('Toppings', ['Chocolate sauce', 'Nuts', 'Sprinkles'], 3)],
  },
  {
    id: 'alcohol',
    label: 'Alcohol (beer, wine, spirits, cocktails)',
    showVeg: false,
    defaultVeg: true,
    variants: [
      { name: '30 ml', price: 0, isDefault: true, stockMultiplier: 1 },
      { name: '60 ml', price: 0, stockMultiplier: 2 },
    ],
    modifierGroups: [pickOne('Mixer', ['Soda', 'Water', 'Cola', 'Tonic', 'On the rocks'])],
  },
];

export function getProductTypePreset(id: string | null | undefined): ProductTypePreset {
  return PRODUCT_TYPE_PRESETS.find((p) => p.id === id) ?? PRODUCT_TYPE_PRESETS[0];
}

/** Deep copy so editing the form never mutates the shared preset objects. */
export function presetOptions(preset: ProductTypePreset) {
  return {
    variants: preset.variants.map((v) => ({ ...v })),
    modifierGroups: preset.modifierGroups.map((g) => ({
      ...g,
      modifiers: (g.modifiers ?? []).map((m) => ({ ...m })),
    })),
  };
}
