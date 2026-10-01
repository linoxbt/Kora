import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
test.beforeEach(async ({ context, page }) => {
  const r = await context.request.post('/console/workspaces', {
    headers: { origin: 'http://127.0.0.1:4310' },
    data: { name: 'Nigeria network browser' },
  });
  expect(r.status(), await r.text()).toBe(200);
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/app/network');
  await expect(page.getByRole('heading', { name: 'The Kora network', exact: true })).toBeVisible();
});
async function recipient(page: import('@playwright/test').Page) {
  await page.getByLabel('New sandbox recipient').fill('Nigeria route recipient');
  await page.getByRole('button', { name: 'Add sandbox recipient', exact: true }).click();
  await expect(page.getByLabel('Network recipient')).not.toHaveValue('');
  await expect(page.getByLabel('Sandbox bank account')).not.toHaveValue('');
}
test('Nigeria route recovers delayed settlement and shows three saved receipts', async ({
  page,
}) => {
  await recipient(page);
  await page.getByLabel('Sandbox scenario').selectOption('timeout');
  await page.getByRole('button', { name: 'Get route quote' }).click();
  await expect(page.getByRole('heading', { name: 'Frozen quote' })).toBeVisible();
  await expect(page.locator('.network-quote')).toContainText('NGN 1592.00');
  await page.getByRole('button', { name: 'Start sandbox route', exact: true }).click();
  await expect(page.locator('.network-legs').getByText('Confirmed', { exact: true })).toHaveCount(
    3,
  );
  await expect(page.locator('.network-workspace')).toContainText('consumed');
  await expect(page.locator('.network-legs').getByText(/Receipt: sim_leg_/)).toHaveCount(3);
  await page.getByRole('button', { name: 'View transaction', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Completed');
});
test('rejected destination remains held and route is readable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await recipient(page);
  await page.getByLabel('Sandbox scenario').selectOption('insufficient_float');
  await page.getByRole('button', { name: 'Get route quote' }).click();
  await expect(page.getByRole('heading', { name: 'Frozen quote' })).toBeVisible();
  await page.getByRole('button', { name: 'Start sandbox route', exact: true }).click();
  await expect(
    page.getByText('The payout was rejected after earlier steps were accepted.', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.network-legs').getByText('Confirmed', { exact: true })).toHaveCount(
    2,
  );
  await expect(page.locator('.network-legs').getByText('rejected', { exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir('.sandbox/screenshots', { recursive: true });
  await page.screenshot({ path: '.sandbox/screenshots/network-mobile.png', fullPage: true });
});
test('lost submission response retries the frozen request and displays one transaction', async ({
  page,
}) => {
  await recipient(page);
  await page.getByRole('button', { name: 'Get route quote' }).click();
  await expect(page.getByRole('heading', { name: 'Frozen quote' })).toBeVisible();
  const requests: { key: string; body: string }[] = [];
  let first = true;
  await page.route('**/v1/network/intents', async (route) => {
    requests.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postData()!,
    });
    const response = await route.fetch();
    if (first) {
      first = false;
      await route.abort('failed');
    } else await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Start sandbox route', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry original request' })).toBeVisible();
  await expect(page.getByLabel('Amount in kobo')).toBeDisabled();
  await page.getByRole('button', { name: 'Retry original request' }).click();
  await expect(page.getByRole('button', { name: 'Retry original request' })).toHaveCount(0);
  await expect(page.locator('.network-legs').getByText('Confirmed', { exact: true })).toHaveCount(
    3,
  );
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
});
test('automatic routing avoids an unavailable primary and executes the alternate on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Health status').selectOption('unavailable');
  await page.getByLabel('Health reason').fill('Mobile unavailable-primary rehearsal');
  await page.getByRole('button', { name: 'Record sandbox health', exact: true }).click();
  await expect(page.locator('[data-corridor="ng-ng-sandbox"]')).toContainText('Blocked');
  await expect(page.locator('[data-corridor="ng-ng-alternate"]')).toContainText('Eligible');
  await recipient(page);
  await expect(page.getByLabel('Route preference')).toHaveValue('auto');
  await page.getByRole('button', { name: 'Get route quote' }).click();
  await expect(page.locator('.network-quote')).toContainText('ng-ng-alternate');
  await page.getByRole('button', { name: 'Start sandbox route', exact: true }).click();
  await expect(page.locator('.network-legs').getByText('Confirmed', { exact: true })).toHaveCount(
    3,
  );
  await expect(page.locator('.network-workspace')).toContainText('consumed');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.sandbox/screenshots/routing-mobile.png', fullPage: true });
});
test('an outage after a frozen quote does not silently replace its provider or reserve money', async ({
  page,
}) => {
  await recipient(page);
  await page.getByRole('button', { name: 'Get route quote' }).click();
  await expect(page.locator('.network-quote')).toContainText('ng-ng-sandbox');
  // A second tab changes health, leaving this tab's quote frozen.
  const other = await page.context().newPage();
  await other.goto('/app/network');
  await other.getByLabel('Health reason').fill('Outage after quoting');
  await other.getByRole('button', { name: 'Record sandbox health', exact: true }).click();
  await expect(other.locator('[data-corridor="ng-ng-sandbox"]')).toContainText('Blocked');
  await page.getByRole('button', { name: 'Start sandbox route', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Frozen sandbox participant');
  await expect(page.locator('.network-workspace')).toContainText('Not reserved');
  await expect(page.locator('.network-quote')).toContainText('ng-ng-sandbox');
  await other.close();
});
