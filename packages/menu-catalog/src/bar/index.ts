import type { CatalogItem } from '../types';
import { SPIRIT_ITEMS } from './spirits';
import { WINE_BEER_ITEMS } from './wine-beer';

export { PEG_VARIANTS } from './spirits';

/** Every bar item (spirits, wine, beer, RTD, cocktails) is an alcohol product. */
export const BAR_ITEMS: CatalogItem[] = [...SPIRIT_ITEMS, ...WINE_BEER_ITEMS].map((item) => ({
  ...item,
  productType: 'alcohol',
}));
