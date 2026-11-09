import { devices, expect, test, type Page } from '@playwright/test';
import './hook';

// iPhone 13 screen, touch and mobile UA; Chromium so real touches can be sent through CDP.
test.use({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });

type Point = readonly [number, number];

/** Real touch input (not synthetic DOM events), so touch-action, pointerType and capture all behave as on a phone. */
async function touchDrag(page: Page, from: Point, to: Point, beforeRelease?: () => Promise<void>): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', [x, y]: Point) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', from);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', [from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps]);
  }
  await beforeRelease?.();
  await touch('touchEnd', to);
}

async function startHole(page: Page): Promise<void> {
  await page.goto('/games/minigolf/');
  await page.getByRole('button', { name: 'Play' }).tap();
  await page.waitForFunction(() => window.__minigolf?.getState().phase.kind === 'aiming');
}

test('a drag-release slingshot putts on hole 1', async ({ page }) => {
  await startHole(page);
  const before = await page.evaluate(() => window.__minigolf.getState().ball);

  await touchDrag(page, [195, 420], [195 - 40, 420 + 70], async () => {
    expect(await page.evaluate(() => window.__minigolf.getState().phase.kind)).toBe('dragging');
    await expect(page.locator('.power.on')).toBeVisible();
  });

  await page.waitForFunction(() => window.__minigolf.getState().strokes[0] === 1);
  await page.waitForFunction(
    ([x, y]) => {
      const b = window.__minigolf.getState().ball;
      return Math.hypot(b.x - x, b.y - y) > 0.3;
    },
    [before.x, before.y] as const,
  );
});

test('dragging back into the dead zone cancels without a stroke', async ({ page }) => {
  await startHole(page);
  await touchDrag(page, [200, 400], [203, 402]);
  const s = await page.evaluate(() => window.__minigolf.getState());
  expect(s.phase.kind).toBe('aiming');
  expect(s.strokes[0]).toBe(0);
});

test('touch layout: canvas fills the width, no horizontal scroll, touch buttons shown', async ({ page }) => {
  await startHole(page);
  const box = await page.locator('#game').boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(388);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.getByRole('button', { name: /Retry/ }).tap();
  await page.waitForFunction(() => window.__minigolf.getState().strokes[0] === 1);
  await page.getByRole('button', { name: 'Pause' }).tap();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
});
