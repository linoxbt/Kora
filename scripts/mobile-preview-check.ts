import 'dotenv/config';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const host = process.env.KORA_PREVIEW_HOST;
if (!host || !/^[a-z0-9.-]+\.trycloudflare\.com$/.test(host))
  throw new Error('Set the exact KORA_PREVIEW_HOST for the temporary phone preview');
const origin = `https://${host}`;
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (e) => {
    throw e;
  });
  await mkdir('.sandbox/screenshots', { recursive: true });
  await page.goto(`${origin}/login`);
  await expect(page.getByRole('heading', { name: 'Sign in to Kora', exact: true })).toBeVisible();
  const authConfig = await (await context.request.get(`${origin}/console/auth/config`)).json();
  if (authConfig.enabled)
    await expect(page.getByLabel('Email address')).toBeEnabled();
  else
    await expect(page.getByRole('status')).toContainText('Email sign-in is coming soon');
  await expect(page.getByLabel('Sandbox API key')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /API key/i })).toHaveCount(0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '.sandbox/screenshots/login-public-mobile.png', fullPage: true });
  await page.goto(`${origin}/connect`);
  await page.getByLabel('Workspace name').fill('Nigeria mobile preview');
  await page.getByRole('button', { name: 'Start sandbox', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Let your money move.', exact: true }),
  ).toBeVisible({ timeout: 60000 });
  const cookie = (await context.cookies()).find((c) => c.name === 'kora_console');
  assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Strict');
  await page.goto(`${origin}/app/network`);
  await expect(page.getByRole('heading', { name: 'The Kora network', exact: true })).toBeVisible();
  await page.getByLabel('New sandbox recipient').fill('Mobile Nigeria recipient');
  await page.getByRole('button', { name: 'Add sandbox recipient', exact: true }).click();
  await expect(page.getByLabel('Sandbox bank account')).not.toHaveValue('', { timeout: 30000 });
  await page.getByLabel('Health reason').fill('Public mobile sandbox outage');
  await page.getByRole('button', { name: 'Record sandbox health', exact: true }).click();
  await expect(page.locator('[data-corridor="ng-ng-sandbox"]')).toContainText('Blocked');
  await expect(page.getByLabel('Route preference')).toHaveValue('auto');
  await page.getByLabel('Sandbox scenario').selectOption('timeout');
  await page.getByRole('button', { name: 'Get route quote' }).click();
  await expect(page.getByRole('heading', { name: 'Frozen quote' })).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.network-quote')).toContainText('ng-ng-alternate');
  await page.getByRole('button', { name: 'Start sandbox route', exact: true }).click();
  await expect(page.locator('.network-legs').getByText('Confirmed', { exact: true })).toHaveCount(
    3,
    { timeout: 60000 },
  );
  await expect(page.locator('.network-workspace')).toContainText('consumed');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  for (const path of [
    '/.env',
    '/@fs/root/Kora/.env',
    '/@fs/root/Kora/.sandbox/phase6-credentials.json',
  ]) {
    const response = await context.request.get(`${origin}${path}`);
    assert.ok([403, 404].includes(response.status()), `Private path must be blocked: ${path}`);
  }
  await mkdir('.sandbox/screenshots', { recursive: true });
  await page.screenshot({ path: '.sandbox/screenshots/routing-public-mobile.png', fullPage: true });
  console.log(
    JSON.stringify({
      origin,
      login_page: 'email_only',
      mobile_route: 'succeeded',
      selected_corridor: 'ng-ng-alternate',
      confirmed_simulated_legs: 3,
      secure_cookie: true,
      private_files_blocked: true,
      horizontal_overflow: false,
    }),
  );
  await context.close();
} finally {
  await browser.close();
}
