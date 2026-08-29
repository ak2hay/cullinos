import { expect, test } from '@playwright/test';
import { assertNoErrorBanner, login } from './fixtures/auth';
import { e2eEnv } from './fixtures/env';

test.describe('Super Admin', () => {
  test('super admin can sign in, list tenants, and view health', async ({ page }) => {
    await login(page, {
      email: e2eEnv.superAdminEmail,
      password: e2eEnv.superAdminPassword,
    });

    await expect(page.getByRole('heading', { name: /tenants/i })).toBeVisible({ timeout: 20_000 });
    await assertNoErrorBanner(page);

    await page.goto('/health');
    await expect(page.getByRole('heading', { name: /system health/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Total organizations')).toBeVisible();
    await assertNoErrorBanner(page);
  });
});
