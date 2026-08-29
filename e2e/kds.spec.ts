import { expect, test } from '@playwright/test';
import { apiPath } from './fixtures/api';
import { e2eEnv, requireOutletId } from './fixtures/env';

test.describe('KDS', () => {
  test('kitchen display API returns for test outlet', async ({ request }) => {
    test.skip(!e2eEnv.outletId, 'No outlet resolved — run global setup or set E2E_OUTLET_ID');

    const outletId = requireOutletId();
    const response = await request.get(apiPath(`/kitchen/outlets/${outletId}/display`));
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('kitchen');
    expect(body).toHaveProperty('pickupQueue');
  });
});
