import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
test.beforeEach(async ({ page, context }) => {
  const r = await context.request.post('http://127.0.0.1:4310/console/workspaces', {
    headers: { origin: 'http://127.0.0.1:4310' },
    data: { name: 'Stellar browser' },
  });
  expect(r.status()).toBe(200);
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/app/stellar');
  await expect(page.getByRole('heading', { name: 'Stellar Testnet', exact: true })).toBeVisible();
  await expect(page.getByText('Issuer', { exact: false })).toBeVisible();
});
async function wallet(page: Page, request: APIRequestContext) {
  const r = await request.post('http://127.0.0.1:4312/wallet', { data: {} }),
    { address } = await r.json();
  await page.getByRole('tab', { name: 'Verify wallet' }).click();
  await page.getByLabel('Stellar G address').fill(address);
  const challenge = page.waitForResponse((r) => r.url().includes('/stellar_challenge?'));
  await page.getByRole('button', { name: 'Get ownership challenge' }).click();
  const body = await (await challenge).json();
  const signed = await request.post('http://127.0.0.1:4312/sign', {
    data: { address, challenge: body.challenge_hex },
  });
  await page.getByLabel('Signature (hex)').fill((await signed.json()).signature);
  await page.getByRole('button', { name: 'Verify wallet', exact: true }).click();
  await expect(page.getByText(/Wallet verified/)).toBeVisible();
  return address;
}
test('wallet proof and Testnet purchase settle with hash, sequence and XLM fee journal', async ({
  page,
  request,
}) => {
  await wallet(page, request);
  await page.getByRole('tab', { name: 'Buy KUSD' }).click();
  await page.getByLabel('Total NGN amount').fill('1600');
  const created = page.waitForResponse(
    (r) => r.url().endsWith('/v1/stellar/purchases') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Buy KUSD', exact: true }).click();
  const purchase = await (await created).json();
  await expect(page.getByRole('dialog')).toContainText('KUSD');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Transactions', exact: true }).click();
  await page.getByLabel('Search transactions').fill('Testnet purchase');
  await expect(page.locator('tbody')).toContainText('Completed');
  await page.getByRole('button', { name: 'Operations', exact: true }).click();
  await page.getByLabel('Payment intent ID').fill(purchase.id);
  await page.getByRole('button', { name: 'Inspect payment', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Stellar Testnet transaction');
  await expect(page.getByRole('dialog')).toContainText('XLM');
});
test('verified deposit and fixture redemption display actual ledger evidence on desktop and mobile', async ({
  page,
  request,
}) => {
  const address = await wallet(page, request);
  const r = await request.post('http://127.0.0.1:4312/deposit', { data: { address } }),
    { hash } = await r.json();
  await page.getByRole('tab', { name: 'Verify deposit' }).click();
  await page.getByLabel('Transaction hash').fill(hash);
  await page.getByRole('button', { name: 'Verify and credit' }).click();
  await expect(page.getByText(/Deposit verified/)).toBeVisible();
  await expect(page.getByText(/1.0000000 KUSD/)).toBeVisible();
  await page.getByRole('tab', { name: 'Redeem to NGN' }).click();
  await page.getByLabel('KUSD amount').fill('1');
  await page.getByRole('button', { name: 'Redeem at fixture rate' }).click();
  await expect(page.getByText(/NGN fixture balance credited/)).toBeVisible();
  await expect(page.getByText(/₦1,600 credited/)).toBeVisible();
  await mkdir('.sandbox/screenshots', { recursive: true });
  await page.screenshot({ path: '.sandbox/screenshots/stellar.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.sandbox/screenshots/stellar-mobile.png', fullPage: true });
});
