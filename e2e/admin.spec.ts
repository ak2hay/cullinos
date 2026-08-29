import { expect, test } from '@playwright/test';
import { assertNoErrorBanner, login } from './fixtures/auth';
import { e2eEnv } from './fixtures/env';

test.describe('Admin', () => {
  test('owner can sign in and open menu', async ({ page }) => {
    test.skip(!e2eEnv.outletId, 'Owner tenant not resolved — global setup must provision or discover a tenant');

    await login(page, {
      email: e2eEnv.ownerEmail,
      password: e2eEnv.ownerPassword,
    });

    await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible({
      timeout: 20_000,
    });
    await assertNoErrorBanner(page);

    await page.goto('/menu');
    await expect(page.getByRole('heading', { name: /menu/i })).toBeVisible({ timeout: 15_000 });
    await assertNoErrorBanner(page);
  });
});
