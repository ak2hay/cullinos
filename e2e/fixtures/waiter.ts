import { expect, type Page } from '@playwright/test';
import { login, type LoginCredentials } from './auth';

export async function loginAndSelectOutlet(
  page: Page,
  credentials: LoginCredentials,
): Promise<void> {
  await login(page, credentials);
  await page.locator('#outlet').waitFor({ state: 'visible', timeout: 15_000 });
  const outletSelect = page.locator('#outlet');
  const options = outletSelect.locator('option:not([value=""])');
  await expect(options.first()).toBeVisible({ timeout: 15_000 });
  const firstValue = await options.first().getAttribute('value');
  if (firstValue) {
    await outletSelect.selectOption(firstValue);
  }
}

export async function openFirstTable(page: Page): Promise<void> {
  await expect(page.getByText(/select an outlet to view tables/i)).toHaveCount(0, { timeout: 15_000 });
  const tableCard = page.locator('button').filter({ hasText: /seats/i }).first();
  await expect(tableCard).toBeVisible({ timeout: 15_000 });
  await tableCard.click();
  await expect(page).toHaveURL(/\/order\//, { timeout: 10_000 });
}

export async function quickAddFirstMenuItem(page: Page): Promise<string> {
  await page.getByRole('button', { name: '+ Quick add items' }).click();
  const menuItem = page.locator('button').filter({ hasText: /₹/ }).first();
  await expect(menuItem).toBeVisible({ timeout: 15_000 });
  const itemName = (await menuItem.locator('span').first().textContent())?.trim() ?? 'menu item';
  await menuItem.click();
  return itemName;
}
