import { expect, test } from '@playwright/test';
import { e2eEnv } from './fixtures/env';

test.describe('POS', () => {
  test('cloud POS login page loads', async ({ page }) => {
    test.skip(e2eEnv.skipPos, 'Set E2E_SKIP_POS=false to test POS.');
    test.skip(!e2eEnv.posUrl, 'Set E2E_POS_URL=https://pos.cullinos.com to test.');

    await page.goto(e2eEnv.posUrl!);
    await expect(page.getByRole('heading', { name: /sign in|login/i })).toBeVisible();
  });
});
