import type { CatalogItem } from '../types';
import { ASIAN_ITEMS } from './asian';
import { BAKERY_ITEMS } from './bakery';
import { CATERING_ITEMS } from './catering';
import { FAST_FOOD_ITEMS } from './fast-food';
import { INDIAN_ITEMS } from './indian';
import { INTERNATIONAL_ITEMS } from './international';

export const FOOD_ITEMS: CatalogItem[] = [
  ...INDIAN_ITEMS,
  ...ASIAN_ITEMS,
  ...FAST_FOOD_ITEMS,
  ...INTERNATIONAL_ITEMS,
  ...BAKERY_ITEMS,
  ...CATERING_ITEMS,
];
