import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
test.beforeEach(async ({ page, context }) => {
  const result = await context.request.post('http://127.0.0.1:4310/console/workspaces', {
    headers: { origin: 'http://127.0.0.1:4310' },
    data: { name: 'Local rail browser' },
  });
  expect(result.status(), await result.text()).toBe(200);
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.goto('/app/rail');
  await expect(page.getByText('Test mode ready', { exact: true })).toBeVisible();
});
async function account(page: Page) {
  await page.getByRole('tab', { name: 'Bank accounts', exact: true }).click();
  await page.getByLabel('Account number').fill('0001234567');
  await page.getByRole('button', { name: 'Resolve account name' }).click();
  await expect(page.getByText('KORA TEST BENEFICIARY', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add verified account' }).click();
  await expect(page.getByText('Verified bank account added.', { exact: true })).toBeVisible();
}
test('name enquiry and bank payout settle through the real API and ledger', async ({ page }) => {
  await account(page);
  await page.getByRole('tab', { name: 'Bank payout', exact: true }).click();
  await page.getByLabel('Source amount (NGN)').fill('1000');
  await page.getByLabel('Payment reference').fill('Browser domestic payout');
  await expect(page.locator('.rail-summary')).toContainText('₦995.00');
  await page.getByRole('button', { name: 'Queue bank payout' }).click();
  await expect(page.getByRole('dialog')).toContainText('Browser domestic payout');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Transactions', exact: true }).click();
  await page.getByLabel('Search transactions').fill('Browser domestic payout');
  await expect(page.locator('tbody')).toContainText('Completed');
  await mkdir('.sandbox/screenshots', { recursive: true });
  await page.goto('/app/rail');
  await page.screenshot({ path: '.sandbox/screenshots/local-rail.png', fullPage: true });
});
test('collection checkout verifies a signed callback and reconciles the provider snapshot', async ({
  page,
  request,
}) => {
  await page.getByRole('tab', { name: 'Collections', exact: true }).click();
  await page.getByLabel('Amount (NGN)').fill('1000');
  await page.getByLabel('Payer email').fill('browser@example.test');
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/v1/collections') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create checkout' }).click();
  const col = await (await created).json();
  await expect(page.getByRole('link', { name: 'Open checkout' })).toBeVisible();
  const callback = await request.post('http://127.0.0.1:4312/complete', {
    data: { reference: col.provider_reference },
  });
  expect(callback.status()).toBe(200);
  await expect(page.locator('tbody')).toContainText('succeeded');
  await expect(page.locator('tbody')).toContainText('₦999.00');
  await page.getByRole('tab', { name: 'Controls & statements' }).click();
  await page.getByRole('button', { name: 'Reconcile snapshot' }).click();
  await expect(page.locator('tbody')).toContainText('review');
  await page.getByRole('button', { name: 'Inspect', exact: true }).first().click();
  await expect(page.locator('.rail-info').last()).toContainText('actual ₦999.00');
});
test('operator holds block payouts until a reasoned approval and rail layout fits mobile', async ({
  page,
}) => {
  await account(page);
  await page.getByRole('tab', { name: 'Controls & statements' }).click();
  await page.getByLabel('Decision reason').fill('Browser control review');
  await page.getByRole('button', { name: 'Place hold', exact: true }).click();
  await expect(
    page.getByText('Customer held. Unsent payouts are blocked.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Bank payout', exact: true }).click();
  await page.getByLabel('Source amount (NGN)').fill('100');
  await expect(page.getByRole('button', { name: 'Queue bank payout' })).toBeDisabled();
  await page.getByRole('tab', { name: 'Controls & statements' }).click();
  await page.getByRole('button', { name: 'Record approval' }).click();
  await expect(page.getByText('Sandbox approval recorded.', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Bank payout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Queue bank payout' })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '.sandbox/screenshots/local-rail-mobile.png', fullPage: true });
});
