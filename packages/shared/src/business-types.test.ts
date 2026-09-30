import { describe, expect, it } from 'vitest';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_DEFAULTS,
  RESTAURANT_SIZES,
  getBusinessTypeParent,
  getFeaturesForProfile,
  isAdminNavPathVisible,
  resolveBusinessTypeFromParent,
  shouldSkipTablesStep,
} from './business-types';
import { FEATURES } from './features';

const ORDER_TYPE_FEATURE: Record<string, string> = {
  qr: FEATURES.QR_ORDERING,
  online: FEATURES.ONLINE_ORDERING,
  delivery: FEATURES.DELIVERY,
  dine_in: FEATURES.TABLES,
  banquet: FEATURES.BANQUET,
};

describe('business type profiles', () => {
  it('enables the admin feature behind every enabled order type', () => {
    for (const type of BUSINESS_TYPES) {
      const profile = getFeaturesForProfile(type);
      for (const orderType of profile.enabledOrderTypes) {
        const feature = ORDER_TYPE_FEATURE[orderType];
        if (!feature) continue;
        expect(profile.features, `${type} accepts ${orderType}`).toContain(feature);
      }
    }
  });

  it('shows purchasing to every type that tracks inventory on Professional or above', () => {
    for (const type of BUSINESS_TYPES) {
      const profile = getFeaturesForProfile(type);
      if (profile.recommendedPlan === 'QSR' || profile.recommendedPlan === 'STARTER') continue;
      if (!profile.features.includes(FEATURES.INVENTORY)) continue;
      expect(isAdminNavPathVisible(type, '/purchasing'), type).toBe(true);
    }
  });

  it('gives every restaurant size tables and a tables onboarding step', () => {
    for (const size of RESTAURANT_SIZES) {
      expect(isAdminNavPathVisible('restaurant', '/tables', size), size).toBe(true);
      expect(shouldSkipTablesStep('restaurant', size), size).toBe(false);
    }
  });

  it('keeps kitchen displays for catering', () => {
    expect(isAdminNavPathVisible('catering', '/displays')).toBe(true);
  });

  it('includes pickup queue for counter-service types', () => {
    for (const type of ['cafe', 'food_truck', 'qsr', 'bakery'] as const) {
      expect(BUSINESS_TYPE_DEFAULTS[type].features, type).toContain(FEATURES.PICKUP_QUEUE);
    }
  });
});

describe('bar business type', () => {
  it('is a top-level parent that resolves to itself', () => {
    expect(getBusinessTypeParent('bar')).toBe('bar');
    expect(resolveBusinessTypeFromParent('bar')).toBe('bar');
  });

  it('has tables, stock, recipes and kitchen/bar displays', () => {
    const { features } = getFeaturesForProfile('bar');
    expect(features).toEqual(
      expect.arrayContaining([
        FEATURES.TABLES,
        FEATURES.KDS,
        FEATURES.INVENTORY,
        FEATURES.RECIPES,
        FEATURES.PURCHASING,
      ]),
    );
    expect(shouldSkipTablesStep('bar')).toBe(false);
  });
});

describe('isAdminNavPathVisible plan modules', () => {
  it('hides module-guarded pages the subscription does not include', () => {
    expect(isAdminNavPathVisible('bakery', '/inventory', null, ['pos', 'orders'])).toBe(false);
    expect(isAdminNavPathVisible('bakery', '/inventory', null, ['inventory'])).toBe(true);
  });

  it('ignores the plan when modules are unknown', () => {
    expect(isAdminNavPathVisible('bakery', '/inventory', null, null)).toBe(true);
    expect(isAdminNavPathVisible('bakery', '/inventory')).toBe(true);
  });

  it('does not plan-gate pages whose API is not module-guarded', () => {
    expect(isAdminNavPathVisible('catering', '/banquets', null, ['pos'])).toBe(true);
  });

  it('still applies business-type visibility when the plan allows the module', () => {
    expect(isAdminNavPathVisible('food_truck', '/tables', null, ['tables'])).toBe(false);
  });

  it('shows stock pages whenever the plan includes inventory', () => {
    for (const path of ['/inventory', '/recipes', '/purchasing', '/suppliers']) {
      expect(isAdminNavPathVisible('restaurant', path, 'small', ['inventory']), path).toBe(true);
      expect(isAdminNavPathVisible('food_truck', path, null, ['inventory']), path).toBe(true);
    }
  });

  it('shows recipes to every type that tracks inventory', () => {
    for (const type of BUSINESS_TYPES) {
      if (!getFeaturesForProfile(type).features.includes(FEATURES.INVENTORY)) continue;
      expect(isAdminNavPathVisible(type, '/recipes'), type).toBe(true);
    }
  });
});
