import { expect, test } from '@playwright/test';
import { apiPath } from './fixtures/api';
import { e2eEnv } from './fixtures/env';

test.describe('Order flow', () => {
  test('staff quick-order appears on kitchen display API', async ({ request }) => {
    test.skip(!e2eEnv.outletId, 'No outlet resolved — run global setup or set E2E_OUTLET_ID');
    test.skip(!e2eEnv.hasTables, 'No tables on test outlet.');
    test.skip(!e2eEnv.hasMenu, 'No menu items on test outlet.');

    const outletId = e2eEnv.outletId;

    const login = await request.post(apiPath('/auth/login'), {
      data: {
        email: e2eEnv.waiterEmail,
        password: e2eEnv.waiterPassword,
      },
    });
    expect(login.ok()).toBeTruthy();
    const loginBody = await login.json();
    const token = loginBody.token ?? loginBody.accessToken;
    expect(token).toBeTruthy();
    const auth = { Authorization: `Bearer ${token}` };

    const tablesRes = await request.get(apiPath(`/tables/outlets/${outletId}`), {
      headers: auth,
    });
    expect(tablesRes.ok()).toBeTruthy();
    const tablesBody = await tablesRes.json();
    const tables = Array.isArray(tablesBody) ? tablesBody : (tablesBody.tables ?? tablesBody.data ?? []);
    expect(tables.length).toBeGreaterThan(0);
    const tableId = tables[0].id as string;

    const menuRes = await request.get(apiPath(`/menu/outlets/${outletId}`), {
      headers: auth,
    });
    expect(menuRes.ok()).toBeTruthy();
    const menuBody = await menuRes.json();
    const flatItems = Array.isArray(menuBody.items) ? menuBody.items : [];
    expect(flatItems.length).toBeGreaterThan(0);
    const menuItemId = flatItems[0].id as string;

    const before = await request.get(apiPath(`/kitchen/outlets/${outletId}/display`));
    expect(before.ok()).toBeTruthy();
    const beforeBody = await before.json();
    const kotCountBefore = (beforeBody.kitchen ?? []).length;

    const orderRes = await request.post(apiPath('/pos/quick-order'), {
      headers: auth,
      data: {
        outletId,
        tableId,
        source: 'WAITER',
        autoConfirm: true,
        items: [{ menuItemId, quantity: 1 }],
      },
    });
    expect(orderRes.ok()).toBeTruthy();

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
  });
});
