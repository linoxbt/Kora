import { test, expect, type BrowserContext } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
async function login(context: BrowserContext, actor: 'requester' | 'reviewer') {
  const f = JSON.parse(await readFile('.sandbox/controls-browser-credentials.json', 'utf8'));
  const r = await context.request.post('/console/session', {
    headers: { origin: 'http://127.0.0.1:4310' },
    data: { api_key: f[actor].secret },
  });
  expect(r.status()).toBe(200);
}
test('enrolled operators request and independently approve capped staging through the console', async ({
  context,
  page,
}) => {
  await login(context, 'requester');
  await page.goto('/app/controls');
  await expect(page.getByRole('heading', { name: 'Pilot controls', exact: true })).toBeVisible();
  await page.getByLabel('Review reason', { exact: true }).fill('Browser capped rehearsal');
  await page.getByRole('button', { name: 'Request approval', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Control action recorded');
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await context.clearCookies();
  await login(context, 'reviewer');
  await page.reload();
  await page.getByLabel('Review reason', { exact: true }).fill('Independent browser review');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'staging active', exact: true })).toBeVisible();
  await page.getByLabel('Incident reason').fill('Browser incident rehearsal');
  await page.getByRole('button', { name: 'Pause new payments', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'paused', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Run daily controls' }).click();
  await expect(page.locator('.control-record').first()).toContainText('Controls clean');
  await expect(page.locator('.control-record').first()).toContainText(
    new Date().toISOString().slice(0, 10),
  );
  await expect(page.locator('.controls-summary')).toContainText(
    'Provider cash reconciliation pending',
  );
  await mkdir('.sandbox/screenshots', { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '.sandbox/screenshots/controls.png', fullPage: true });
  await page.getByRole('tab', { name: 'Audit', exact: true }).click();
  await expect(page.getByText('emergency pause', { exact: true })).toBeVisible();
});
test('controls remain readable on mobile without horizontal overflow', async ({
  context,
  page,
}) => {
  await login(context, 'reviewer');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/controls');
  await expect(page.getByRole('heading', { name: 'Pilot controls', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Evidence', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Record a staging review' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.sandbox/screenshots/controls-mobile.png', fullPage: true });
});
