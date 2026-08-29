import { expect, test } from '@playwright/test';
import { apiPath } from './fixtures/api';
import { e2eEnv } from './fixtures/env';
import { loginAndSelectOutlet, openFirstTable, quickAddFirstMenuItem } from './fixtures/waiter';

test.describe('Order flow', () => {
  test('waiter order appears on kitchen display API', async ({ browser, request }) => {
    test.skip(!e2eEnv.outletId, 'No outlet resolved — run global setup or set E2E_OUTLET_ID');
    test.skip(!e2eEnv.hasTables, 'No tables on test outlet.');
    test.skip(!e2eEnv.hasMenu, 'No menu items on test outlet.');

    const outletId = e2eEnv.outletId;
    const before = await request.get(apiPath(`/kitchen/outlets/${outletId}/display`));
    expect(before.ok()).toBeTruthy();
    const beforeBody = await before.json();
    const kotCountBefore = (beforeBody.kitchen ?? []).length;

    const waiterContext = await browser.newContext({ baseURL: e2eEnv.waiterUrl });
    const waiterPage = await waiterContext.newPage();
    await loginAndSelectOutlet(waiterPage, {
      email: e2eEnv.waiterEmail,
      password: e2eEnv.waiterPassword,
    });
    await openFirstTable(waiterPage);
    await quickAddFirstMenuItem(waiterPage);

    await expect
      .poll(
        async () => {
          const response = await request.get(apiPath(`/kitchen/outlets/${outletId}/display`));
          if (!response.ok()) return kotCountBefore;
          const body = await response.json();
          return (body.kitchen ?? []).length;
        },
        { timeout: 30_000, intervals: [2_000] },
      )
      .toBeGreaterThan(kotCountBefore);

    await waiterContext.close();
  });
});
