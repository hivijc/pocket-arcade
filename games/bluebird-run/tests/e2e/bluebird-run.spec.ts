import { expect, test } from '@playwright/test';
import './hook';

test('rides Pinecone Bowl: start, carve, ollie, pause', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/games/bluebird-run/');
  await expect(page.locator('.overlay.title.on')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bluebird Run' })).toBeVisible();
  await expect(page.getByRole('link', { name: '← Pocket Arcade' })).toBeVisible();
  await page.screenshot({ path: 'test-results/bluebird-title.png' });

  await page.keyboard.press('Enter');
  await expect(page.locator('.overlay.title.on')).toBeHidden();
  await page.waitForFunction(() => window.__bluebird.getState().phase === 'riding', undefined, { timeout: 6000 });

  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__bluebird.getState().board.heading > 20);
  await page.keyboard.up('ArrowRight');

  await page.keyboard.press('Space');
  await page.waitForFunction(() => window.__bluebird.getState().board.air !== null);

  await expect(page.locator('[data-stat="score"]')).toHaveText(/^\d+$/);
  const t0 = await page.locator('[data-stat="time"]').textContent();
  await page.waitForTimeout(500);
  await expect(page.locator('[data-stat="time"]')).not.toHaveText(t0 ?? '');

  await page.keyboard.press('Escape');
  await expect(page.locator('.overlay.pause.on')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.overlay.pause.on')).toBeHidden();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/bluebird-riding.png' });
  expect(errors).toEqual([]);
});
