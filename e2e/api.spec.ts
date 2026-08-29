import { expect, test } from '@playwright/test';
import { apiPath } from './fixtures/api';
import { e2eEnv } from './fixtures/env';

test.describe('API', () => {
  test('GET /api/v1/health returns ok', async ({ request }) => {
    const response = await request.get(apiPath('/health'));
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('cullinos-api');
  });

  test('POST /api/v1/auth/login with owner credentials', async ({ request }) => {
    test.skip(!e2eEnv.outletId, 'Owner tenant not resolved — global setup must provision or discover a tenant');

    const response = await request.post(apiPath('/auth/login'), {
      data: {
        email: e2eEnv.ownerEmail,
        password: e2eEnv.ownerPassword,
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.token ?? body.accessToken).toBeTruthy();
    expect(body.user?.email).toBe(e2eEnv.ownerEmail);
  });
});
