import { FEATURE_TO_MODULE, type FeatureKey } from '@cullinos/shared';

/** Resolve the subscription module key for a product feature (client check helper). */
export function moduleForFeature(feature: FeatureKey): string | undefined {
  return FEATURE_TO_MODULE[feature];
}

/** True when the feature maps to a known entitlement module. */
export function featureHasModule(feature: FeatureKey): boolean {
  return Boolean(FEATURE_TO_MODULE[feature]);
}
