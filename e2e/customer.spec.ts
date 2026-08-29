import { expect, test } from '@playwright/test';
import { e2eEnv } from './fixtures/env';

test.describe('Customer storefront', () => {
  test('browse menu, add item, and open cart', async ({ page }) => {
    test.skip(!e2eEnv.outletId, 'No tenant resolved — set E2E_ORG_SLUG/E2E_OUTLET_ID or ensure a storefront exists on production');
    test.skip(!e2eEnv.hasMenu, 'Storefront has no menu items yet');

    const storefrontPath = `/${e2eEnv.orgSlug}/${e2eEnv.outletSlug}`;
    await page.goto(storefrontPath);

    await expect(page.getByText(/store not found/i)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.locator('body')).not.toContainText(/loading menu/i);

    const menuItem = page.locator('button').filter({ has: page.locator('h3') }).first();
    await expect(menuItem).toBeVisible({ timeout: 20_000 });
    const itemName = (await menuItem.locator('h3').textContent())?.trim();
    await menuItem.click();

    await page.getByRole('link', { name: /cart/i }).click();
    await expect(page.getByRole('heading', { name: /your cart/i })).toBeVisible();
    if (itemName) {
      await expect(page.getByText(itemName)).toBeVisible();
    }
  });
});
