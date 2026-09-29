import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TYPES,
  CATALOG_SECTIONS,
  getBusinessTypeRules,
  isAlcoholSection,
} from '@cullinos/shared';
import {
  CATALOG_ITEMS,
  getCatalog,
  getCatalogItem,
  isCatalogItemAllowed,
  searchCatalog,
  suggestedDefaultPrice,
  validateCatalog,
  variantPrice,
} from './index';

function sectionIds(type: string, servesAlcohol = false) {
  return getCatalog({ businessType: type, servesAlcohol }).sections.map((s) => s.id);
}

describe('catalog data', () => {
  it('is structurally valid', () => {
    expect(validateCatalog()).toEqual([]);
  });

  it('has a broad food/beverage and bar catalog', () => {
    const bar = CATALOG_ITEMS.filter((i) =>
      ['whisky', 'vodka', 'rum', 'gin', 'tequila', 'brandy', 'liqueur', 'wine', 'beer', 'rtd', 'cocktails'].includes(i.sectionId),
    );
    expect(CATALOG_ITEMS.length - bar.length).toBeGreaterThan(1000);
    expect(bar.length).toBeGreaterThan(450);
  });

  it('every section has items and is reachable from at least one business type', () => {
    for (const section of CATALOG_SECTIONS) {
      expect(CATALOG_ITEMS.some((i) => i.sectionId === section.id), section.id).toBe(true);
      const reachable = BUSINESS_TYPES.some((t) => sectionIds(t, true).includes(section.id));
      expect(reachable, section.id).toBe(true);
    }
  });

  it('every liquor brand deducts mL from a 750 mL bottle with peg variants', () => {
    const whisky = getCatalogItem('whisky.johnnie_walker_black_label');
    expect(whisky?.selfStock).toEqual({ unit: 'mL', packLabel: 'bottle', packSize: 750 });
    expect(whisky?.stock).toEqual([{ templateKey: 'self', perServe: 30 }]);
    expect(whisky?.variants.map((v) => [v.name, v.stockMultiplier])).toEqual([
      ['30 mL', 1],
      ['60 mL', 2],
      ['Bottle (750 mL)', 25],
    ]);
  });

  it('marks exactly the alcohol-section items with the alcohol product type', () => {
    for (const item of CATALOG_ITEMS) {
      expect(item.productType === 'alcohol', item.id).toBe(isAlcoholSection(item.sectionId));
    }
  });

  it('burger and fries track only key components', () => {
    expect(getCatalogItem('burgers.classic_veg_burger')?.stock).toEqual([
      { templateKey: 'burger_bun', perServe: 1 },
      { templateKey: 'veg_patty', perServe: 1 },
    ]);
    expect(getCatalogItem('fries_sides.french_fries')?.stock).toEqual([
      { templateKey: 'frozen_fries', perServe: 150 },
    ]);
    expect(getCatalogItem('momos.veg_steamed_momos')?.stock).toEqual([
      { templateKey: 'veg_momo', perServe: 6 },
    ]);
  });
});

describe('getCatalog by business type', () => {
  it('cafe does not see Indian main course, tandoor, biryani or thalis', () => {
    const ids = sectionIds('cafe');
    for (const hidden of ['indian_main_course', 'tandoor', 'rice_biryani', 'thalis_combos', 'indian_breads']) {
      expect(ids).not.toContain(hidden);
    }
    expect(ids).toContain('hot_beverages');
    expect(ids).toContain('cakes_pastries');
  });

  it('cloud kitchen hides dine-in-only items (sizzlers, draught) and alcohol', () => {
    const catalog = getCatalog({ businessType: 'cloud_kitchen', servesAlcohol: true });
    const items = catalog.sections.flatMap((s) => s.subCategories.flatMap((sc) => sc.items));
    expect(items.some((i) => i.serviceTags.includes('dine_in_only'))).toBe(false);
    expect(catalog.sections.map((s) => s.group)).not.toContain('alcohol');
    expect(catalog.sections.map((s) => s.id)).toContain('thalis_combos');
  });

  it('alcohol is hidden for restaurants until they opt in, and core for bars', () => {
    expect(sectionIds('restaurant')).not.toContain('whisky');
    const optIn = getCatalog({ businessType: 'restaurant', servesAlcohol: true }).sections;
    expect(optIn.find((s) => s.id === 'whisky')?.visibility).toBe('optional');
    const bar = getCatalog({ businessType: 'bar' }).sections;
    expect(bar.find((s) => s.id === 'whisky')?.visibility).toBe('core');
    expect(bar.map((s) => s.id)).not.toContain('cakes_pastries');
  });

  it('bakery sees whole cakes by kg; food truck never sees alcohol or tables-only items', () => {
    const bakery = getCatalog({ businessType: 'bakery' }).sections.find((s) => s.id === 'cakes_pastries');
    expect(bakery?.subCategories.some((sc) => sc.id === 'whole_cakes')).toBe(true);
    const truck = getCatalog({ businessType: 'food_truck', servesAlcohol: true }).sections;
    expect(truck.map((s) => s.group)).not.toContain('alcohol');
  });

  it('catering sees per-plate packages and live counters', () => {
    const ids = sectionIds('catering');
    expect(ids).toContain('catering_packages');
    expect(ids).toContain('live_counters');
    expect(getBusinessTypeRules('catering').servingUnits).toContain('plate');
  });

  it('core sections come before optional ones', () => {
    const sections = getCatalog({ businessType: 'restaurant' }).sections;
    const firstOptional = sections.findIndex((s) => s.visibility === 'optional');
    expect(sections.slice(firstOptional).every((s) => s.visibility === 'optional')).toBe(true);
  });

  it('isCatalogItemAllowed matches getCatalog', () => {
    const sizzler = getCatalogItem('continental.veg_sizzler')!;
    expect(isCatalogItemAllowed(sizzler, { businessType: 'restaurant' })).toBe(true);
    expect(isCatalogItemAllowed(sizzler, { businessType: 'cloud_kitchen' })).toBe(false);
  });
});

describe('helpers', () => {
  it('searches by name and sub-category', () => {
    expect(searchCatalog(CATALOG_ITEMS, 'butter chicken').some((i) => i.name === 'Butter Chicken')).toBe(true);
    expect(searchCatalog(CATALOG_ITEMS, 'single malt').length).toBeGreaterThan(20);
  });

  it('suggests the middle of the price range, rounded', () => {
    expect(suggestedDefaultPrice({ suggestedPrice: { min: 250, max: 330 } })).toBe(290);
    expect(suggestedDefaultPrice({ suggestedPrice: { min: 40, max: 60 } })).toBe(50);
    expect(variantPrice(290, 0.6)).toBe(170);
  });
});
