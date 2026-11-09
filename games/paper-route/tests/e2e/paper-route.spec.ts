import { expect, test } from '@playwright/test';

test('starts a run and tosses a paper', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/games/paper-route/');
  await expect(page.locator('.overlay.title.on')).toBeVisible();
  await page.screenshot({ path: 'test-results/paper-route-title.png' });
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-stat="papers"]')).toHaveText('10');
  await page.keyboard.press('KeyK');
  await expect(page.locator('[data-stat="papers"]')).toHaveText('9');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/paper-route-riding.png' });
  expect(errors).toEqual([]);
});
