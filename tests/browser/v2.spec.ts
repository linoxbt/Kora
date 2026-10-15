import { test, expect } from '@playwright/test';

test('landing presents both Microsendr modes and routes prompts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Money moves');
  await expect(page.locator('.public-header .logo')).toHaveText('microsendr');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toHaveCount(0);
  await expect(page.locator('.ms-hero-visual img')).toBeVisible();
  await page.locator('.ms-hero-actions').getByRole('button', { name: 'Get started' }).click();
  await expect(page).toHaveURL(/\/personal\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('Sign-in is being set up. Please check back soon.')).toBeVisible();
  await page.goto('/');
  await page.locator('.ms-hero-actions').getByRole('button', { name: 'For business' }).click();
  await expect(page).toHaveURL(/\/business$/);
  await expect(page.getByRole('heading', { name: 'Tell us about your business.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toHaveCount(0);
  await page.goto('/');
  await page.getByRole('button', { name: 'Read the docs' }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open developer sandbox' }).click();
  await expect(page).toHaveURL(/\/connect$/);
});

test('phone pages fit without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/personal/login', '/business', '/business/login', '/docs']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test('default theme uses a cream canvas across Microsendr modes', async ({ page }) => {
  for (const [path, surface] of [['/', '.ms-site'], ['/personal/login', '.personal-auth'], ['/business', '.ms-site'], ['/business/login', '.personal-auth']]) {
    await page.goto(path);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(247, 243, 233)');
    await expect(page.locator(surface)).toHaveCSS('background-color', 'rgb(247, 243, 233)');
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Money moves with you.' })).toBeVisible();
  await expect(page.locator('.ms-button').first()).toHaveCSS('background-color', 'rgb(70, 130, 180)');
  await page.evaluate(() => localStorage.setItem('microsendr-theme', 'dark'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('business call request collects details for Netlify Forms', async ({ page }) => {
  await page.goto('/business');
  let body = '';
  await page.route('**/', async route => {
    if (route.request().method() !== 'POST') return route.continue();
    body = route.request().postData() ?? '';
    await route.fulfill({ status: 200, body: 'OK' });
  });
  await page.getByLabel('Your name').fill('Ada Example');
  await page.getByLabel('Work email').fill('ada@example.com');
  await page.getByLabel('Company').fill('Example Trading');
  await page.getByLabel('What would you like to discuss?').selectOption('payments');
  await page.getByLabel('Tell us a little more').fill('Discuss NGN settlement sandbox');
  await page.locator('form[name="business-call"]').getByRole('button', { name: 'Request a call' }).click();
  await expect(page.getByRole('heading', { name: 'Request received.' })).toBeVisible();
  const fields = new URLSearchParams(body);
  expect(fields.get('form-name')).toBe('business-call');
  expect(fields.get('email')).toBe('ada@example.com');
  expect(fields.get('company')).toBe('Example Trading');
});
