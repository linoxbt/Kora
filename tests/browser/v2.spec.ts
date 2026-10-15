import { test, expect } from '@playwright/test';

test('landing presents both Microsendr modes, routes prompts, and switches theme', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Money moves');
  await expect(page.locator('.public-header .logo')).toHaveText('microsendr');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.ms-hero-actions').getByRole('button', { name: 'Get started' }).click();
  await expect(page).toHaveURL(/\/personal\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByText('Sign-in is being set up. Please check back soon.')).toBeVisible();
  await page.goto('/');
  await page.locator('.ms-hero-actions').getByRole('button', { name: 'For business' }).click();
  await expect(page).toHaveURL(/\/business\/login$/);
  await expect(page.getByText('Sign-in is being set up. Please check back soon.')).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Read the docs' }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open developer sandbox' }).click();
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

test('default theme uses a cream canvas across Microsendr modes', async ({ page }) => {
  for (const [path, surface] of [['/', '.ms-site'], ['/personal/login', '.personal-auth'], ['/business/login', '.personal-auth']]) {
    await page.goto(path);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(247, 243, 233)');
    await expect(page.locator(surface)).toHaveCSS('background-color', 'rgb(247, 243, 233)');
  }
  await page.goto('/');
  await expect(page.locator('.ms-button').first()).toHaveCSS('background-color', 'rgb(70, 130, 180)');
});
