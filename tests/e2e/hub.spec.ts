import { expect, test } from '@playwright/test';

test('the hub shows both game cards and each Play link reaches its title screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Pocket Arcade' })).toBeVisible();
  const cards = page.getByRole('list', { name: 'Games' }).getByRole('listitem');
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Backyard Mini-Golf' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Paper Route' })).toBeVisible();
  for (const img of await page.locator('img.thumb').all()) {
    expect(await img.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(320);
  }

  await page.getByRole('link', { name: 'Play Backyard Mini-Golf' }).click();
  await expect(page).toHaveURL(/\/games\/minigolf\/$/);
  await expect(page.getByRole('heading', { name: 'Backyard' })).toBeVisible();
  await page.getByRole('link', { name: '← Pocket Arcade' }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.getByRole('link', { name: 'Play Paper Route' }).click();
  await expect(page).toHaveURL(/\/games\/paper-route\/$/);
  await expect(page.locator('.overlay.title.on')).toBeVisible();
  await expect(page.getByRole('link', { name: '← Pocket Arcade' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('the hub fits a 375 px phone with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});
