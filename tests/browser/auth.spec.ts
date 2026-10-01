import { test, expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';

test('the lazy Privy module loads in a real browser with patched dependencies', async ({
  page,
}) => {
  const assets = await readdir(new URL('../../apps/web/dist/assets/', import.meta.url));
  const entry = assets.find((name) => /^privy-login-.*\.js$/.test(name));
  expect(entry).toBeTruthy();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/login');
  const component = await page.evaluate(async (path) => {
    const module = await import(path);
    return Object.values(module).some(
      (value) =>
        value &&
        typeof value === 'object' &&
        'default' in value &&
        typeof value.default === 'function',
    );
  }, `/assets/${entry}`);
  expect(component).toBe(true);
  expect(errors).toEqual([]);
});

test('public email sign-in is mobile friendly and has no API-key sign-in controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in to Kora' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with email' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('Email sign-in is coming soon');
  await expect(page.getByLabel('Sandbox API key')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /API key/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.sandbox/screenshots/login-mobile.png', fullPage: true });
});
test('private invitation opens the email login flow and removes its token from the address bar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/login#invite=kora_inv_${'a'.repeat(64)}`);
  await expect(page.getByRole('heading', { name: 'Join a Kora workspace.' })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Continue with email' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('protected workspace paths show email login without creating a session', async ({ page }) => {
  await page.goto('/app/account');
  await expect(page.getByRole('heading', { name: 'Sign in to Kora' })).toBeVisible();
  expect((await page.context().cookies()).some((c) => c.name === 'kora_console')).toBe(false);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  await page.getByRole('button', { name: 'Start a sandbox', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make your first move.' })).toBeVisible();
  await expect(page.getByLabel('Sandbox API key')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect workspace' })).toHaveCount(0);
});
test('login availability failures can be retried without offering API-key sign-in', async ({
  page,
}) => {
  await page.route('**/console/auth/config', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/login');
  await expect(page.getByRole('alert')).toContainText('temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Continue with email' })).toBeDisabled();
  await page.unroute('**/console/auth/config');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Email sign-in is coming soon');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('guest workspace saving is explicit and unavailable email never replaces the guest session', async ({
  page,
}) => {
  await page.goto('/connect');
  await page.getByLabel('Workspace name').fill('Keep this sandbox');
  await page.getByRole('button', { name: 'Start sandbox', exact: true }).click();
  await expect(page.locator('.workspace-switch')).toContainText('Keep this sandbox');
  const before = (await page.context().cookies()).find((c) => c.name === 'kora_console')?.value;
  await page.getByRole('button', { name: 'Account & access', exact: true }).click();
  await expect(page.locator('.account-card')).toContainText('Sandbox guest');
  await page.getByRole('button', { name: 'Save workspace with email' }).click();
  await expect(page.getByRole('heading', { name: 'Keep your workspace.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with email' })).toBeDisabled();
  await page.getByRole('button', { name: 'Back to workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account & access', exact: true })).toBeVisible();
  expect((await page.context().cookies()).find((c) => c.name === 'kora_console')?.value).toBe(
    before,
  );
  await page.reload();
  await expect(page.locator('.workspace-switch')).toContainText('Keep this sandbox');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Kora' })).toBeVisible();
  await page.goto('/app/account');
  await expect(page.getByRole('heading', { name: 'Sign in to Kora' })).toBeVisible();
});
