import { test, expect, type BrowserContext } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
let state: Awaited<ReturnType<BrowserContext['storageState']>>;
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const result = await context.request.post('http://127.0.0.1:4310/console/workspaces', {
    headers: { origin: 'http://127.0.0.1:4310' },
    data: { name: 'Browser sandbox' },
  });
  expect(result.status(), await result.text()).toBe(200);
  state = await context.storageState();
  await context.close();
  await mkdir('.sandbox/screenshots', { recursive: true });
});
test.beforeEach(async ({ context, page }) => {
  await context.addCookies(state.cookies);
  page.on('pageerror', (error) => {
    throw error;
  });
});
test('public landing and generated API guide render', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Money moves with you.' })).toBeVisible();
  await expect(page.getByText('Sandbox preview · Funds and providers are simulated')).toBeVisible();
  await page.screenshot({ path: '.sandbox/screenshots/landing.png', fullPage: true });
  await page.getByRole('button', { name: 'Read the docs' }).click();
  await expect(page.locator('.endpoint-list')).toContainText('/v1/intents');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open developer sandbox' }).click();
  await expect(page).toHaveURL(/\/app\/overview$/);
  await page.goto('/');
  await page.getByRole('link', { name: 'How it works' }).first().click();
  await expect(page.getByRole('heading', { name: 'Every move, in view.' })).toBeInViewport();
  await page.getByRole('banner').getByRole('button', { name: 'Developers', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'One API. A connected continent.' }),
  ).toBeVisible();
  await expect(page.locator('.endpoint-list')).toContainText('/v1/intents');
});
test('landing page stays readable and actionable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Money moves with you.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#platform').getByRole('button', { name: 'Explore Personal' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to Personal.' })).toBeVisible();
  await page.screenshot({ path: '.sandbox/screenshots/landing-mobile.png', fullPage: true });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open developer sandbox' }).click();
  await expect(page).toHaveURL(/\/app\/overview$/);
});
test('browser onboarding creates an isolated session and sign-out removes access', async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto('/connect');
  await expect(page.getByRole('heading', { name: 'Make your first move.' })).toBeVisible();
  await page.screenshot({ path: '.sandbox/screenshots/connect.png', fullPage: true });
  await page.getByLabel('Workspace name').fill('Browser onboarding');
  await page.getByRole('button', { name: 'Start sandbox' }).click();
  await expect(page.getByRole('heading', { name: 'Let your money move.' })).toBeVisible();
  await expect(page.locator('.workspace-switch')).toContainText('Browser onboarding');
  const cookie = (await context.cookies()).find((c) => c.name === 'kora_console');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Strict');
  expect(await page.evaluate(() => [localStorage.getItem('microsendr-theme'), sessionStorage.length])).toEqual(['light', 0]);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await page.goto('/app/overview');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});
test('overview shows real ledger balances and sandbox transaction states', async ({ page }) => {
  await page.goto('/app/overview');
  await expect(page.getByRole('heading', { name: 'Let your money move.' })).toBeVisible();
  await expect(page.locator('.metrics')).toContainText('5 completed transactions');
  await expect(page.locator('.transactions')).toContainText('Needs review');
  await expect(page.locator('.balances-strip')).toContainText('USDC balance');
  await expect(page.locator('.metric').first().locator('h2')).not.toHaveText('—');
  await page.screenshot({ path: '.sandbox/screenshots/overview.png', fullPage: true });
  expect(await page.evaluate(() => [localStorage.getItem('microsendr-theme'), sessionStorage.length])).toEqual(['light', 0]);
});
test('business transfer gets a quote, settles and appears in filtered transactions', async ({
  page,
}) => {
  await page.goto('/app/transactions');
  await page.getByRole('button', { name: 'New transfer' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Recipient name').fill('Browser recipient');
  await dialog.getByLabel('Payment reference').fill('Browser payment 1043');
  await dialog.getByRole('button', { name: 'Review transfer' }).click();
  await expect(dialog).toContainText('Total reserved');
  await expect(dialog).toContainText('16,000.00 NGN');
  await dialog.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(dialog.getByRole('heading', { name: 'Transfer completed' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Back to workspace' }).click();
  await page.getByLabel('Search transactions').fill('Browser payment 1043');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('Completed');
  await page.getByRole('button', { name: 'Browser payment 1043' }).click();
  await expect(page.getByRole('dialog')).toContainText('succeeded');
  await page.getByRole('button', { name: 'Close dialog' }).click();
});
test('expired quotes can be renewed and a lost intent response retries with the same key', async ({
  page,
}) => {
  let quotes = 0,
    intents = 0;
  const keys: string[] = [];
  await page.route('**/v1/quotes', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    quotes++;
    if (quotes === 1) json.expires_at = new Date(Date.now() - 1000).toISOString();
    await route.fulfill({ response, json });
  });
  await page.route('**/v1/intents', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    keys.push(route.request().headers()['idempotency-key']);
    const response = await route.fetch();
    intents++;
    if (intents === 1)
      await route.fulfill({
        status: 503,
        json: { error: { code: 'ack_lost', message: 'Simulated lost response' } },
      });
    else await route.fulfill({ response });
  });
  await page.goto('/app/transactions');
  await page.getByRole('button', { name: 'New transfer' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Recipient name').fill('Retry recipient');
  await dialog.getByLabel('Payment reference').fill('Browser retry payment');
  await dialog.getByRole('button', { name: 'Review transfer' }).click();
  await expect(dialog.getByRole('button', { name: 'Quote expired', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Get a new quote' }).click();
  await dialog.getByRole('button', { name: 'Review transfer' }).click();
  await dialog.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Simulated lost response');
  await expect(dialog.getByRole('button', { name: 'Edit transfer' })).not.toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(dialog.getByRole('heading', { name: 'Transfer completed' })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await dialog.getByRole('button', { name: 'Back to workspace' }).click();
  await page.getByLabel('Search transactions').fill('Browser retry payment');
  await expect(page.locator('tbody tr')).toHaveCount(1);
});
test('hosted flow converts simulated USDC into local currency', async ({ page }) => {
  await page.goto('/ramp');
  await expect(page.getByLabel('You send')).toHaveValue('USDC');
  await page.getByLabel('You send').selectOption('NGN');
  await expect(page.getByLabel('Recipient gets')).toHaveValue('USDC');
  await expect(page.getByLabel('Recipient gets').locator('option')).toHaveCount(1);
  await page.getByLabel('You send').selectOption('USDC');
  await page.getByLabel('Recipient name').fill('Hosted recipient');
  await page.getByLabel('Payment reference').fill('Hosted conversion');
  await page.getByRole('button', { name: 'Review transfer' }).click();
  await expect(page.locator('.quote-amount')).toContainText('39,800.00');
  await page.screenshot({ path: '.sandbox/screenshots/hosted.png', fullPage: true });
  await page.getByRole('button', { name: 'Confirm transfer' }).click();
  await expect(page.getByRole('heading', { name: 'Transfer completed' })).toBeVisible();
});
test('operations recovers ambiguous evidence and shows capture and settlement journals', async ({
  page,
}) => {
  await page.goto('/app/operations');
  const item = page.locator('.key-row').filter({ hasText: 'Acknowledgement recovery' }).first();
  await item.getByRole('button', { name: 'Inspect' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('0 verified receipts');
  await dialog.getByRole('button', { name: 'Recover provider status' }).click();
  await expect(dialog).toContainText('1 verified receipts');
  await expect(dialog).toContainText('captured');
  await expect(dialog).toContainText('destination:');
  await page.screenshot({ path: '.sandbox/screenshots/operations.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
test('developer creates and revokes a limited key, registers a webhook, replays an event and inspects redacted logs', async ({
  page,
}) => {
  await page.goto('/app/developers');
  await page.getByLabel('Key name').fill('Browser reader');
  await page.getByRole('button', { name: 'Create key' }).click();
  await expect(page.locator('.secret-panel')).toContainText('kora_test_');
  await page.getByRole('button', { name: 'I’ve saved it' }).click();
  const row = page.locator('.key-row').filter({ hasText: 'Browser reader' });
  await row.getByRole('button', { name: 'Revoke' }).click();
  await expect(row).toContainText('Revoked', { ignoreCase: true });
  await page.getByRole('button', { name: 'Webhooks', exact: true }).click();
  await page.getByRole('button', { name: 'Add endpoint' }).click();
  await expect(page.locator('.secret-panel')).toBeVisible();
  await page.getByRole('button', { name: 'I’ve saved it' }).click();
  await page.getByRole('button', { name: 'Events & deliveries' }).click();
  await page.getByRole('button', { name: 'Replay', exact: false }).first().click();
  await expect(page.getByRole('alert')).toContainText('Replay queued for 1');
  await page.getByRole('button', { name: 'Request logs', exact: true }).click();
  await expect(page.locator('tbody')).toContainText('/v1/api_keys');
  await expect(page.locator('tbody')).not.toContainText('kora_test_');
});
test('customer instruments and mobile navigation work without horizontal overflow', async ({
  page,
}) => {
  await page.goto('/app/customers');
  await page.getByLabel('Customer name').fill('Mobile customer');
  await page.getByRole('button', { name: 'Add customer' }).click();
  const row = page.locator('tr').filter({ hasText: 'Mobile customer' });
  await row.getByRole('button', { name: 'Instruments' }).click();
  await page.getByLabel('Instrument label').fill('Mobile sandbox account');
  await page.getByRole('button', { name: 'Add instrument' }).click();
  await expect(page.getByRole('dialog')).toContainText('Mobile sandbox account');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/overview');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Balances', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assets & balances' })).toBeVisible();
  await expect(page.locator('.asset-card')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.sandbox/screenshots/mobile.png', fullPage: true });
});

test('unconfigured local rail shows its setup gate and keeps payment actions disabled', async ({
  page,
}) => {
  await page.goto('/app/rail');
  await expect(page.getByRole('heading', { name: 'Local rail', exact: true })).toBeVisible();
  await expect(page.getByText('Awaiting a Paystack test key', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Queue bank payout' })).toBeDisabled();
  await page.getByRole('tab', { name: 'Collections', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create checkout' })).toBeDisabled();
});
