import { expect, test } from '@playwright/test';
import { assertNoErrorBanner, login } from './fixtures/auth';
import { e2eEnv } from './fixtures/env';

test.describe('Management', () => {
  test('owner can sign in and view enterprise dashboard', async ({ page }) => {
    test.skip(!e2eEnv.outletId, 'Owner tenant not resolved — global setup must provision or discover a tenant');

    await login(page, {
      email: e2eEnv.ownerEmail,
      password: e2eEnv.ownerPassword,
    });

    await expect(page.getByRole('heading', { name: /enterprise overview/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Consolidated revenue')).toBeVisible();
    await assertNoErrorBanner(page);

    await page.goto('/comparison');
    await expect(page.getByRole('heading', { name: /outlet comparison/i })).toBeVisible({
      timeout: 15_000,
    });
    await assertNoErrorBanner(page);
  });
});
