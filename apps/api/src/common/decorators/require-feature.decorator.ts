import { SetMetadata } from '@nestjs/common';
import { FeatureKey } from '@cullinos/shared';

export const FEATURE_KEY = 'feature';

export const RequireFeature = (...features: FeatureKey[]) => SetMetadata(FEATURE_KEY, features);
