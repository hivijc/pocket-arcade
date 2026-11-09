import { expect, test } from '@playwright/test';
import { SOLUTIONS } from '../fixtures/solutions';
import './hook';

test('hole 1 can be played into the cup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.waitForFunction(() => window.__minigolf?.getState().phase.kind === 'aiming');

  const line = SOLUTIONS['Gnome Alley'];
  for (const [deg, power] of line) {
    await page.evaluate(([a, p]) => window.__minigolf.putt(a, p), [(deg * Math.PI) / 180, power] as const);
    await page.waitForFunction(
      () => ['aiming', 'holed'].includes(window.__minigolf.getState().phase.kind),
      undefined,
      { timeout: 15_000 },
    );
  }

  expect(await page.evaluate(() => window.__minigolf.getState().phase.kind)).toBe('holed');
  expect(await page.evaluate(() => window.__minigolf.getState().strokes[0])).toBe(line.length);
  await expect(page.getByTestId('popup')).toBeVisible();
});

test('shows the title card with no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Backyard' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('desktop shows no touch buttons and keeps whole-pixel scaling', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
  const width = await page.locator('#game').evaluate((c) => parseFloat((c as HTMLElement).style.width));
  expect(width % 360).toBe(0);
});
