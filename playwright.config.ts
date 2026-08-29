import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'e2e', '.env.local') });
dotenv.config({ path: path.join(process.cwd(), 'e2e', '.env.example') });

const apiUrl = process.env.E2E_API_URL ?? 'https://api.cullinos.com';
const webUrl = process.env.E2E_WEB_URL ?? 'https://cullinos.com';
const adminUrl = process.env.E2E_ADMIN_URL ?? 'https://admin.cullinos.com';
const managementUrl = process.env.E2E_MANAGEMENT_URL ?? 'https://manage.cullinos.com';
const superAdminUrl = process.env.E2E_SUPER_ADMIN_URL ?? 'https://platform.cullinos.com';
const customerUrl = process.env.E2E_CUSTOMER_URL ?? 'https://order.cullinos.com';
const waiterUrl = process.env.E2E_WAITER_URL ?? 'https://waiter.cullinos.com';
const posUrl = process.env.E2E_POS_URL ?? 'https://pos.cullinos.com';
const kdsUrl = process.env.E2E_KDS_URL ?? 'https://kds.cullinos.com';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'e2e-results.json' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: 'api.spec.ts',
      use: { baseURL: apiUrl },
    },
    {
      name: 'web',
      testMatch: 'web.spec.ts',
      use: { baseURL: webUrl },
    },
    {
      name: 'admin',
      testMatch: 'admin.spec.ts',
      use: { baseURL: adminUrl },
    },
    {
      name: 'management',
      testMatch: 'management.spec.ts',
      use: { baseURL: managementUrl },
    },
    {
      name: 'super-admin',
      testMatch: 'super-admin.spec.ts',
      use: { baseURL: superAdminUrl },
    },
    {
      name: 'pos',
      testMatch: 'pos.spec.ts',
      use: { baseURL: posUrl },
    },
    {
      name: 'kds',
      testMatch: 'kds.spec.ts',
      use: { baseURL: kdsUrl },
    },
    {
      name: 'waiter',
      testMatch: 'waiter.spec.ts',
      use: { baseURL: waiterUrl },
    },
    {
      name: 'customer',
      testMatch: 'customer.spec.ts',
      use: { baseURL: customerUrl },
    },
    {
      name: 'order-flow',
      testMatch: 'order-flow.spec.ts',
      use: { baseURL: waiterUrl },
    },
  ],
});
