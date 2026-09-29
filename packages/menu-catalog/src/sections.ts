import { CATALOG_SECTIONS, type CatalogSectionId } from '@cullinos/shared';
import type { CatalogSubCategory } from './types';

const sc = (id: string, label: string): CatalogSubCategory => ({ id, label });

/** Sub-categories per top-level section (imported as child MenuCategory rows). */
export const CATALOG_SUBCATEGORIES: Record<CatalogSectionId, readonly CatalogSubCategory[]> = {
  indian_starters: [
    sc('veg', 'Veg Starters'),
    sc('paneer', 'Paneer Starters'),
    sc('chicken', 'Chicken Starters'),
    sc('mutton', 'Mutton Starters'),
    sc('seafood', 'Fish & Seafood Starters'),
    sc('platters', 'Platters'),
  ],
  tandoor: [
    sc('veg', 'Veg Tandoor'),
    sc('paneer', 'Paneer Tikka'),
    sc('chicken', 'Chicken Tandoor'),
    sc('kebabs', 'Kebabs'),
    sc('seafood', 'Seafood Tandoor'),
  ],
  indian_main_course: [
    sc('paneer', 'Paneer'),
    sc('veg', 'Vegetables & Kofta'),
    sc('dal', 'Dal'),
    sc('egg', 'Egg Curries'),
    sc('chicken', 'Chicken'),
    sc('mutton', 'Mutton'),
    sc('seafood', 'Fish & Prawns'),
  ],
  indian_breads: [
    sc('roti', 'Roti'),
    sc('naan', 'Naan'),
    sc('paratha', 'Paratha'),
    sc('kulcha', 'Kulcha'),
  ],
  rice_biryani: [
    sc('veg_biryani', 'Veg Biryani'),
    sc('chicken_biryani', 'Chicken Biryani'),
    sc('mutton_biryani', 'Mutton Biryani'),
    sc('other_biryani', 'Egg & Seafood Biryani'),
    sc('rice', 'Rice & Pulao'),
    sc('bowls', 'Rice Bowls'),
  ],
  thalis_combos: [
    sc('veg_thali', 'Veg Thali'),
    sc('nonveg_thali', 'Non-Veg Thali'),
    sc('meal_box', 'Meal Boxes'),
    sc('combos', 'Combos'),
  ],
  south_indian: [
    sc('dosa', 'Dosa'),
    sc('idli_vada', 'Idli & Vada'),
    sc('uttapam', 'Uttapam'),
    sc('specials', 'Rice & Regional Specials'),
  ],
  chaat_street: [
    sc('chaat', 'Chaat'),
    sc('pav', 'Pav Specials'),
    sc('street', 'Street Snacks'),
  ],
  indo_chinese: [
    sc('veg_starters', 'Veg Starters'),
    sc('nonveg_starters', 'Non-Veg Starters'),
    sc('noodles', 'Noodles'),
    sc('fried_rice', 'Fried Rice'),
    sc('gravy', 'Main Course Gravies'),
  ],
  momos: [
    sc('steamed', 'Steamed Momos'),
    sc('fried', 'Fried Momos'),
    sc('tandoori', 'Tandoori & Pan-Fried Momos'),
    sc('specials', 'Specials & Dim Sum'),
  ],
  thai_asian: [
    sc('starters', 'Asian Starters'),
    sc('curries', 'Thai Curries'),
    sc('noodles_rice', 'Noodles & Rice'),
  ],
  japanese: [
    sc('sushi', 'Sushi & Rolls'),
    sc('ramen', 'Ramen & Bowls'),
    sc('starters', 'Starters'),
  ],
  rolls_wraps: [
    sc('kathi', 'Kathi Rolls'),
    sc('wraps', 'Wraps'),
    sc('shawarma', 'Shawarma'),
  ],
  burgers: [
    sc('veg', 'Veg Burgers'),
    sc('chicken', 'Chicken & Non-Veg Burgers'),
  ],
  sandwiches: [
    sc('veg', 'Veg Sandwiches'),
    sc('nonveg', 'Non-Veg Sandwiches'),
    sc('club', 'Club & Subs'),
  ],
  pizza: [
    sc('veg', 'Veg Pizza'),
    sc('nonveg', 'Non-Veg Pizza'),
    sc('specialty', 'Specialty & Garlic Bread'),
  ],
  pasta: [
    sc('red', 'Red Sauce'),
    sc('white', 'White Sauce'),
    sc('pink_pesto', 'Pink, Pesto & Aglio Olio'),
    sc('baked', 'Baked Pasta & Lasagne'),
  ],
  fried_chicken: [
    sc('fried', 'Fried Chicken'),
    sc('wings', 'Wings'),
    sc('buckets', 'Buckets & Combos'),
  ],
  fries_sides: [
    sc('fries', 'Fries'),
    sc('loaded', 'Loaded Fries'),
    sc('sides', 'Sides & Dips'),
  ],
  continental: [
    sc('starters', 'Starters'),
    sc('sizzlers', 'Sizzlers'),
    sc('grills', 'Grills & Steaks'),
    sc('mains', 'Mains'),
  ],
  mexican: [
    sc('tacos_burritos', 'Tacos & Burritos'),
    sc('nachos', 'Nachos & Quesadillas'),
    sc('bowls', 'Bowls'),
  ],
  soups_salads: [
    sc('veg_soups', 'Veg Soups'),
    sc('nonveg_soups', 'Non-Veg Soups'),
    sc('salads', 'Salads'),
  ],
  breakfast: [
    sc('eggs', 'Eggs'),
    sc('pancakes', 'Pancakes & Waffles'),
    sc('indian', 'Indian Breakfast'),
    sc('toasts_bowls', 'Toasts & Bowls'),
  ],
  quick_bites: [
    sc('maggi', 'Maggi & Noodles'),
    sc('snacks', 'Quick Snacks'),
  ],
  bar_snacks: [
    sc('veg', 'Veg Bar Snacks'),
    sc('nonveg', 'Non-Veg Bar Snacks'),
    sc('platters', 'Platters'),
  ],
  bakery_breads: [
    sc('breads', 'Breads'),
    sc('buns', 'Buns & Rolls'),
    sc('rusks', 'Rusks & Toast'),
  ],
  cakes_pastries: [
    sc('pastries', 'Pastries'),
    sc('whole_cakes', 'Whole Cakes'),
    sc('cheesecakes', 'Cheesecakes & Tarts'),
    sc('muffins', 'Cupcakes, Muffins & Brownies'),
  ],
  cookies_savouries: [
    sc('cookies', 'Cookies & Biscuits'),
    sc('puffs', 'Puffs & Patties'),
    sc('savouries', 'Savouries'),
  ],
  desserts: [
    sc('indian', 'Indian Sweets'),
    sc('ice_cream', 'Ice Cream'),
    sc('sundaes', 'Sundaes & Shakes'),
    sc('western', 'Western Desserts'),
  ],
  catering_packages: [
    sc('veg', 'Veg Packages'),
    sc('nonveg', 'Non-Veg Packages'),
    sc('boxes', 'Party Boxes'),
  ],
  live_counters: [sc('counters', 'Live Counters')],
  hot_beverages: [
    sc('tea', 'Tea'),
    sc('coffee', 'Coffee'),
    sc('other', 'Hot Chocolate & More'),
  ],
  cold_coffee_shakes: [
    sc('cold_coffee', 'Cold Coffee'),
    sc('shakes', 'Shakes'),
    sc('frappes', 'Frappes & Iced Tea'),
  ],
  juices_smoothies: [
    sc('juices', 'Fresh Juices'),
    sc('smoothies', 'Smoothies'),
    sc('coolers', 'Lassi & Coolers'),
  ],
  mocktails: [
    sc('mocktails', 'Mocktails'),
    sc('mojitos', 'Virgin Mojitos & Coolers'),
  ],
  soft_drinks: [
    sc('aerated', 'Aerated Drinks'),
    sc('water', 'Water & Soda'),
    sc('energy', 'Energy & Sports Drinks'),
    sc('mixers', 'Mixers'),
  ],
  whisky: [
    sc('indian', 'Indian Whisky'),
    sc('blended_scotch', 'Blended Scotch'),
    sc('single_malt', 'Single Malt'),
    sc('indian_single_malt', 'Indian Single Malt'),
    sc('irish', 'Irish Whiskey'),
    sc('american', 'Bourbon & American'),
    sc('japanese', 'Japanese Whisky'),
  ],
  vodka: [
    sc('indian', 'Indian Vodka'),
    sc('imported', 'Imported Vodka'),
    sc('flavoured', 'Flavoured Vodka'),
  ],
  rum: [
    sc('indian', 'Indian Rum'),
    sc('white', 'White Rum'),
    sc('imported', 'Imported & Spiced Rum'),
  ],
  gin: [
    sc('indian', 'Indian Craft Gin'),
    sc('imported', 'Imported Gin'),
  ],
  tequila: [
    sc('blanco', 'Blanco / Silver'),
    sc('aged', 'Reposado & Añejo'),
    sc('mezcal', 'Mezcal & Agave'),
  ],
  brandy: [
    sc('indian', 'Indian Brandy'),
    sc('cognac', 'Cognac & Imported'),
  ],
  liqueur: [
    sc('cream', 'Cream Liqueurs'),
    sc('herbal', 'Herbal & Anise'),
    sc('fruit_coffee', 'Fruit, Nut & Coffee'),
  ],
  wine: [
    sc('indian_red', 'Indian Red'),
    sc('indian_white', 'Indian White'),
    sc('indian_rose', 'Indian Rosé'),
    sc('indian_sparkling', 'Indian Sparkling'),
    sc('imported_red', 'Imported Red'),
    sc('imported_white', 'Imported White'),
    sc('imported_rose', 'Imported Rosé'),
    sc('imported_sparkling', 'Champagne & Imported Sparkling'),
  ],
  beer: [
    sc('draught', 'Draught'),
    sc('bottle', 'Bottle & Can'),
    sc('craft', 'Craft'),
    sc('imported', 'Imported'),
  ],
  rtd: [
    sc('breezers', 'Breezers'),
    sc('cocktails', 'RTD Cocktails'),
    sc('cider_seltzer', 'Cider & Hard Seltzer'),
  ],
  cocktails: [
    sc('classic', 'Classic Cocktails'),
    sc('signature', 'Signature & Indian Twist'),
    sc('shots', 'Shots & Shooters'),
    sc('pitchers', 'Pitchers & Buckets'),
  ],
};

export interface CatalogSectionMeta {
  id: CatalogSectionId;
  label: string;
  group: (typeof CATALOG_SECTIONS)[number]['group'];
  subCategories: readonly CatalogSubCategory[];
}

export const CATALOG_SECTION_META: readonly CatalogSectionMeta[] = CATALOG_SECTIONS.map((s) => ({
  id: s.id,
  label: s.label,
  group: s.group,
  subCategories: CATALOG_SUBCATEGORIES[s.id],
}));

export function getSubCategoryLabel(sectionId: CatalogSectionId, subCategoryId: string): string {
  return CATALOG_SUBCATEGORIES[sectionId]?.find((s) => s.id === subCategoryId)?.label ?? subCategoryId;
}
