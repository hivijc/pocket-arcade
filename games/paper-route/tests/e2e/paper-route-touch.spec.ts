import { devices, expect, test, type Locator, type Page } from '@playwright/test';

// iPhone 13: touch, mobile UA and pointer: coarse. Chromium, so real touches can go through CDP.
test.use({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });

interface Snapshot {
  readonly phase: string;
  readonly papers: number;
  readonly throws: number;
  readonly c: number;
  readonly s: number;
  readonly speed: number;
}

type Point = readonly [number, number];

const snap = (page: Page): Promise<Snapshot> =>
  page.evaluate(() => {
    const s = (window as unknown as { __paperRoute: { getState(): { phase: string; papers: number; throws: number; bike: { c: number; s: number; speed: number } } } })
      .__paperRoute.getState();
    return { phase: s.phase, papers: s.papers, throws: s.throws, c: s.bike.c, s: s.bike.s, speed: s.bike.speed };
  });

/** A real touch drag (not synthetic DOM events), held at the end for `holdMs` before lifting. */
async function touchDrag(page: Page, from: Point, to: Point, holdMs: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', [x, y]: Point) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', from);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [from[0] + ((to[0] - from[0]) * i) / 6, from[1] + ((to[1] - from[1]) * i) / 6]);
  await page.waitForTimeout(holdMs);
  await touch('touchEnd', to);
}

async function startRide(page: Page): Promise<void> {
  await page.goto('/games/paper-route/');
  await expect(page.locator('.overlay.title.on')).toBeVisible();
  await expect(page.locator('.overlay.title .cta')).toHaveText('Tap to ride');
  await page.locator('.overlay.title.on').tap();
  await expect(page.getByRole('button', { name: 'Toss left' })).toBeVisible();
  expect((await snap(page)).phase).toBe('riding');
}

const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error('element is not visible');
  return b;
};
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function expectPhoneLayout(page: Page): Promise<void> {
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight);
  expect(fits).toBe(true);
  const parts = await Promise.all(['.arcade-back', '.bar.on', '.pause-btn', '.toss-left', '.toss-right'].map((s) => box(page.locator(s))));
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) expect(overlaps(parts[i], parts[j]), `parts ${i} and ${j}`).toBe(false);
  const canvas = await box(page.locator('#game'));
  for (const b of [parts[3], parts[4]]) expect(overlaps(canvas, b), 'toss button over the street').toBe(false);
}

test.describe('portrait 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('tap to ride, steer with the thumb stick, toss by tap', async ({ page }) => {
  await startRide(page);
  await expectPhoneLayout(page);

  await page.getByRole('button', { name: 'Toss left' }).tap();
  await expect(page.locator('[data-stat="papers"]')).toHaveText('9');
  expect((await snap(page)).throws).toBe(1);

  const before = await snap(page);
  await touchDrag(page, [90, 760], [150, 720], 500); // right and up: drift right, pedal faster
  const after = await snap(page);
  expect(after.c).toBeGreaterThan(before.c + 0.5);
  expect(after.speed).toBeGreaterThan(3.2);
  expect(after.s).toBeGreaterThan(before.s);

  await page.getByRole('button', { name: 'Toss right' }).tap();
  await expect(page.locator('[data-stat="papers"]')).toHaveText('8');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/paper-route-touch-portrait.png' });
  });
});

test('pause by button, resume by tapping the card', async ({ page }) => {
  await startRide(page);
  await page.getByRole('button', { name: 'Pause' }).tap();
  await expect(page.locator('.overlay.pause.on')).toBeVisible();
  await expect(page.locator('.touch-controls.on')).toHaveCount(0);
  await page.locator('.overlay.pause.on').tap();
  await expect(page.locator('.overlay.pause.on')).toHaveCount(0);
  expect((await snap(page)).phase).toBe('riding');
});

test.describe('landscape', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  test('controls sit beside the street, nothing overlaps, no scroll', async ({ page }) => {
    await startRide(page);
    await expectPhoneLayout(page);
    await page.getByRole('button', { name: 'Toss right' }).tap();
    await expect(page.locator('[data-stat="papers"]')).toHaveText('9');
    await touchDrag(page, [100, 300], [60, 300], 400);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'test-results/paper-route-touch-landscape.png' });
  });
});
