import { expect, test } from '@playwright/test';
import { assertNoErrorBanner } from './fixtures/auth';
import { e2eEnv } from './fixtures/env';
import { loginAndSelectOutlet, openFirstTable, quickAddFirstMenuItem } from './fixtures/waiter';

test.describe('Waiter', () => {
  test('waiter can select outlet, open table, and add item', async ({ page }) => {
    test.skip(!e2eEnv.hasTables, 'No tables on test outlet — add tables in Admin or seed the database.');
    test.skip(!e2eEnv.hasMenu, 'No menu items on test outlet — global setup could not seed menu.');

    await loginAndSelectOutlet(page, {
      email: e2eEnv.waiterEmail,
      password: e2eEnv.waiterPassword,
    });
    await assertNoErrorBanner(page);

    await openFirstTable(page);
    const itemName = await quickAddFirstMenuItem(page);

    await expect(page.getByText(itemName)).toBeVisible({ timeout: 15_000 });
    await assertNoErrorBanner(page);
  });
});
