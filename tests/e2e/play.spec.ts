import { expect, test } from '@playwright/test';
import { SOLUTIONS } from '../fixtures/solutions';

interface Hook {
  getState(): { phase: { kind: string }; strokes: number[] };
  getCourse(): string;
  putt(angle: number, power: number): void;
}
declare global {
  interface Window { __minigolf: Hook }
}

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

test('Backyard is the default course and the HUD names it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('course-backyard')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('course')).toHaveText('Backyard');
});

test('the picker switches to Boardwalk and its first hole can be played', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  await page.getByTestId('course-boardwalk').click();
  await page.waitForFunction(() => window.__minigolf?.getCourse() === 'boardwalk');
  await expect(page.getByRole('heading', { name: 'Boardwalk' })).toBeVisible();
  await expect(page.getByTestId('course-boardwalk')).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForFunction(() => window.__minigolf.getState().phase.kind === 'aiming');
  await expect(page.getByTestId('course')).toHaveText('Boardwalk');

  const line = SOLUTIONS.Sandbar;
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
  expect(errors).toEqual([]);
});
