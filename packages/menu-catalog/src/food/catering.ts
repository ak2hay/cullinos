import { group } from '../define';
import type { CatalogItem } from '../types';

const PKG = { productType: 'main_course' as const, unit: 'plate' as const };

const packages: CatalogItem[] = [
  ...group('catering_packages', 'veg', PKG, [
    ['Veg Basic Package (per plate)', 'v', 250, 350, '', { desc: '1 starter, 2 mains, dal, rice, breads, salad, 1 dessert' }],
    ['Veg Silver Package (per plate)', 'v', 350, 480, 'paneer:80', { desc: '2 starters, 3 mains, dal, rice, breads, salad, 2 desserts' }],
    ['Veg Gold Package (per plate)', 'v', 480, 650, 'paneer:120', { desc: '3 starters, 4 mains, dal, biryani, breads, live chaat, 2 desserts' }],
    ['Veg Platinum Package (per plate)', 'v', 650, 900, 'paneer:150', { desc: '4 starters, 5 mains, live counters, 3 desserts, welcome drinks' }],
    ['Jain Package (per plate)', 'v', 350, 500, 'paneer:80'],
    ['Veg Buffet Lunch (per plate)', 'v', 300, 450, 'paneer:80'],
    ['Corporate Veg Lunch (per plate)', 'v', 180, 260],
    ['Satvik Package (per plate)', 'v', 300, 420],
  ]),
  ...group('catering_packages', 'nonveg', PKG, [
    ['Non-Veg Basic Package (per plate)', 'n', 350, 480, 'chicken_curry_cut:150'],
    ['Non-Veg Silver Package (per plate)', 'n', 480, 650, 'chicken_curry_cut:200'],
    ['Non-Veg Gold Package (per plate)', 'n', 650, 850, 'chicken_curry_cut:200 mutton:100'],
    ['Non-Veg Platinum Package (per plate)', 'n', 850, 1200, 'chicken_curry_cut:200 mutton:150 fish:80'],
    ['Corporate Non-Veg Lunch (per plate)', 'n', 240, 340, 'chicken_curry_cut:120'],
    ['Biryani Party Package (per plate)', 'n', 300, 420, 'basmati_rice:150 chicken_curry_cut:180'],
  ]),
  ...group('catering_packages', 'boxes', { productType: 'main_course', tags: ['delivery_friendly'] }, [
    ['Veg Meal Box (Party)', 'v', 180, 260],
    ['Non-Veg Meal Box (Party)', 'n', 240, 340, 'chicken_curry_cut:150'],
    ['Snack Box (Veg)', 'v', 100, 160, 'samosa:1'],
    ['Snack Box (Non-Veg)', 'n', 140, 200, 'chicken_boneless:60'],
    ['Paneer Tikka (per kg)', 'v', 1200, 1600, 'paneer:1000', { unit: 'kg' }],
    ['Chicken Tikka (per kg)', 'n', 1400, 1900, 'chicken_boneless:1000', { unit: 'kg' }],
    ['Chicken Biryani (per kg)', 'n', 900, 1300, 'basmati_rice:500 chicken_curry_cut:500', { unit: 'kg' }],
    ['Veg Biryani (per kg)', 'v', 650, 950, 'basmati_rice:600', { unit: 'kg' }],
    ['Mutton Biryani (per kg)', 'n', 1400, 1900, 'basmati_rice:500 mutton:500', { unit: 'kg' }],
    ['Dal Makhani (per kg)', 'v', 500, 750, '', { unit: 'kg' }],
    ['Gulab Jamun (per kg)', 'v', 350, 500, 'gulab_jamun:30', { unit: 'kg' }],
  ]),
];

const liveCounters: CatalogItem[] = group(
  'live_counters',
  'counters',
  { unit: 'plate', tags: ['live_counter'] },
  [
    ['Live Chaat Counter (per plate)', 'v', 120, 200],
    ['Live Pasta Counter (per plate)', 'v', 150, 250, 'pasta_dry:80'],
    ['Live Dosa Counter (per plate)', 'v', 120, 200, 'dosa_batter:150'],
    ['Live Tandoor Counter (per plate)', 'n', 200, 320, 'chicken_boneless:120'],
    ['Live Jalebi Counter (per plate)', 'v', 80, 140],
    ['Live Pani Puri Counter (per plate)', 'v', 60, 120],
    ['Live Kebab Counter (per plate)', 'n', 220, 350, 'chicken_seekh:3'],
    ['Live Noodles Counter (per plate)', 'v', 120, 200, 'hakka_noodles:120'],
    ['Live Pizza Counter (per plate)', 'v', 150, 250, 'pizza_dough:100 mozzarella:50'],
    ['Live Mocktail Counter (per guest)', 'v', 120, 200],
    ['Live Kulfi Counter (per plate)', 'v', 80, 140],
    ['Live Barbecue Counter (per plate)', 'n', 250, 400, 'chicken_boneless:150'],
  ],
);

export const CATERING_ITEMS: CatalogItem[] = [...packages, ...liveCounters];
