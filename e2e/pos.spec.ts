import { expect, test } from '@playwright/test';
import { e2eEnv } from './fixtures/env';

test.describe('POS', () => {
  test('local gateway only — skipped in cloud E2E', async () => {
    test.skip(e2eEnv.skipPos, 'POS runs on the local Cullinos Gateway, not cloud. Set E2E_SKIP_POS=false and E2E_POS_URL to test.');
    test.skip(!e2eEnv.posUrl, 'Set E2E_POS_URL to your local gateway POS URL.');
  });
});
