import { describe, expect, it } from 'vitest';
import {
  ALCOHOL_SECTION_IDS,
  BUSINESS_TYPE_RULES,
  CATALOG_SECTION_IDS,
  getCatalogSectionVisibility,
  getEffectiveOrderTypes,
  getOrderTypeViolation,
  getPosOrderTypes,
  orgServesAlcohol,
} from './business-rules';
import { BUSINESS_TYPES, BUSINESS_TYPE_DEFAULTS, getFeaturesForProfile } from './business-types';
import { FEATURES } from './features';

describe('business type rules matrix', () => {
  it('covers every business type', () => {
    for (const type of BUSINESS_TYPES) {
      expect(BUSINESS_TYPE_RULES[type], type).toBeDefined();
    }
  });

  it('only references known catalog sections and never lists a section twice', () => {
    for (const type of BUSINESS_TYPES) {
      const { core, optional } = BUSINESS_TYPE_RULES[type].catalog;
      for (const id of [...core, ...optional]) {
        expect(CATALOG_SECTION_IDS, `${type}:${id}`).toContain(id);
      }
      const overlap = core.filter((id) => (optional as readonly string[]).includes(id));
      expect(overlap, type).toEqual([]);
    }
  });

  it('makes every catalog section reachable from at least one business type', () => {
    for (const id of CATALOG_SECTION_IDS) {
      const reachable = BUSINESS_TYPES.some(
        (type) => getCatalogSectionVisibility(type, id, { servesAlcohol: true }) !== 'hidden',
      );
      expect(reachable, id).toBe(true);
    }
  });

  it('keeps the onboarding default order types inside the allowed set', () => {
    for (const type of BUSINESS_TYPES) {
      for (const orderType of BUSINESS_TYPE_DEFAULTS[type].enabledOrderTypes) {
        expect(BUSINESS_TYPE_RULES[type].allowedOrderTypes, `${type}:${orderType}`).toContain(orderType);
      }
    }
  });

  it('only allows tables where the business-type profile has the tables feature', () => {
    for (const type of BUSINESS_TYPES) {
      const hasTablesFeature = getFeaturesForProfile(type).features.includes(FEATURES.TABLES);
      expect(BUSINESS_TYPE_RULES[type].tables, type).toBe(hasTablesFeature);
    }
  });
});

describe('catalog visibility', () => {
  it('hides Indian main course from cafes', () => {
    expect(getCatalogSectionVisibility('cafe', 'indian_main_course')).toBe('hidden');
    expect(getCatalogSectionVisibility('cafe', 'tandoor')).toBe('hidden');
    expect(getCatalogSectionVisibility('cafe', 'hot_beverages')).toBe('core');
  });

  it('shows bakery sections only to bakeries and cafes', () => {
    expect(getCatalogSectionVisibility('bakery', 'bakery_breads')).toBe('core');
    expect(getCatalogSectionVisibility('bar', 'cakes_pastries')).toBe('hidden');
  });

  it('never shows alcohol to cloud kitchens, food trucks, bakeries, QSR or catering', () => {
    for (const type of ['cloud_kitchen', 'food_truck', 'bakery', 'qsr', 'catering'] as const) {
      for (const id of ALCOHOL_SECTION_IDS) {
        expect(getCatalogSectionVisibility(type, id, { servesAlcohol: true }), `${type}:${id}`).toBe('hidden');
      }
      expect(orgServesAlcohol(type, { servesAlcohol: true }), type).toBe(false);
    }
  });

  it('shows alcohol to restaurants only when they opt in', () => {
    expect(getCatalogSectionVisibility('restaurant', 'whisky')).toBe('hidden');
    expect(getCatalogSectionVisibility('restaurant', 'whisky', { servesAlcohol: true })).toBe('optional');
    expect(orgServesAlcohol('restaurant', {})).toBe(false);
    expect(orgServesAlcohol('restaurant', { servesAlcohol: true })).toBe(true);
  });

  it('always shows alcohol to bars as core', () => {
    expect(getCatalogSectionVisibility('bar', 'beer')).toBe('core');
    expect(orgServesAlcohol('bar', {})).toBe(true);
  });
});

describe('order type rules', () => {
  it('blocks dine-in and tables for cloud kitchens', () => {
    expect(getOrderTypeViolation('cloud_kitchen', { type: 'dine_in', hasTable: false })).toMatch(/cannot/);
    expect(getOrderTypeViolation('cloud_kitchen', { type: 'delivery', hasTable: true })).toMatch(/tables/);
    expect(getOrderTypeViolation('cloud_kitchen', { type: 'qr', hasTable: false })).not.toBeNull();
    expect(getOrderTypeViolation('cloud_kitchen', { type: 'delivery', hasTable: false })).toBeNull();
  });

  it('lets food trucks take QR orders without a table', () => {
    expect(getOrderTypeViolation('food_truck', { type: 'qr', hasTable: false })).toBeNull();
    expect(getOrderTypeViolation('food_truck', { type: 'dine_in', hasTable: false })).not.toBeNull();
  });

  it('allows counter eat-in for QSR but not table orders', () => {
    expect(getOrderTypeViolation('qsr', { type: 'dine_in', hasTable: false })).toBeNull();
    expect(getOrderTypeViolation('qsr', { type: 'dine_in', hasTable: true })).toMatch(/tables/);
  });

  it('keeps hotel room service working for restaurants', () => {
    expect(getOrderTypeViolation('restaurant', { type: 'room_service', hasTable: false })).toBeNull();
  });

  it('skips enforcement when the business type is unknown', () => {
    expect(getOrderTypeViolation(null, { type: 'dine_in', hasTable: true })).toBeNull();
  });

  it('caps saved settings by the allowed order types', () => {
    expect(getEffectiveOrderTypes('cloud_kitchen', { enabledOrderTypes: ['dine_in', 'delivery'] })).toEqual([
      'delivery',
    ]);
    expect(getEffectiveOrderTypes('cloud_kitchen', {}).sort()).toEqual(['delivery', 'online', 'takeaway']);
  });

  it('builds POS counter choices per business type', () => {
    expect(getPosOrderTypes('food_truck', {})).toEqual(['takeaway']);
    expect(getPosOrderTypes('cloud_kitchen', {})).toEqual(['takeaway', 'delivery']);
    expect(getPosOrderTypes('qsr', {})).toEqual(['takeaway', 'dine_in', 'delivery']);
    expect(getPosOrderTypes('bar', {})).toEqual(['takeaway', 'dine_in']);
  });
});
