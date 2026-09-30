import type { StockTemplate } from './types';

/**
 * Key countable components only. Veggies, sauces, spices and garnish are
 * deliberately not tracked; stock is stored in the base unit and bought in packs.
 */
const TEMPLATES = [
  // Proteins & dairy
  { key: 'paneer', name: 'Paneer', unit: 'g', packLabel: 'block', packSize: 1000 },
  { key: 'chicken_boneless', name: 'Chicken (boneless)', unit: 'g', packLabel: 'kg pack', packSize: 1000 },
  { key: 'chicken_curry_cut', name: 'Chicken (curry cut, bone-in)', unit: 'g', packLabel: 'kg pack', packSize: 1000 },
  { key: 'chicken_tangdi', name: 'Chicken leg (tangdi)', unit: 'pieces', packLabel: 'packet', packSize: 12 },
  { key: 'chicken_wings', name: 'Chicken wings', unit: 'pieces', packLabel: 'packet', packSize: 24 },
  { key: 'chicken_whole', name: 'Whole chicken (tandoori)', unit: 'pieces', packLabel: 'bird', packSize: 1 },
  { key: 'chicken_sausage', name: 'Chicken sausage', unit: 'pieces', packLabel: 'packet', packSize: 20 },
  { key: 'chicken_salami', name: 'Chicken salami slices', unit: 'pieces', packLabel: 'packet', packSize: 50 },
  { key: 'chicken_nuggets', name: 'Chicken nuggets (frozen)', unit: 'pieces', packLabel: 'packet', packSize: 50 },
  { key: 'chicken_seekh', name: 'Chicken seekh kebab (frozen)', unit: 'pieces', packLabel: 'packet', packSize: 20 },
  { key: 'mutton', name: 'Mutton', unit: 'g', packLabel: 'kg pack', packSize: 1000 },
  { key: 'mutton_keema', name: 'Mutton keema', unit: 'g', packLabel: 'kg pack', packSize: 1000 },
  { key: 'fish', name: 'Fish fillet', unit: 'g', packLabel: 'kg pack', packSize: 1000 },
  { key: 'prawns', name: 'Prawns', unit: 'g', packLabel: 'kg pack', packSize: 1000 },
  { key: 'eggs', name: 'Eggs', unit: 'pieces', packLabel: 'tray', packSize: 30 },
  { key: 'soya_chaap', name: 'Soya chaap sticks', unit: 'pieces', packLabel: 'packet', packSize: 10 },
  { key: 'mushroom', name: 'Mushroom', unit: 'g', packLabel: 'punnet', packSize: 200 },
  { key: 'baby_corn', name: 'Baby corn', unit: 'g', packLabel: 'packet', packSize: 500 },
  { key: 'mozzarella', name: 'Mozzarella cheese', unit: 'g', packLabel: 'block', packSize: 1000 },
  { key: 'cheese_slice', name: 'Cheese slices', unit: 'pieces', packLabel: 'packet', packSize: 100 },
  { key: 'milk', name: 'Milk', unit: 'mL', packLabel: 'packet', packSize: 1000 },
  { key: 'ice_cream', name: 'Ice cream (tub)', unit: 'mL', packLabel: 'tub', packSize: 4000 },
  { key: 'curd', name: 'Curd', unit: 'g', packLabel: 'tub', packSize: 1000 },
  // Grains, breads & doughs
  { key: 'basmati_rice', name: 'Basmati rice', unit: 'g', packLabel: 'bag', packSize: 5000 },
  { key: 'dosa_batter', name: 'Dosa / idli batter', unit: 'g', packLabel: 'bucket', packSize: 5000 },
  { key: 'burger_bun', name: 'Burger buns', unit: 'pieces', packLabel: 'packet', packSize: 6 },
  { key: 'hotdog_bun', name: 'Hot dog buns', unit: 'pieces', packLabel: 'packet', packSize: 6 },
  { key: 'pav', name: 'Pav buns', unit: 'pieces', packLabel: 'packet', packSize: 12 },
  { key: 'bread_slice', name: 'Sandwich bread slices', unit: 'pieces', packLabel: 'loaf', packSize: 18 },
  { key: 'pizza_dough', name: 'Pizza dough', unit: 'g', packLabel: 'tray', packSize: 3000 },
  { key: 'roll_paratha', name: 'Roll paratha (frozen)', unit: 'pieces', packLabel: 'packet', packSize: 20 },
  { key: 'tortilla', name: 'Tortilla wraps', unit: 'pieces', packLabel: 'packet', packSize: 10 },
  { key: 'nacho_chips', name: 'Nacho chips', unit: 'g', packLabel: 'packet', packSize: 1000 },
  { key: 'taco_shell', name: 'Taco shells', unit: 'pieces', packLabel: 'box', packSize: 12 },
  { key: 'pasta_dry', name: 'Pasta (dry)', unit: 'g', packLabel: 'packet', packSize: 500 },
  { key: 'hakka_noodles', name: 'Hakka noodles', unit: 'g', packLabel: 'packet', packSize: 1000 },
  { key: 'instant_noodles', name: 'Instant noodles (Maggi)', unit: 'pieces', packLabel: 'box', packSize: 12 },
  { key: 'croissant', name: 'Croissants (frozen)', unit: 'pieces', packLabel: 'box', packSize: 24 },
  // Frozen & ready components
  { key: 'veg_patty', name: 'Veg burger patty', unit: 'pieces', packLabel: 'box', packSize: 20 },
  { key: 'chicken_patty', name: 'Chicken burger patty', unit: 'pieces', packLabel: 'box', packSize: 20 },
  { key: 'paneer_patty', name: 'Paneer burger patty', unit: 'pieces', packLabel: 'box', packSize: 20 },
  { key: 'fish_patty', name: 'Fish burger patty', unit: 'pieces', packLabel: 'box', packSize: 20 },
  { key: 'frozen_fries', name: 'French fries (frozen)', unit: 'g', packLabel: 'bucket', packSize: 2500 },
  { key: 'potato_wedges', name: 'Potato wedges (frozen)', unit: 'g', packLabel: 'bag', packSize: 2500 },
  { key: 'veg_nuggets', name: 'Veg nuggets (frozen)', unit: 'pieces', packLabel: 'packet', packSize: 50 },
  { key: 'cheese_balls', name: 'Cheese balls / pops (frozen)', unit: 'pieces', packLabel: 'packet', packSize: 50 },
  { key: 'veg_momo', name: 'Veg momos (frozen)', unit: 'pieces', packLabel: 'packet', packSize: 20 },
  { key: 'paneer_momo', name: 'Paneer momos (frozen)', unit: 'pieces', packLabel: 'packet', packSize: 20 },
  { key: 'chicken_momo', name: 'Chicken momos (frozen)', unit: 'pieces', packLabel: 'packet', packSize: 20 },
  { key: 'corn_momo', name: 'Corn cheese momos (frozen)', unit: 'pieces', packLabel: 'packet', packSize: 20 },
  { key: 'spring_roll_sheet', name: 'Spring roll sheets', unit: 'pieces', packLabel: 'packet', packSize: 25 },
  { key: 'samosa', name: 'Samosa (frozen / ready)', unit: 'pieces', packLabel: 'packet', packSize: 24 },
  { key: 'gulab_jamun', name: 'Gulab jamun', unit: 'pieces', packLabel: 'tin', packSize: 25 },
  { key: 'rasgulla', name: 'Rasgulla', unit: 'pieces', packLabel: 'tin', packSize: 20 },
  { key: 'brownie', name: 'Brownie slabs', unit: 'pieces', packLabel: 'tray', packSize: 12 },
  // Beverage bases
  { key: 'coffee_beans', name: 'Coffee beans / ground coffee', unit: 'g', packLabel: 'bag', packSize: 1000 },
  { key: 'instant_coffee', name: 'Instant coffee', unit: 'g', packLabel: 'jar', packSize: 200 },
  { key: 'tea_leaves', name: 'Tea leaves', unit: 'g', packLabel: 'packet', packSize: 1000 },
  { key: 'green_tea_bag', name: 'Green tea bags', unit: 'pieces', packLabel: 'box', packSize: 100 },
  { key: 'soda_water', name: 'Soda water', unit: 'mL', packLabel: 'bottle', packSize: 750 },
  { key: 'tonic_water', name: 'Tonic water', unit: 'pieces', packLabel: 'crate', packSize: 24 },
  { key: 'fresh_oranges', name: 'Oranges', unit: 'pieces', packLabel: 'dozen', packSize: 12 },
  { key: 'tender_coconut', name: 'Tender coconut', unit: 'pieces', packLabel: 'bunch', packSize: 10 },
] as const satisfies readonly StockTemplate[];

export type StockTemplateKey = (typeof TEMPLATES)[number]['key'];

export const STOCK_TEMPLATES: Readonly<Record<string, StockTemplate>> = Object.fromEntries(
  TEMPLATES.map((t) => [t.key, t as StockTemplate]),
);

export function getStockTemplate(key: string): StockTemplate | undefined {
  return STOCK_TEMPLATES[key];
}
