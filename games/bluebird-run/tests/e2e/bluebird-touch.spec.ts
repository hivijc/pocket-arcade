import { devices, expect, test, type Page } from '@playwright/test';
import './hook';

type Point = readonly [number, number];

/** An iPhone's viewport, touch and user agent on Chromium: CDP touch needs it, and defaultBrowserType can't be set inside a describe. */
function chromiumPhone(name: 'iPhone 13' | 'iPhone 13 landscape') {
  const { defaultBrowserType: _webkit, ...phone } = devices[name];
  return phone;
}

/** Real touch input over CDP (not synthetic DOM events), so touch-action and pointerType behave as on a phone. */
async function touches(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', [x, y]: Point) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  return {
    // Sent together: awaiting between the two CDP calls takes ~200ms, which is slower than the game's 180ms tap window.
    tap: async (p: Point) => { await Promise.all([send('touchStart', p), send('touchEnd', p)]); },
    down: (p: Point) => send('touchStart', p),
    move: (p: Point) => send('touchMove', p),
    up: (p: Point) => send('touchEnd', p),
  };
}

/** A portrait touch row clear of the HUD buttons. */
const STEER_Y = 450;

const phase = (page: Page) => page.evaluate(() => window.__bluebird.getState().phase);

async function startRun(page: Page, at: Point): Promise<Awaited<ReturnType<typeof touches>>> {
  await page.goto('/games/bluebird-run/');
  await expect(page.locator('.overlay.title.on')).toBeVisible();
  await expect(page.getByText('Tap to ride', { exact: true })).toBeVisible();
  const t = await touches(page);
  await t.tap(at);
  await page.waitForFunction(() => window.__bluebird.getState().phase === 'riding', undefined, { timeout: 6000 });
  return t;
}

test.describe('iPhone portrait', () => {
  test.use(chromiumPhone('iPhone 13'));

  test('tap starts, drag carves, tap ollies', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const t = await startRun(page, [195, 600]);
    expect(await phase(page)).toBe('riding');

    // Away from the HUD buttons, which sit in the thumb zone at the bottom centre in portrait and own their own presses.
    await t.down([195, STEER_Y]);
    for (let i = 1; i <= 6; i++) await t.move([195 + i * 10, STEER_Y]);
    await page.waitForFunction(() => window.__bluebird.getState().board.heading > 20);
    await t.up([255, STEER_Y]);

    await page.waitForTimeout(300);
    await t.tap([195, STEER_Y]);
    await page.waitForFunction(() => window.__bluebird.getState().board.air !== null || window.__bluebird.getState().board.tumble > 0);
    await page.screenshot({ path: 'test-results/bluebird-portrait.png' });
    expect(errors).toEqual([]);
  });

  test('layout: canvas fills the width, nothing scrolls, Pause works', async ({ page }) => {
    await startRun(page, [195, 600]);
    const box = await page.locator('#game').boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(388);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
    await page.getByRole('button', { name: 'Pause' }).tap();
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
    await page.getByRole('button', { name: 'Resume' }).tap();
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeHidden();
    await page.getByRole('button', { name: 'Retry' }).tap();
    expect(await phase(page)).toBe('countdown');
  });
});

test.describe('iPhone landscape', () => {
  test.use(chromiumPhone('iPhone 13 landscape'));

  test('canvas fills the height with no scroll, and steering works', async ({ page }) => {
    const t = await startRun(page, [600, 200]);
    const box = await page.locator('#game').boundingBox();
    const vh = await page.evaluate(() => window.innerHeight);
    expect(box!.height).toBeGreaterThanOrEqual(vh - 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await t.down([400, 200]);
    for (let i = 1; i <= 6; i++) await t.move([400 - i * 10, 200]);
    await page.waitForFunction(() => window.__bluebird.getState().board.heading < -20);
    await t.up([340, 200]);
    await page.screenshot({ path: 'test-results/bluebird-landscape.png' });
  });
});
