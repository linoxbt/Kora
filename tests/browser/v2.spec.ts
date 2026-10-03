import { test, expect } from '@playwright/test';

test('landing presents both Kora modes, routes prompts, and switches theme', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Move value.');
  await expect(page.locator('.public-header .logo')).toHaveText('kora');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.locator('.site-hero-actions').getByRole('button', { name: 'Explore Personal' }).click();
  await expect(page).toHaveURL(/\/personal\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Kora' })).toBeVisible();
  await page.goto('/');
  await page.locator('.site-hero-actions').getByRole('button', { name: 'Explore Business' }).click();
  await expect(page).toHaveURL(/\/business\/login$/);
  await page.goto('/');
  await page.getByRole('button', { name: /POST \/v1\/intents/ }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await page.goto('/');
  await page.getByRole('button', { name: /Start with the Nigerian developer sandbox/ }).click();
  await expect(page).toHaveURL(/\/connect$/);
});

test('phone pages fit without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/', '/personal/login', '/business/login']) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
