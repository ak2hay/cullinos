import { expect, type Page } from '@playwright/test';

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function login(
  page: Page,
  credentials: LoginCredentials,
  options?: { submitLabel?: RegExp; loginPath?: string },
): Promise<void> {
  const loginPath = options?.loginPath ?? '/login';
  await page.goto(loginPath);

  const emailField = page.locator('#email').or(page.getByLabel('Email'));
  const passwordField = page.locator('#password').or(page.getByLabel('Password'));

  await emailField.fill(credentials.email);
  await passwordField.fill(credentials.password);

  const submitLabel = options?.submitLabel ?? /sign in|open register/i;
  await page.getByRole('button', { name: submitLabel }).click();

  const loginError = page.locator('[class*="status-error"]').filter({
    hasText: /failed to fetch|invalid|login failed|credentials/i,
  });

  await Promise.race([
    expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 20_000 }),
    loginError.waitFor({ state: 'visible', timeout: 20_000 }).then(async () => {
      const message = (await loginError.first().textContent())?.trim() ?? 'Login failed';
      throw new Error(
        `Login failed: ${message}. Check VITE_API_URL on Vercel is https://api.cullinos.com/api/v1`,
      );
    }),
  ]);
}

export async function assertNoErrorBanner(page: Page): Promise<void> {
  const errorBanner = page.locator('[class*="status-error"]').filter({ hasText: /failed|error|invalid/i });
  await expect(errorBanner).toHaveCount(0);
}
