# Backyard Mini-Golf — Plan 2: Look & Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the playable placeholder game into the cozy iso-diorama look from the spec: dithered code-drawn terrain with a grass fringe, one shared palette, time-of-day grading with lamp-light pools, stepped wind, PixelLab golfer and props, and generated sound. Also clear the leftovers from Plan 1's reviews.

**Architecture:** Terrain is baked once per hole into pixel buffers by pure code (`terrain-bake.ts`): two wind frames, a per-pixel ground-height map and a lamp-light mask. Each frame the renderer draws the baked terrain plus depth-sorted sprites (PixelLab images, with placeholder fallback). A post pass then snaps every pixel to the palette through a lookup table and applies the phase look, including light bands. PixelLab output goes through a local ingest script (palette snap, trim, sprite-sheet packing) into `assets/`. The game never calls PixelLab while running. Loading becomes async.

**Tech Stack:** TypeScript, Canvas 2D, Vite 6, Vitest 3, Playwright, vite-node, pngjs (dev only), Web Audio. PixelLab MCP tools for asset generation.

**Spec:** `docs/superpowers/specs/2026-11-09-backyard-minigolf-design.md`. **Builds on:** Plan 1, merged on `main`.

**Deliberate deviations from the spec (decided while planning):**
- **Picket fences are drawn by code, not PixelLab.** Fence pieces have to follow the isometric tile edges exactly. PixelLab has no isometric object view, so its fence segments wouldn't line up.
- **The kiddie pool rim is drawn by code** (a red-and-white band where water meets land), for the same reason.
- **The HUD keeps its CSS monospace font.** PixelLab's UI tool makes panels, not logos or fonts, so the title card instead gets a PixelLab wooden sign panel as its background.
- **Palette snapping of assets runs locally** in the ingest script (nearest palette colour), not via PixelLab's `reduce_colors`. It's free, deterministic and gives the same result.

**Units and conventions:** grid positions and heights are in tiles. Screen coordinates are buffer pixels (360×270). Hex colours are `#rrggbb`. Frame pixel buffers are mutated in place inside the post pass; that is the one documented exception to the immutability rule, for performance. Everything else returns new values.

**Commit trailer:** end each commit with the `Co-Authored-By` trailer that your session's attribution guidance specifies.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `package.json` | modify | upgrade dev tools; add `pngjs`, `ingest` script |
| `.gitignore` | modify | ignore `assets/raw/` |
| `src/physics/ball.ts`, `constants.ts` | modify | resting wall contact, corner pinning, NaN-safe strike |
| `src/world/holes/03.json`, `tests/fixtures/solutions.ts` | modify | Pool Hop tuning |
| `assets/palette.json` | create | the 32-colour Backyard palette |
| `src/render/palette.ts` | create | hex parsing, nearest colour, 5-bit lookup table |
| `src/render/time-of-day.ts` | create | phases, grades, shadow directions, clock/URL phase |
| `src/render/post.ts` | create | per-phase colour tables; palette snap + grade + light bands |
| `src/world/manifest.ts` | modify | v2: optional placeholder, `image`, `sway`, `light` |
| `src/world/golfer.ts` | create | golfer sheet layout type + validator, directions |
| `src/render/golfer-pose.ts` | create | which golfer frame to show, where, facing which way |
| `src/render/terrain-bake.ts` | create | pure terrain rasterizer: dither, noise, fringe, pool rim, sides, back fences |
| `src/render/fences.ts` | create | wall classification, picket pixels, wall depth |
| `src/render/wind.ts` | create | 8 fps wind step, sway offset |
| `src/render/lights.ts` | create | lamp list, light bands, light mask bake |
| `src/render/assets.ts` | create | sprite URLs, image loading, bake → canvases |
| `src/content.ts` | create | async content loading shared by game and debug page |
| `src/render/renderer.ts` | rewrite | sprites, shadows, sway, golfer frames, front fences |
| `src/render/terrain-draw.ts`, `tests/unit/terrain-draw.test.ts` | delete | replaced by terrain-bake |
| `src/main.ts` | rewrite | async boot, phase, post pass, audio |
| `src/style.css`, `src/ui/hud.ts` | modify | page colour per phase, title panel |
| `debug.html`, `src/debug.ts` | create | every hole at every phase, side by side |
| `scripts/lib/sprite-tools.ts` | create | pure bitmap helpers: snap, trim, anchor, pack |
| `scripts/ingest.ts` | create | CLI: ingest object / ui / golfer from PixelLab downloads |
| `assets/sprites/*.png`, `assets/golfer.json`, `assets/ui/title-panel.png` | create | ingested PixelLab art |
| `assets/manifest.json` | modify | images, anchors, sway, light, new props |
| `src/world/holes/0{1,2,3}.json` | modify | decoration props |
| `src/audio/sfx-math.ts`, `src/audio/sfx.ts` | create | sound mapping (pure) + Web Audio synth |
| `tests/unit/*.test.ts` | create/modify | tests for all of the above |

---

## Phase A — leftovers from Plan 1

### Task 1: Upgrade dev tooling to clear `npm audit` advisories

**Files:** Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Record the current advisories**

Run: `npm audit --omit=optional | tail -5`
Expected: the 10 advisories (3 critical, 1 high) found after Plan 1.

- [ ] **Step 2: Upgrade**

Run:
```bash
npm install -D vite@^6 vitest@^3 @vitest/coverage-v8@^3 vite-node@^3
```

- [ ] **Step 3: Verify**

Run: `npm audit --omit=optional | tail -5`
Expected: no critical or high advisories. If any remain, run `npm audit` to see the package path and report it. Don't use `npm audit fix --force`.

Run each and confirm they pass: `npx tsc --noEmit`, `npm test`, `npm run coverage`, `npm run e2e`, `npm run build`. Then delete `test-results/` and `playwright-report/` if they were created.

If Vitest 3 rejects `vitest.config.ts`, make the smallest config fix and note it.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: upgrade to Vite 6 and Vitest 3 to clear dev-tool advisories"
```

---

### Task 2: Physics — wall sliding, acute corners, NaN-safe strike

Plan 1's review found three issues. A ball held against a wall by a slope lost 30% of its speed every step, so it crept along and hit the 20 s timeout. In acute corners, the slope projection over-counted the pull and the ball never stopped. And a NaN power or angle crashed `heightAt` instead of being handled.

**Files:**
- Modify: `src/physics/constants.ts`, `src/physics/ball.ts`
- Test: `tests/unit/ball.test.ts` (append)

- [ ] **Step 1: Write the failing tests** — append to `tests/unit/ball.test.ts`:

```ts
describe('walls under a slope', () => {
  it('a ball the slope presses into a wall slides along it and stops in the corner', () => {
    // Downhill toward -x and -y: pressed into the top wall (y = 0), pulled along it toward x = 0.
    const hole = makeHole({ heightOf: (x, y) => 2 * x + 2 * y });
    const r = simulateShot(hole, restingBall(hole, [15, 0.3]), 0, 0);
    expect(r.outcome).toBe('stopped');
    expect(r.ball.x).toBeLessThan(1);
  });

  it('a ball pinned in an acute corner stops instead of timing out', () => {
    // A V of two walls (17° half-angle) with the slope pulling straight into its apex at (10, 8.5).
    const hole = makeHole({
      width: 20, depth: 10, tee: [1.5, 2.5], cup: [18.5, 0.5],
      heightOf: (_x, y) => -4 * y,
      walls: [[[10, 8.5], [8.25, 2.76]], [[10, 8.5], [11.75, 2.76]]],
    });
    const r = simulateShot(hole, restingBall(hole, [10, 5]), 0, 0);
    expect(r.outcome).toBe('stopped');
    expect(r.ball.y).toBeGreaterThan(7.5);
  });
});

describe('strike with broken input', () => {
  it('treats a NaN power or angle as no stroke', () => {
    const hole = makeHole();
    const ball = restingBall(hole, [2.5, 2.5]);
    expect(strike(ball, hole, 0, Number.NaN).vx).toBe(0);
    expect(strike(ball, hole, Number.NaN, 1).vy).toBe(0);
    expect(simulateShot(hole, ball, 0, Number.NaN).outcome).toBe('stopped');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/ball.test.ts`
Expected: the wall-slide and V tests FAIL with outcome `timeout`, and the NaN test FAILS with a TypeError.

- [ ] **Step 3: Add the constant** — append to `src/physics/constants.ts`:

```ts
/** Slower than this into a wall (normal speed, tiles/s) is resting contact: the push is cancelled but the slide keeps its speed. */
export const RESTING_CONTACT_SPEED = 0.2;
```

- [ ] **Step 4: Update `src/physics/ball.ts`**

Add `RESTING_CONTACT_SPEED` to the import list from `./constants`.

Replace `strike` with:
```ts
export function strike(ball: Ball, hole: Hole, angle: number, power: number): Ball {
  if (!Number.isFinite(angle) || !Number.isFinite(power)) return { ...ball, vx: 0, vy: 0, vz: 0, airborne: false };
  const s = Math.max(0, Math.min(1, power)) * MAX_PUTT_SPEED;
  const vx = Math.cos(angle) * s;
  const vy = Math.sin(angle) * s;
  return { ...ball, vx, vy, vz: groundRise(hole, ball.x, ball.y, vx, vy), airborne: false };
}
```

In `rolledVelocity`, change the comment on the non-finite line to:
```ts
  if (!Number.isFinite(sp)) return [sx, sy]; // non-finite velocity: settle() reports it as water
```

In `collide`, replace the `if (vn < 0) { ... }` block inside `pushOut` with:
```ts
    if (vn >= 0) return;
    hit = true;
    if (-vn > RESTING_CONTACT_SPEED) {
      vx = (vx - 2 * vn * nx) * WALL_KEEP;
      vy = (vy - 2 * vn * ny) * WALL_KEEP;
      impact = Math.max(impact, -vn);
    } else {
      // Resting contact (a slope pressing the ball into the wall): cancel the push, keep the slide.
      vx -= vn * nx;
      vy -= vn * ny;
    }
```

Replace `freeSlopeAccel` with:
```ts
/** The slope's downhill pull at (x, y), less what touching walls or props hold back. 0 when pinned. */
function freeSlopeAccel(hole: Hole, x: number, y: number): number {
  const [gx, gy] = gradientAt(hole, x, y);
  const normals = contactNormals(hole, x, y);
  let dx = -gx, dy = -gy;
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const [nx, ny] of normals) {
      const into = dx * nx + dy * ny;
      if (into < -CONTACT_EPS) {
        dx -= into * nx;
        dy -= into * ny;
        changed = true;
      }
    }
    if (!changed) return SLOPE_ACCEL * Math.hypot(dx, dy);
  }
  return 0; // contacts keep pushing the pull back into each other: the ball is pinned
}
```

In `settle`, replace the line `if (entering) vz = gx * vx + gy * vy;` with:
```ts
  if (entering) vz = groundRise(hole, b.x, b.y, vx, vy);
```
and delete the now-unused `const [gx, gy] = gradientAt(hole, b.x, b.y);` line above it, if nothing else in `settle` uses `gx`/`gy`.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS, including the existing wall-bounce ratio test (fast impacts still keep about 70%).

- [ ] **Step 6: Re-run the solver** (bounces near walls changed slightly)

Run: `npm run solve -- 1`, `npm run solve -- 2`, `npm run solve -- 3`. If any output differs from `tests/fixtures/solutions.ts`, paste the new lines into it. Run `npx vitest run tests/unit/holes.test.ts`; expected PASS.

- [ ] **Step 7: Commit**

```bash
git add src/physics tests/unit/ball.test.ts tests/fixtures/solutions.ts
git commit -m "fix: let balls slide along walls, stop when pinned in corners, ignore NaN strikes"
```

---

### Task 3: Pool Hop — no hole-in-one straight down the lane

**Files:**
- Modify: `src/world/holes/03.json`, `tests/fixtures/solutions.ts`
- Test: `tests/unit/holes.test.ts` (append)

- [ ] **Step 1: Write the failing test** — append inside `describe('Backyard holes', ...)` in `tests/unit/holes.test.ts`:

```ts
  it('Pool Hop has no hole-in-one straight down the lane (±6°)', () => {
    const hole = holes[2];
    const from = restingBall(hole, hole.tee);
    for (let deg = -6; deg <= 6; deg += 1) {
      for (let p = 0.5; p <= 1.0001; p += 0.02) {
        expect(simulateShot(hole, from, (deg * Math.PI) / 180, p).outcome).not.toBe('holed');
      }
    }
  });
```
(`restingBall` and `simulateShot` are already imported in this file from Plan 1, Task 11.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/holes.test.ts`
Expected: FAIL. Angle 0 at power around 0.95 is holed.

- [ ] **Step 3: Move the cup** — in `src/world/holes/03.json`, change `"cup": [12.5, 3.5]` to:

```json
  "cup": [12.5, 1.5],
```
Row 1 is `"RRRRRRRRRRGGGR"`, so column 12 is green. The ramp hop now lands on the raised green and needs a second, angled putt.

- [ ] **Step 4: Re-solve**

Run: `npm run solve -- 3`
Expected: `"holed":true` with at most 3 shots. Paste the shots into `tests/fixtures/solutions.ts` under `'Pool Hop'`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/holes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/world/holes/03.json tests/fixtures/solutions.ts tests/unit/holes.test.ts
git commit -m "feat: move Pool Hop's cup so the ramp hop sets up a putt instead of an ace"
```

---

## Phase B — the look engine (works with placeholders)

### Task 4: Palette

**Files:**
- Create: `assets/palette.json`, `src/render/palette.ts`
- Test: `tests/unit/palette.test.ts`

- [ ] **Step 1: Create `assets/palette.json`**

```json
{
  "name": "Backyard",
  "colors": [
    "#14141c", "#2c2c3a", "#4a4a5a", "#2a2450", "#4b3f7a",
    "#1f3a2c", "#2f5530", "#3f6b3a", "#5e8c45", "#8db35a", "#b9cf6e",
    "#4f8a4c", "#6fae5c", "#8fca6c", "#b5e08a",
    "#2e2420", "#4a3b2e", "#6b4f3a", "#8a6a4a", "#b08a62",
    "#d9c08c", "#efe6d2", "#fffaf0",
    "#1d3b5c", "#2f6f9a", "#5aa7d0", "#9fd8ee",
    "#7a2e2e", "#c8463c", "#e98a52", "#f2c25b", "#e7b98f"
  ]
}
```

- [ ] **Step 2: Write the failing test `tests/unit/palette.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import paletteJson from '../../assets/palette.json';
import {
  buildLut, colorDistance, createPalette, lutIndex, nearestIndex, parseHex, parsePalette, toHex, type RGB,
} from '../../src/render/palette';

describe('hex colours', () => {
  it('parses and formats', () => {
    expect(parseHex('#ff8000')).toEqual([255, 128, 0]);
    expect(toHex([255, 128, 0])).toBe('#ff8000');
  });
  it('rejects bad hex', () => {
    expect(() => parseHex('ff8000')).toThrow(/not a #rrggbb colour/);
    expect(() => parseHex('#ff80')).toThrow(/not a #rrggbb colour/);
  });
});

describe('nearest colour', () => {
  const colors: RGB[] = [[0, 0, 0], [255, 255, 255], [255, 0, 0]];
  it('finds exact and near matches', () => {
    expect(nearestIndex(colors, [255, 0, 0])).toBe(2);
    expect(nearestIndex(colors, [240, 20, 10])).toBe(2);
    expect(nearestIndex(colors, [30, 30, 30])).toBe(0);
  });
  it('weights green most', () => {
    expect(colorDistance([0, 10, 0], [0, 0, 0])).toBeGreaterThan(colorDistance([10, 0, 0], [0, 0, 0]));
  });
  it('the lookup table agrees with nearestIndex', () => {
    const lut = buildLut(colors);
    expect(lutIndex(lut, 250, 10, 10)).toBe(2);
    expect(lutIndex(lut, 200, 200, 200)).toBe(1);
    expect(lutIndex(lut, 5, 5, 5)).toBe(0);
  });
});

describe('palette file', () => {
  it('loads the 32-colour Backyard palette', () => {
    const p = createPalette(paletteJson);
    expect(p.colors).toHaveLength(32);
    expect(p.lut).toHaveLength(32 * 32 * 32);
  });
  it('maps every palette colour to itself or a near twin', () => {
    const p = createPalette(paletteJson);
    for (const c of p.colors) expect(colorDistance(p.colors[lutIndex(p.lut, ...c)], c)).toBeLessThan(9 * 64 * 3);
  });
  it('rejects a bad palette', () => {
    expect(() => parsePalette({})).toThrow(/needs a "colors" array/);
    expect(() => parsePalette({ colors: ['#000000'] })).toThrow(/needs a "colors" array/);
    expect(() => parsePalette({ colors: ['#000000', 5] })).toThrow(/colours must be strings/);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/unit/palette.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Write `src/render/palette.ts`**

```ts
export type RGB = readonly [number, number, number];

export interface Palette {
  readonly colors: readonly RGB[];
  /** 32×32×32 lookup (5 bits per channel) → nearest palette index. */
  readonly lut: Uint8Array;
}

export class PaletteError extends Error {}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function parseHex(hex: string): RGB {
  if (!HEX.test(hex)) throw new PaletteError(`palette: "${hex}" is not a #rrggbb colour`);
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Perceptually weighted squared distance: green counts most, then blue, then red. */
export function colorDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
}

export function nearestIndex(colors: readonly RGB[], c: RGB): number {
  let best = 0;
  let bestD = Infinity;
  colors.forEach((p, i) => {
    const d = colorDistance(p, c);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

const expand5 = (v: number) => (v << 3) | (v >> 2);

export function buildLut(colors: readonly RGB[]): Uint8Array {
  const lut = new Uint8Array(32 * 32 * 32);
  for (let r = 0; r < 32; r++) {
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) lut[(r << 10) | (g << 5) | b] = nearestIndex(colors, [expand5(r), expand5(g), expand5(b)]);
    }
  }
  return lut;
}

export function lutIndex(lut: Uint8Array, r: number, g: number, b: number): number {
  return lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
}

export function parsePalette(raw: unknown): RGB[] {
  const colors = typeof raw === 'object' && raw !== null ? (raw as { colors?: unknown }).colors : undefined;
  if (!Array.isArray(colors) || colors.length < 2 || colors.length > 64) {
    throw new PaletteError('palette: needs a "colors" array of 2 to 64 hex strings');
  }
  return colors.map((c) => {
    if (typeof c !== 'string') throw new PaletteError('palette: colours must be strings');
    return parseHex(c);
  });
}

export function createPalette(raw: unknown): Palette {
  const colors = parsePalette(raw);
  return { colors, lut: buildLut(colors) };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/unit/palette.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add assets/palette.json src/render/palette.ts tests/unit/palette.test.ts
git commit -m "feat: add the Backyard palette with a fast nearest-colour lookup"
```

---

### Task 5: Time of day

**Files:**
- Create: `src/render/time-of-day.ts`
- Test: `tests/unit/time-of-day.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { PHASES, PHASE_IDS, gradeColor, phaseAt, phaseFor } from '../../src/render/time-of-day';

describe('phaseAt', () => {
  it.each([
    [4, 'night'], [5, 'morning'], [9, 'morning'], [10, 'day'], [16, 'day'],
    [17, 'dusk'], [19, 'dusk'], [20, 'night'], [0, 'night'], [23, 'night'],
  ])('%i:00 is %s', (hour, phase) => {
    expect(phaseAt(hour)).toBe(phase);
  });
});

describe('phaseFor', () => {
  it('uses ?phase= when valid', () => {
    expect(phaseFor('?phase=night', 12)).toBe('night');
    expect(phaseFor('?x=1&phase=dusk', 12)).toBe('dusk');
  });
  it('falls back to the clock', () => {
    expect(phaseFor('', 12)).toBe('day');
    expect(phaseFor('?phase=noon', 12)).toBe('day');
  });
});

describe('grades', () => {
  it('day leaves colours unchanged', () => {
    expect(gradeColor([10, 200, 90], PHASES.day.grade)).toEqual([10, 200, 90]);
  });
  it('night darkens and cools', () => {
    const [r, g, b] = gradeColor([200, 200, 200], PHASES.night.grade);
    expect(r).toBeLessThan(200);
    expect(b).toBeGreaterThan(r);
  });
  it('clamps to 0..255', () => {
    expect(gradeColor([255, 255, 255], PHASES.morning.grade).every((v) => v <= 255)).toBe(true);
  });
  it('lamps light only at dusk and night', () => {
    expect(PHASE_IDS.filter((id) => PHASES[id].lamps)).toEqual(['dusk', 'night']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/time-of-day.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/render/time-of-day.ts`**

```ts
import type { Vec2 } from '../core/geometry';
import type { RGB } from './palette';

export type PhaseId = 'morning' | 'day' | 'dusk' | 'night';
export const PHASE_IDS: readonly PhaseId[] = ['morning', 'day', 'dusk', 'night'];

export interface Grade {
  readonly mul: RGB;
  readonly add: RGB;
}

export interface PhaseLook {
  readonly id: PhaseId;
  readonly grade: Grade;
  /** Screen direction shadows fall, in pixels per pixel of object height (x right, y down). */
  readonly shadow: Vec2;
  /** Whether lamps cast light pools. */
  readonly lamps: boolean;
}

export const PHASES: Readonly<Record<PhaseId, PhaseLook>> = {
  morning: { id: 'morning', grade: { mul: [1, 0.95, 0.9], add: [14, 8, 4] }, shadow: [-0.5, 0.25], lamps: false },
  day: { id: 'day', grade: { mul: [1, 1, 1], add: [0, 0, 0] }, shadow: [0.35, 0.2], lamps: false },
  dusk: { id: 'dusk', grade: { mul: [1, 0.8, 0.72], add: [16, 0, 12] }, shadow: [0.7, 0.25], lamps: true },
  night: { id: 'night', grade: { mul: [0.42, 0.48, 0.72], add: [8, 8, 26] }, shadow: [0.2, 0.15], lamps: true },
};

export function phaseAt(hour: number): PhaseId {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

/** `?phase=night` (etc.) overrides the clock, for checking every look. */
export function phaseFor(search: string, hour: number): PhaseId {
  const asked = new URLSearchParams(search).get('phase');
  return PHASE_IDS.includes(asked as PhaseId) ? (asked as PhaseId) : phaseAt(hour);
}

export function gradeColor(c: RGB, g: Grade): RGB {
  const ch = (i: 0 | 1 | 2) => Math.max(0, Math.min(255, Math.round(c[i] * g.mul[i] + g.add[i])));
  return [ch(0), ch(1), ch(2)];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/time-of-day.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/time-of-day.ts tests/unit/time-of-day.test.ts
git commit -m "feat: add time-of-day phases with colour grades and shadow directions"
```

---

### Task 6: Post pass

**Files:**
- Create: `src/render/post.ts`
- Test: `tests/unit/post.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import paletteJson from '../../assets/palette.json';
import { createPalette, type RGB } from '../../src/render/palette';
import { LIGHT_BANDS, applyPost, buildPhaseTables } from '../../src/render/post';
import { PHASES } from '../../src/render/time-of-day';

const palette = createPalette(paletteJson);
const inPalette = (c: RGB) => palette.colors.some((p) => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]);
const px = (...cs: RGB[]) => Uint8ClampedArray.from(cs.flatMap((c) => [...c, 255]));
const rgbAt = (a: Uint8ClampedArray, i: number): RGB => [a[i * 4], a[i * 4 + 1], a[i * 4 + 2]];

describe('buildPhaseTables', () => {
  it('has one table per light band plus unlit', () => {
    expect(buildPhaseTables(palette, PHASES.night).bands).toHaveLength(LIGHT_BANDS + 1);
  });
  it('day band 0 is the palette itself', () => {
    const t = buildPhaseTables(palette, PHASES.day).bands[0];
    palette.colors.forEach((c, i) => expect([t[i * 3], t[i * 3 + 1], t[i * 3 + 2]]).toEqual([...c]));
  });
  it('lit bands are palette colours', () => {
    const t = buildPhaseTables(palette, PHASES.night).bands[3];
    for (let i = 0; i < palette.colors.length; i++) expect(inPalette([t[i * 3], t[i * 3 + 1], t[i * 3 + 2]])).toBe(true);
  });
});

describe('applyPost', () => {
  it('snaps off-palette colours to the palette in daylight', () => {
    const a = px([110, 175, 90], [3, 3, 3]);
    applyPost(a, palette.lut, buildPhaseTables(palette, PHASES.day), null);
    expect(inPalette(rgbAt(a, 0))).toBe(true);
    expect(rgbAt(a, 1)).toEqual([20, 20, 28]);
    expect(a[3]).toBe(255);
  });
  it('night is darker than day', () => {
    const day = px([239, 230, 210]);
    const night = px([239, 230, 210]);
    applyPost(day, palette.lut, buildPhaseTables(palette, PHASES.day), null);
    applyPost(night, palette.lut, buildPhaseTables(palette, PHASES.night), null);
    expect(rgbAt(night, 0)[0]).toBeLessThan(rgbAt(day, 0)[0]);
  });
  it('lamp light brightens a pixel at night', () => {
    const tables = buildPhaseTables(palette, PHASES.night);
    const unlit = px([111, 174, 92]);
    const lit = px([111, 174, 92]);
    applyPost(unlit, palette.lut, tables, Uint8Array.from([0]));
    applyPost(lit, palette.lut, tables, Uint8Array.from([3]));
    const sum = (c: RGB) => c[0] + c[1] + c[2];
    expect(sum(rgbAt(lit, 0))).toBeGreaterThan(sum(rgbAt(unlit, 0)));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/post.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/render/post.ts`**

```ts
import { lutIndex, nearestIndex, type Palette, type RGB } from './palette';
import { gradeColor, type PhaseLook } from './time-of-day';

/** Number of lamp-light bands (band 0 = unlit). */
export const LIGHT_BANDS = 3;
const LAMP_TINT: RGB = [255, 214, 150];
/** How far each band pulls a pixel from its graded colour toward its warm lamp-lit colour. */
const BAND_STRENGTH = [0, 0.4, 0.65, 0.9] as const;

export interface PhaseTables {
  /** bands[b][i * 3 .. i * 3 + 2] = output RGB for palette index i under light band b. */
  readonly bands: readonly Uint8Array[];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const lampLit = (c: RGB): RGB => [
  Math.min(255, Math.round(((c[0] * LAMP_TINT[0]) / 255) * 1.15)),
  Math.min(255, Math.round(((c[1] * LAMP_TINT[1]) / 255) * 1.15)),
  Math.min(255, Math.round(((c[2] * LAMP_TINT[2]) / 255) * 1.15)),
];

const flat = (cs: readonly RGB[]): Uint8Array => Uint8Array.from(cs.flat());

export function buildPhaseTables(palette: Palette, look: PhaseLook): PhaseTables {
  const graded = palette.colors.map((c) => gradeColor(c, look.grade));
  const bands = BAND_STRENGTH.map((t, b) => {
    if (b === 0) return flat(graded);
    // Lit pixels snap back onto the (ungraded) palette, so a pool reads as warm daylight in hard bands.
    return flat(palette.colors.map((c, i) => palette.colors[nearestIndex(palette.colors, mix(graded[i], lampLit(c), t))]));
  });
  return { bands };
}

/**
 * Snaps every pixel to the palette and applies the phase look, IN PLACE (per-frame buffer; documented
 * exception to the immutability rule). `light` holds a band 0..LIGHT_BANDS per pixel, or null for none.
 */
export function applyPost(px: Uint8ClampedArray, lut: Uint8Array, tables: PhaseTables, light: Uint8Array | null): void {
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const idx = lutIndex(lut, px[i], px[i + 1], px[i + 2]) * 3;
    const t = tables.bands[light ? light[p] : 0];
    px[i] = t[idx];
    px[i + 1] = t[idx + 1];
    px[i + 2] = t[idx + 2];
    px[i + 3] = 255;
  }
}

/** Reads the canvas back, post-processes it and writes it out again. */
export function postProcess(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  lut: Uint8Array, tables: PhaseTables, light: Uint8Array | null,
): void {
  const img = ctx.getImageData(0, 0, width, height);
  applyPost(img.data, lut, tables, light);
  ctx.putImageData(img, 0, 0);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/post.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/post.ts tests/unit/post.test.ts
git commit -m "feat: add the post pass (palette snap, phase grade, lamp-light bands)"
```

---

### Task 7: Manifest v2, golfer layout, golfer pose

**Files:**
- Modify: `src/world/manifest.ts`, `tests/unit/manifest.test.ts`
- Create: `src/world/golfer.ts`, `src/render/golfer-pose.ts`
- Test: `tests/unit/golfer.test.ts`

- [ ] **Step 1: Update `tests/unit/manifest.test.ts`**

Replace the test `it('rejects a missing placeholder', ...)` with:
```ts
  it('rejects a sprite with neither image nor placeholder', () => {
    expect(() => parseManifest({ post: {} })).toThrow(/post needs an image or a placeholder/);
  });
```

Append inside the `describe('parseManifest', ...)` block:
```ts
  it('accepts an image, sway and light', () => {
    const m = parseManifest({
      lamp: { image: { src: 'lamp.png', anchor: [8, 40] }, light: { radius: 2.5 } },
      bush: { placeholder, sway: true },
    });
    expect(m.lamp.image).toEqual({ src: 'lamp.png', anchor: [8, 40] });
    expect(m.lamp.light).toEqual({ radius: 2.5 });
    expect(m.lamp.sway).toBe(false);
    expect(m.lamp.placeholder).toBeUndefined();
    expect(m.bush.sway).toBe(true);
  });

  it('rejects bad image, sway or light fields', () => {
    expect(() => parseManifest({ a: { image: { src: '../x.png', anchor: [0, 0] } } })).toThrow(/a\.image needs src/);
    expect(() => parseManifest({ a: { image: { src: 'x.png', anchor: [0] } } })).toThrow(/a\.image needs src/);
    expect(() => parseManifest({ a: { placeholder, sway: 'yes' } })).toThrow(/a\.sway must be true or false/);
    expect(() => parseManifest({ a: { placeholder, light: { radius: 0 } } })).toThrow(/a\.light needs a positive radius/);
  });
```

- [ ] **Step 2: Write `tests/unit/golfer.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { STROKE_SECONDS, golferPose, screenDir } from '../../src/render/golfer-pose';
import { DIRS, PLACEHOLDER_ANIMS, parseGolfer } from '../../src/world/golfer';
import { initialState, type GameState } from '../../src/game/state';
import { makeHole } from '../helpers/makeHole';

const rows = Object.fromEntries(DIRS.map((d, i) => [d, i]));
const layoutRaw = {
  src: 'golfer.png', cell: [40, 44], anchor: [20, 43],
  anims: {
    idle: { frames: 4, fps: 6, rows },
    backswing: { frames: 6, fps: 1, rows },
    stroke: { frames: 6, fps: 12, rows },
    celebrate: { frames: 8, fps: 8, rows },
  },
};

describe('parseGolfer', () => {
  it('accepts a full layout', () => {
    const g = parseGolfer(layoutRaw);
    expect(g.cell).toEqual([40, 44]);
    expect(g.anims.stroke.rows.east).toBe(DIRS.indexOf('east'));
  });
  it('rejects a missing animation or direction', () => {
    const { celebrate: _c, ...noCelebrate } = layoutRaw.anims;
    expect(() => parseGolfer({ ...layoutRaw, anims: noCelebrate })).toThrow(/golfer: anims\.celebrate/);
    const { east: _e, ...noEast } = rows;
    expect(() => parseGolfer({ ...layoutRaw, anims: { ...layoutRaw.anims, idle: { frames: 4, fps: 6, rows: noEast } } }))
      .toThrow(/golfer: anims\.idle\.rows\.east/);
  });
  it('rejects bad numbers', () => {
    expect(() => parseGolfer({ ...layoutRaw, cell: [0, 44] })).toThrow(/golfer: cell/);
    expect(() => parseGolfer({ ...layoutRaw, src: 5 })).toThrow(/golfer: src/);
  });
});

describe('screenDir', () => {
  it.each([
    [0, 'south-east'], [Math.PI / 4, 'south'], [Math.PI / 2, 'south-west'], [(3 * Math.PI) / 4, 'west'],
    [Math.PI, 'north-west'], [-(3 * Math.PI) / 4, 'north'], [-Math.PI / 2, 'north-east'], [-Math.PI / 4, 'east'],
  ])('grid angle %f faces %s on screen', (angle, dir) => {
    expect(screenDir(angle)).toBe(dir);
  });
});

describe('golferPose', () => {
  const hole = makeHole({ width: 8, cup: [6.5, 0.5] });
  const anims = parseGolfer(layoutRaw).anims;
  const base = initialState([hole]);
  const at = (s: Partial<GameState>): GameState => ({ ...base, ...s });

  it('idles behind the ball while aiming, looping over time', () => {
    const p = golferPose(at({ phase: { kind: 'aiming' }, aim: 0 }), anims, 0.5);
    expect(p?.anim).toBe('idle');
    expect(p?.frame).toBe(3); // floor(0.5 * 6) % 4
    expect(p?.at[0]).toBeLessThan(base.ball.x);
    expect(p?.facing).toBe('south-east');
  });
  it('scrubs the backswing with the charged power', () => {
    expect(golferPose(at({ phase: { kind: 'charging', t: 1 } }), anims, 0)).toMatchObject({ anim: 'backswing', frame: 5 });
    expect(golferPose(at({ phase: { kind: 'charging', t: 0 } }), anims, 0)).toMatchObject({ anim: 'backswing', frame: 0 });
  });
  it('plays the stroke right after release, then hides', () => {
    expect(golferPose(at({ phase: { kind: 'rolling', t: 0 } }), anims, 0)?.anim).toBe('stroke');
    expect(golferPose(at({ phase: { kind: 'rolling', t: STROKE_SECONDS * 0.99 } }), anims, 0)?.frame).toBe(5);
    expect(golferPose(at({ phase: { kind: 'rolling', t: STROKE_SECONDS } }), anims, 0)).toBeNull();
  });
  it('celebrates when holed and is absent on menus', () => {
    expect(golferPose(at({ phase: { kind: 'holed', t: 0.3, label: 'Par' } }), anims, 0)?.anim).toBe('celebrate');
    expect(golferPose(at({ phase: { kind: 'title' } }), anims, 0)).toBeNull();
  });
  it('works with the placeholder layout', () => {
    expect(golferPose(at({ phase: { kind: 'charging', t: 0.7 } }), PLACEHOLDER_ANIMS, 0)?.frame).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/unit/manifest.test.ts tests/unit/golfer.test.ts`
Expected: FAIL. The new manifest messages don't exist yet, and the golfer modules aren't found.

- [ ] **Step 4: Rewrite `src/world/manifest.ts`**

```ts
export type Footprint =
  | { readonly kind: 'circle'; readonly r: number }
  | { readonly kind: 'box'; readonly w: number; readonly d: number };

export interface Placeholder {
  readonly color: string;
  readonly w: number;
  readonly h: number;
}

export interface SpriteImage {
  /** File name inside assets/sprites/. */
  readonly src: string;
  /** Pixel inside the image that sits on the sprite's ground point. */
  readonly anchor: readonly [number, number];
}

export interface Light {
  /** Pool radius in tiles. */
  readonly radius: number;
}

export interface SpriteDef {
  readonly footprint?: Footprint;
  readonly placeholder?: Placeholder;
  readonly image?: SpriteImage;
  /** Sways in the wind: the top half shifts a pixel on alternate wind steps. */
  readonly sway: boolean;
  /** Casts a lamp-light pool at dusk and night. */
  readonly light?: Light;
}

export type Manifest = Readonly<Record<string, SpriteDef>>;

export class ManifestError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPosNum = (v: unknown): v is number => isNum(v) && v > 0;
const FILE = /^[a-z0-9-]+\.png$/;

function parseFootprint(name: string, raw: unknown): Footprint | undefined {
  if (raw === undefined) return undefined;
  if (!isObj(raw)) throw new ManifestError(`manifest: ${name}.footprint must be an object`);
  if (raw.kind === 'circle' && isPosNum(raw.r)) return { kind: 'circle', r: raw.r };
  if (raw.kind === 'box' && isPosNum(raw.w) && isPosNum(raw.d)) return { kind: 'box', w: raw.w, d: raw.d };
  throw new ManifestError(`manifest: ${name}.footprint must be {kind:'circle',r} or {kind:'box',w,d}`);
}

function parsePlaceholder(name: string, raw: unknown): Placeholder | undefined {
  if (raw === undefined) return undefined;
  if (!isObj(raw) || typeof raw.color !== 'string' || !isPosNum(raw.w) || !isPosNum(raw.h)) {
    throw new ManifestError(`manifest: ${name}.placeholder needs color, w, h`);
  }
  return { color: raw.color, w: raw.w, h: raw.h };
}

function parseImage(name: string, raw: unknown): SpriteImage | undefined {
  if (raw === undefined) return undefined;
  const a = isObj(raw) ? raw.anchor : undefined;
  if (!isObj(raw) || typeof raw.src !== 'string' || !FILE.test(raw.src) || !Array.isArray(a) || a.length !== 2 || !a.every(isNum)) {
    throw new ManifestError(`manifest: ${name}.image needs src (a plain .png file name) and anchor [x, y]`);
  }
  return { src: raw.src, anchor: [a[0], a[1]] };
}

function parseLight(name: string, raw: unknown): Light | undefined {
  if (raw === undefined) return undefined;
  if (!isObj(raw) || !isPosNum(raw.radius)) throw new ManifestError(`manifest: ${name}.light needs a positive radius`);
  return { radius: raw.radius };
}

function parseDef(name: string, raw: unknown): SpriteDef {
  const d = isObj(raw) ? raw : {};
  if (d.sway !== undefined && typeof d.sway !== 'boolean') throw new ManifestError(`manifest: ${name}.sway must be true or false`);
  const def: SpriteDef = {
    footprint: parseFootprint(name, d.footprint),
    placeholder: parsePlaceholder(name, d.placeholder),
    image: parseImage(name, d.image),
    sway: d.sway === true,
    light: parseLight(name, d.light),
  };
  if (!def.image && !def.placeholder) throw new ManifestError(`manifest: ${name} needs an image or a placeholder`);
  return def;
}

export function parseManifest(raw: unknown): Manifest {
  if (!isObj(raw)) throw new ManifestError('manifest: must be an object of sprite definitions');
  return Object.freeze(Object.fromEntries(Object.entries(raw).map(([name, def]) => [name, parseDef(name, def)])));
}
```

- [ ] **Step 5: Write `src/world/golfer.ts`**

```ts
export const DIRS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'] as const;
export type Dir = (typeof DIRS)[number];
export const GOLFER_ANIMS = ['idle', 'backswing', 'stroke', 'celebrate'] as const;
export type GolferAnim = (typeof GOLFER_ANIMS)[number];

export interface AnimLayout {
  readonly frames: number;
  readonly fps: number;
  /** Sheet row for each facing direction. */
  readonly rows: Readonly<Record<Dir, number>>;
}

export interface GolferLayout {
  /** File name inside assets/sprites/. */
  readonly src: string;
  readonly cell: readonly [number, number];
  readonly anchor: readonly [number, number];
  readonly anims: Readonly<Record<GolferAnim, AnimLayout>>;
}

export class GolferError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isNatural = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

const allRows = (n: number): Record<Dir, number> => Object.fromEntries(DIRS.map((d) => [d, n])) as Record<Dir, number>;

/** One-frame layout used when no golfer art has been ingested yet. */
export const PLACEHOLDER_ANIMS: GolferLayout['anims'] = {
  idle: { frames: 1, fps: 1, rows: allRows(0) },
  backswing: { frames: 1, fps: 1, rows: allRows(0) },
  stroke: { frames: 1, fps: 1, rows: allRows(0) },
  celebrate: { frames: 1, fps: 1, rows: allRows(0) },
};

function pair(v: unknown, field: string, ok: (n: unknown) => boolean): readonly [number, number] {
  if (Array.isArray(v) && v.length === 2 && v.every(ok)) return [v[0] as number, v[1] as number];
  throw new GolferError(`golfer: ${field} must be a pair of valid numbers`);
}

function parseAnim(name: GolferAnim, raw: unknown): AnimLayout {
  if (!isObj(raw) || !isPosInt(raw.frames) || !isPosInt(raw.fps) || !isObj(raw.rows)) {
    throw new GolferError(`golfer: anims.${name} needs frames, fps and rows`);
  }
  const rows = raw.rows;
  const parsed = Object.fromEntries(DIRS.map((d) => {
    if (!isNatural(rows[d])) throw new GolferError(`golfer: anims.${name}.rows.${d} must be a row number`);
    return [d, rows[d] as number];
  })) as Record<Dir, number>;
  return { frames: raw.frames, fps: raw.fps, rows: parsed };
}

export function parseGolfer(raw: unknown): GolferLayout {
  if (!isObj(raw)) throw new GolferError('golfer: must be an object');
  if (typeof raw.src !== 'string' || !/^[a-z0-9-]+\.png$/.test(raw.src)) throw new GolferError('golfer: src must be a .png file name');
  const anims = isObj(raw.anims) ? raw.anims : {};
  return {
    src: raw.src,
    cell: pair(raw.cell, 'cell', isPosInt),
    anchor: pair(raw.anchor, 'anchor', isNatural),
    anims: Object.fromEntries(GOLFER_ANIMS.map((a) => {
      if (!(a in anims)) throw new GolferError(`golfer: anims.${a} is missing`);
      return [a, parseAnim(a, anims[a])];
    })) as Record<GolferAnim, AnimLayout>,
  };
}
```

- [ ] **Step 6: Write `src/render/golfer-pose.ts`**

```ts
import type { Vec2 } from '../core/geometry';
import { aimAngle, chargePower, type GameState } from '../game/state';
import { DIRS, type AnimLayout, type Dir, type GolferAnim, type GolferLayout } from '../world/golfer';

/** How long the follow-through shows after release, seconds. */
export const STROKE_SECONDS = 0.35;
/** How far behind the ball the golfer stands, tiles. */
export const STANCE = 0.3;

export interface GolferPose {
  readonly anim: GolferAnim;
  readonly frame: number;
  readonly facing: Dir;
  /** Grid point under the golfer's feet. */
  readonly at: Vec2;
}

/** The 8-way screen direction a grid-space angle points (south = straight down the screen). */
export function screenDir(gridAngle: number): Dir {
  const c = Math.cos(gridAngle), s = Math.sin(gridAngle);
  const screenAngle = Math.atan2((c + s) / 2, c - s); // y grows downward
  const k = Math.round((screenAngle - Math.PI / 2) / (Math.PI / 4));
  return DIRS[((k % 8) + 8) % 8];
}

const behind = (p: Vec2, angle: number): Vec2 => [p[0] - Math.cos(angle) * STANCE, p[1] - Math.sin(angle) * STANCE];
const loop = (t: number, a: AnimLayout): number => Math.floor(t * a.fps) % a.frames;

export function golferPose(s: GameState, anims: GolferLayout['anims'], time: number): GolferPose | null {
  const p = s.phase;
  if (p.kind === 'aiming' || p.kind === 'charging') {
    const aim = aimAngle(s);
    const at = behind([s.ball.x, s.ball.y], aim);
    const facing = screenDir(aim);
    if (p.kind === 'aiming') return { anim: 'idle', frame: loop(time, anims.idle), facing, at };
    return { anim: 'backswing', frame: Math.round(chargePower(p.t) * (anims.backswing.frames - 1)), facing, at };
  }
  const at = behind(s.lastRest, s.aim);
  const facing = screenDir(s.aim);
  if (p.kind === 'rolling' && p.t < STROKE_SECONDS) {
    const n = anims.stroke.frames;
    return { anim: 'stroke', frame: Math.min(n - 1, Math.floor((p.t / STROKE_SECONDS) * n)), facing, at };
  }
  if (p.kind === 'holed') return { anim: 'celebrate', frame: loop(p.t, anims.celebrate), facing, at };
  return null;
}
```

- [ ] **Step 7: Run tests and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS. If tsc flags `def.placeholder` possibly being undefined in `src/render/renderer.ts` (Plan 1's renderer), make the smallest fix there: skip drawing a prop that has no placeholder. Task 11 rewrites the renderer.

- [ ] **Step 8: Commit**

```bash
git add src/world/manifest.ts src/world/golfer.ts src/render/golfer-pose.ts src/render/renderer.ts tests/unit/manifest.test.ts tests/unit/golfer.test.ts
git commit -m "feat: add manifest v2 (images, sway, light) and golfer layout and pose selection"
```

---

### Task 8: Terrain bake (dither, noise, fringe, pool rim, sides in order)

**Files:**
- Create: `src/render/terrain-bake.ts`, `src/render/assets.ts`
- Delete: `src/render/terrain-draw.ts`, `tests/unit/terrain-draw.test.ts`
- Modify: `src/main.ts` (use the bake)
- Test: `tests/unit/terrain-bake.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  RAMPS, WIND_FRAMES, bakeTerrain, bayer, hash2, insideConvex, rampLevel, valueNoise,
} from '../../src/render/terrain-bake';
import { project, viewFor } from '../../src/render/iso';
import { makeHole } from '../helpers/makeHole';

describe('pixel helpers', () => {
  it('bayer thresholds cover (0, 1)', () => {
    const v = Array.from({ length: 16 }, (_, i) => bayer(i % 4, Math.floor(i / 4)));
    expect(Math.min(...v)).toBeGreaterThan(0);
    expect(Math.max(...v)).toBeLessThan(1);
    expect(new Set(v).size).toBe(16);
  });
  it('hash2 and valueNoise are deterministic and in [0, 1)', () => {
    expect(hash2(3, 4, 1)).toBe(hash2(3, 4, 1));
    expect(hash2(3, 4, 1)).not.toBe(hash2(4, 3, 1));
    for (let i = 0; i < 50; i++) {
      const n = valueNoise(i * 1.7, i * 0.3, 6, 2);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
  it('rampLevel clamps and dithers', () => {
    expect(rampLevel(-1, 4, 0, 0)).toBe(0);
    expect(rampLevel(2, 4, 0, 0)).toBe(3);
    const mid = Array.from({ length: 16 }, (_, i) => rampLevel(0.5, 2, i % 4, Math.floor(i / 4)));
    expect(mid.filter((l) => l === 1)).toHaveLength(8); // 50% between two levels = half the pixels
  });
  it('insideConvex works for either winding', () => {
    const sq: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4]];
    expect(insideConvex(sq, 2, 2)).toBe(true);
    expect(insideConvex([...sq].reverse(), 2, 2)).toBe(true);
    expect(insideConvex(sq, 5, 2)).toBe(false);
  });
});

describe('bakeTerrain', () => {
  const rows = ['GGGG', 'GWWG', 'GGGG'];
  const hole = makeHole({ width: 4, depth: 3, rows, tee: [0.5, 0.5], cup: [3.5, 2.5] });
  const view = viewFor(hole, 360, 270);
  const bake = bakeTerrain(hole, view, 360, 270);
  const at = (frame: number, x: number, y: number) => {
    const i = (Math.round(y) * 360 + Math.round(x)) * 4;
    return [...bake.frames[frame].slice(i, i + 4)];
  };
  const inRamp = (ramp: readonly (readonly number[])[], c: number[]) => ramp.some((r) => r[0] === c[0] && r[1] === c[1] && r[2] === c[2]);

  it('makes one RGBA buffer per wind frame', () => {
    expect(bake.frames).toHaveLength(WIND_FRAMES);
    expect(bake.frames[0]).toHaveLength(360 * 270 * 4);
  });
  it('paints green tiles from the green ramp', () => {
    const [sx, sy] = project(view, 0.5, 0.5, 0);
    const c = at(0, sx, sy);
    expect(c[3]).toBe(255);
    expect(inRamp(RAMPS.G, c)).toBe(true);
  });
  it('paints water and records ground height', () => {
    const [sx, sy] = project(view, 2, 1.5, 0);
    expect(inRamp(RAMPS.W, at(0, sx, sy))).toBe(true);
    expect(bake.ground[Math.round(sy) * 360 + Math.round(sx)]).toBeCloseTo(0);
  });
  it('leaves far-away pixels transparent with no ground', () => {
    expect(at(0, 2, 2)[3]).toBe(0);
    expect(Number.isNaN(bake.ground[2 * 360 + 2])).toBe(true);
  });
  it('frays a grass fringe just outside the island', () => {
    const [sx, sy] = project(view, 2, 0, 0); // back edge
    let fringe = 0;
    for (let dy = 1; dy <= 4; dy++) for (let dx = -6; dx <= 6; dx++) if (at(0, sx + dx, sy - dy)[3] === 255) fringe++;
    expect(fringe).toBeGreaterThan(0);
  });
  it('is deterministic', () => {
    expect(bakeTerrain(hole, view, 360, 270).frames[1]).toEqual(bake.frames[1]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/terrain-bake.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/render/terrain-bake.ts`**

```ts
import type { Vec2 } from '../core/geometry';
import { heightAt } from '../physics/terrain';
import type { Hole, Surface } from '../world/hole';
import { project, unproject, type View } from './iso';
import { parseHex, type RGB } from './palette';

export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
/** Two wind frames: fringe tufts and water shimmer differ between them. */
export const WIND_FRAMES = 2;
/** How far below height 0 the island's earth sides hang, tiles. */
const BASE_Z = -0.5;
const FRINGE_RADIUS = 4;
const RIM_WIDTH = 2;

type Kind = 'G' | 'R' | 'S' | 'W' | 'sideL' | 'sideR';
const KINDS: readonly Kind[] = ['G', 'R', 'S', 'W', 'sideL', 'sideR'];
const TOP_KINDS = new Set([0, 1, 2]); // G, R, S: where the fringe grows from
const WATER = 3;

const hexes = (...h: string[]): RGB[] => h.map(parseHex);
export const RAMPS: Readonly<Record<Kind | 'fringe' | 'rim', readonly RGB[]>> = {
  G: hexes('#3f6b3a', '#4f8a4c', '#6fae5c', '#8fca6c', '#b5e08a'),
  R: hexes('#1f3a2c', '#2f5530', '#3f6b3a', '#5e8c45', '#8db35a'),
  S: hexes('#8a6a4a', '#b08a62', '#d9c08c', '#efe6d2'),
  W: hexes('#1d3b5c', '#2f6f9a', '#5aa7d0', '#9fd8ee'),
  sideL: hexes('#2e2420', '#4a3b2e', '#6b4f3a'),
  sideR: hexes('#14141c', '#2e2420', '#4a3b2e'),
  fringe: hexes('#1f3a2c', '#2f5530', '#3f6b3a', '#5e8c45'),
  rim: hexes('#c8463c', '#fffaf0'),
};

export interface TerrainBake {
  readonly width: number;
  readonly height: number;
  /** RGBA pixels, one buffer per wind frame. */
  readonly frames: readonly Uint8ClampedArray[];
  /** Ground height (tiles) under each pixel; NaN where there is no top surface. */
  readonly ground: Float32Array;
}

interface Buffers {
  readonly w: number;
  readonly h: number;
  readonly kind: Int8Array;
  readonly shade: Float32Array;
  readonly ground: Float32Array;
}

export const bayer = (x: number, y: number): number => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/** Deterministic pseudo-random value in [0, 1) for an integer pixel and seed. */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
export function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const sx = smooth(fx - x0), sy = smooth(fy - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Which of `levels` ramp steps a 0..1 value lands on, dithered by the pixel's Bayer threshold. */
export function rampLevel(v: number, levels: number, x: number, y: number): number {
  return Math.max(0, Math.min(levels - 1, Math.floor(v * (levels - 1) + bayer(x, y))));
}

/** True if (px, py) is inside a convex polygon of either winding. */
export function insideConvex(pts: readonly Vec2[], px: number, py: number): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function polyArea(pts: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

function fillPoly(buf: Buffers, pts: readonly Vec2[], kind: number, shade: number, groundAt: ((x: number, y: number) => number) | null): void {
  if (polyArea(pts) < 0.5) return; // degenerate: nothing to draw
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(buf.w - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(buf.h - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!insideConvex(pts, x + 0.5, y + 0.5)) continue;
      const i = y * buf.w + x;
      buf.kind[i] = kind;
      buf.shade[i] = shade;
      buf.ground[i] = groundAt ? groundAt(x + 0.5, y + 0.5) : Number.NaN;
    }
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function bakeCell(buf: Buffers, hole: Hole, view: View, x: number, y: number): void {
  const surface = hole.surface[y][x] as Surface;
  if (surface === 'X') return;
  const h = hole.heights;
  const h00 = h[y][x], h10 = h[y][x + 1], h01 = h[y + 1][x], h11 = h[y + 1][x + 1];
  const dhdx = (h10 - h00 + (h11 - h01)) / 2;
  const dhdy = (h01 - h00 + (h11 - h10)) / 2;
  const stripe = surface === 'G' ? ((x + y) % 2 === 0 ? 0.06 : -0.04) : 0;
  const shade = clamp01(0.55 + 0.6 * dhdx + 0.2 * dhdy + stripe);
  const meanZ = (h00 + h10 + h01 + h11) / 4;
  const groundAt = (sx: number, sy: number) => {
    const [gx, gy] = unproject(view, sx, sy, meanZ);
    return heightAt(hole, gx, gy);
  };
  const top = [project(view, x, y, h00), project(view, x + 1, y, h10), project(view, x + 1, y + 1, h11), project(view, x, y + 1, h01)];
  fillPoly(buf, top, KINDS.indexOf(surface), shade, groundAt);

  // This cell's own front-facing earth sides, drawn right after its top so nearer cells paint over them.
  const solid = (cx: number, cy: number) => cx >= hole.width || cy >= hole.depth || hole.surface[cy][cx] === 'X';
  if (solid(x, y + 1)) {
    fillPoly(buf, [project(view, x, y + 1, h01), project(view, x + 1, y + 1, h11), project(view, x + 1, y + 1, BASE_Z), project(view, x, y + 1, BASE_Z)], KINDS.indexOf('sideL'), 0.5, null);
  }
  if (solid(x + 1, y)) {
    fillPoly(buf, [project(view, x + 1, y, h10), project(view, x + 1, y + 1, h11), project(view, x + 1, y + 1, BASE_Z), project(view, x + 1, y, BASE_Z)], KINDS.indexOf('sideR'), 0.5, null);
  }
}

/** Distance (pixels) from each empty pixel to the nearest grass/sand top pixel, 0 if farther than the fringe radius. */
function fringeDistances(buf: Buffers): Float32Array {
  const out = new Float32Array(buf.w * buf.h);
  const r = FRINGE_RADIUS;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if (buf.kind[y * buf.w + x] >= 0) continue;
      let best = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= buf.h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= buf.w || !TOP_KINDS.has(buf.kind[yy * buf.w + xx])) continue;
          best = Math.min(best, Math.hypot(dx, dy));
        }
      }
      out[y * buf.w + x] = best <= r ? best : 0;
    }
  }
  return out;
}

/** True if a water pixel is within RIM_WIDTH of a non-water top pixel (the kiddie-pool rim). */
function onRim(buf: Buffers, x: number, y: number): boolean {
  for (let dy = -RIM_WIDTH; dy <= RIM_WIDTH; dy++) {
    for (let dx = -RIM_WIDTH; dx <= RIM_WIDTH; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= buf.w || yy >= buf.h) continue;
      if (TOP_KINDS.has(buf.kind[yy * buf.w + xx])) return true;
    }
  }
  return false;
}

function put(out: Uint8ClampedArray, i: number, c: RGB): void {
  out[i * 4] = c[0];
  out[i * 4 + 1] = c[1];
  out[i * 4 + 2] = c[2];
  out[i * 4 + 3] = 255;
}

function colorize(buf: Buffers, fringe: Float32Array, frame: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(buf.w * buf.h * 4);
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const i = y * buf.w + x;
      const k = buf.kind[i];
      if (k === WATER && onRim(buf, x, y)) {
        put(out, i, RAMPS.rim[((x + y) >> 2) & 1]);
      } else if (k >= 0) {
        const ramp = RAMPS[KINDS[k]];
        const water = k === WATER;
        const noise = valueNoise(x, y, water ? 5 : 7, water ? 3 + frame * 17 : 3) - 0.5;
        put(out, i, ramp[rampLevel(buf.shade[i] + noise * (water ? 0.5 : 0.3), ramp.length, x, y)]);
      } else if (fringe[i] > 0) {
        const p = 1 - fringe[i] / (FRINGE_RADIUS + 1);
        const sway = frame === 1 && hash2(x, y, 5) < 0.35 ? 1 : 0;
        if (hash2(x - sway, y, 11) < p * 0.85) put(out, i, RAMPS.fringe[rampLevel(p, RAMPS.fringe.length, x, y)]);
      }
    }
  }
  return out;
}

export function bakeTerrain(hole: Hole, view: View, width: number, height: number): TerrainBake {
  const n = width * height;
  const buf: Buffers = {
    w: width, h: height,
    kind: new Int8Array(n).fill(-1),
    shade: new Float32Array(n),
    ground: new Float32Array(n).fill(Number.NaN),
  };
  for (let s = 0; s <= hole.width + hole.depth - 2; s++) {
    for (let y = 0; y < hole.depth; y++) {
      const x = s - y;
      if (x >= 0 && x < hole.width) bakeCell(buf, hole, view, x, y);
    }
  }
  const fringe = fringeDistances(buf);
  const frames = Array.from({ length: WIND_FRAMES }, (_, f) => colorize(buf, fringe, f));
  return { width, height, frames, ground: buf.ground };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/terrain-bake.test.ts`
Expected: PASS. If the fringe or water test misses its pixel by one, check the projected coordinates with a quick `console.log` and fix the implementation, not the test.

- [ ] **Step 5: Create `src/render/assets.ts`** (DOM helpers; extended in Task 11)

```ts
import type { TerrainBake } from './terrain-bake';

/** One canvas per wind frame of a baked terrain. */
export function bakeToCanvases(bake: TerrainBake): HTMLCanvasElement[] {
  return bake.frames.map((pixels) => {
    const canvas = document.createElement('canvas');
    canvas.width = bake.width;
    canvas.height = bake.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not available');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), bake.width, bake.height), 0, 0);
    return canvas;
  });
}
```

- [ ] **Step 6: Switch `src/main.ts` to the bake and delete the old drawer**

In `src/main.ts`:
- Replace `import { drawTerrain } from './render/terrain-draw';` with:
  ```ts
  import { bakeToCanvases } from './render/assets';
  import { bakeTerrain } from './render/terrain-bake';
  ```
- In `loadContent`, replace the `terrains` line with:
  ```ts
    const terrains = holes.map((h, i) => bakeToCanvases(bakeTerrain(h, views[i], BUF_W, BUF_H))[0]);
  ```

Then run: `git rm src/render/terrain-draw.ts tests/unit/terrain-draw.test.ts`

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

Run `npm run dev` and open the game. Expected: dithered green with mown stripes, a ragged grass fringe around the islands, earth sides, and a red/white rim around hole 3's pool. Hole 2's notch side should no longer cover the green tile beside it. (Plan 1's flat fences are still drawn on top; Task 9 replaces them.)

- [ ] **Step 8: Commit**

```bash
git add -A src/render src/main.ts tests/unit
git commit -m "feat: bake dithered terrain with grass fringe, pool rim and correctly ordered earth sides"
```

---

### Task 9: Picket fences and correct fence draw order

Back fences, the ones behind the play area, are baked into the terrain because nothing in play ever goes behind them. Front fences are drawn per frame with depth set to their nearest end. Fences inside the play area use their midpoint.

**Files:**
- Create: `src/render/fences.ts`
- Modify: `src/render/terrain-bake.ts`
- Test: `tests/unit/fences.test.ts`, `tests/unit/terrain-bake.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

`tests/unit/fences.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FENCE_COLORS, classifyWall, picketPixels, wallDepth } from '../../src/render/fences';
import { depthOf, viewFor } from '../../src/render/iso';
import { makeHole } from '../helpers/makeHole';

const hole = makeHole({ width: 2, depth: 2, rows: ['GG', 'GX'], tee: [0.5, 0.5], cup: [1.5, 0.5], walls: [[[0.2, 0.2], [0.8, 0.8]]] });
const seg = (a: [number, number], b: [number, number]) => ({ a, b });

describe('classifyWall', () => {
  it('top and left outer edges are back walls', () => {
    expect(classifyWall(hole, seg([0, 0], [1, 0]))).toBe('back');
    expect(classifyWall(hole, seg([0, 0], [0, 1]))).toBe('back');
  });
  it('bottom, right and X-facing edges are front walls', () => {
    expect(classifyWall(hole, seg([0, 2], [1, 2]))).toBe('front');
    expect(classifyWall(hole, seg([2, 0], [2, 1]))).toBe('front');
    expect(classifyWall(hole, seg([1, 1], [2, 1]))).toBe('front'); // above the X tile
    expect(classifyWall(hole, seg([1, 1], [1, 2]))).toBe('front'); // left of the X tile
  });
  it('anything else is an inner wall', () => {
    expect(classifyWall(hole, seg([0.2, 0.2], [0.8, 0.8]))).toBe('inner');
  });
});

describe('wallDepth', () => {
  it('front walls sort at their nearest end, inner walls at their middle', () => {
    expect(wallDepth(seg([0, 2], [1, 2]), 'front')).toBe(depthOf(1, 2));
    expect(wallDepth(seg([0.2, 0.2], [0.8, 0.8]), 'inner')).toBe(depthOf(0.5, 0.5));
  });
});

describe('picketPixels', () => {
  it('draws posts and a rail above the wall line', () => {
    const view = viewFor(hole, 360, 270);
    const px = picketPixels(hole, view, seg([0, 0], [1, 0]));
    expect(px.length).toBeGreaterThan(20);
    expect(px.some((p) => p.color === FENCE_COLORS.post)).toBe(true);
    expect(px.some((p) => p.color === FENCE_COLORS.rail)).toBe(true);
    expect(px.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y))).toBe(true);
  });
});
```

Append to `tests/unit/terrain-bake.test.ts`, inside `describe('bakeTerrain', ...)`:
```ts
  it('bakes the back fence into the terrain', () => {
    const [sx, sy] = project(view, 2, 0, 0);
    const c = at(0, sx, sy - 3);
    expect([c[0], c[1], c[2]]).toEqual([0xef, 0xe6, 0xd2]);
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/fences.test.ts tests/unit/terrain-bake.test.ts`
Expected: FAIL. The fences module isn't found, and no fence is baked.

- [ ] **Step 3: Write `src/render/fences.ts`**

```ts
import type { Vec2 } from '../core/geometry';
import { heightAt } from '../physics/terrain';
import type { Hole, Segment } from '../world/hole';
import { depthOf, project, type View } from './iso';

export type WallSide = 'back' | 'front' | 'inner';

export const FENCE_COLORS = { post: '#efe6d2', postFoot: '#b08a62', rail: '#d9c08c' } as const;
const POST_H = 6;
const RAIL_LIFT = 4;
const POSTS_PER_TILE = 8;

export interface Px {
  readonly x: number;
  readonly y: number;
  /** #rrggbb */
  readonly color: string;
}

const isPlay = (hole: Hole, x: number, y: number) =>
  x >= 0 && y >= 0 && x < hole.width && y < hole.depth && hole.surface[y][x] !== 'X';

/** Back walls sit behind the play area, front walls in front of it; anything else is inner. */
export function classifyWall(hole: Hole, seg: Segment): WallSide {
  const [ax, ay] = seg.a;
  const [bx, by] = seg.b;
  if (ay === by && Number.isInteger(ay)) {
    const mx = Math.floor((ax + bx) / 2);
    const below = isPlay(hole, mx, ay), above = isPlay(hole, mx, ay - 1);
    if (below && !above) return 'back';
    if (above && !below) return 'front';
  } else if (ax === bx && Number.isInteger(ax)) {
    const my = Math.floor((ay + by) / 2);
    const right = isPlay(hole, ax, my), left = isPlay(hole, ax - 1, my);
    if (right && !left) return 'back';
    if (left && !right) return 'front';
  }
  return 'inner';
}

export function wallDepth(seg: Segment, side: WallSide): number {
  if (side === 'front') return Math.max(depthOf(seg.a[0], seg.a[1]), depthOf(seg.b[0], seg.b[1]));
  return depthOf((seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2);
}

/** Pixels of a little picket fence standing on a wall segment. */
export function picketPixels(hole: Hole, view: View, seg: Segment): Px[] {
  const [ax, ay] = seg.a;
  const [bx, by] = seg.b;
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) * POSTS_PER_TILE));
  const posts: Vec2[] = Array.from({ length: n + 1 }, (_, i) => {
    const gx = ax + ((bx - ax) * i) / n, gy = ay + ((by - ay) * i) / n;
    const [sx, sy] = project(view, gx, gy, heightAt(hole, gx, gy));
    return [Math.round(sx), Math.round(sy)];
  });
  const out: Px[] = [];
  for (const [x, y] of posts) {
    out.push({ x, y, color: FENCE_COLORS.postFoot });
    for (let k = 1; k < POST_H; k++) out.push({ x, y: y - k, color: FENCE_COLORS.post });
  }
  for (let i = 1; i < posts.length; i++) {
    const [x0, y0] = posts[i - 1];
    const [x1, y1] = posts[i];
    const steps = Math.max(1, Math.abs(x1 - x0));
    for (let j = 1; j < steps; j++) {
      out.push({ x: x0 + Math.sign(x1 - x0) * j, y: Math.round(y0 + ((y1 - y0) * j) / steps) - RAIL_LIFT, color: FENCE_COLORS.rail });
    }
  }
  return out;
}
```

- [ ] **Step 4: Bake back fences** — in `src/render/terrain-bake.ts`:

Add imports:
```ts
import { classifyWall, picketPixels } from './fences';
```

Add this function above `bakeTerrain`:
```ts
function plotFences(frames: readonly Uint8ClampedArray[], hole: Hole, view: View, width: number, height: number): void {
  const colors = new Map<string, RGB>();
  for (const seg of hole.walls) {
    if (classifyWall(hole, seg) !== 'back') continue;
    for (const p of picketPixels(hole, view, seg)) {
      if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) continue;
      const c = colors.get(p.color) ?? parseHex(p.color);
      colors.set(p.color, c);
      for (const f of frames) put(f, p.y * width + p.x, c);
    }
  }
}
```

In `bakeTerrain`, right after `const frames = ...`, add:
```ts
  plotFences(frames, hole, view, width, height);
```
(`frames` is freshly built inside this function, so writing into it here doesn't mutate any input.)

- [ ] **Step 5: Draw front and inner fences in the renderer** — in `src/render/renderer.ts`, replace the whole `walls` function with:

```ts
const fenceCache = new WeakMap<Hole, Drawable[]>();

function walls(f: Frame): Drawable[] {
  const cached = fenceCache.get(f.hole);
  if (cached) return cached;
  const items = f.hole.walls.flatMap((seg): Drawable[] => {
    const side = classifyWall(f.hole, seg);
    if (side === 'back') return []; // baked into the terrain
    const px = picketPixels(f.hole, f.view, seg);
    return [{ depth: wallDepth(seg, side), draw: (ctx) => plotPx(ctx, px) }];
  });
  fenceCache.set(f.hole, items);
  return items;
}

function plotPx(ctx: CanvasRenderingContext2D, px: readonly Px[]): void {
  for (const p of px) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 1, 1);
  }
}
```
Add `import { classifyWall, picketPixels, wallDepth, type Px } from './fences';`. Remove `FENCE_H`, `fence` and `fenceSide` from the colour table and constants if they're now unused.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

By eye (`npm run dev`): picket fences line every edge. Roll the ball along the back fence of hole 1; it should stay in front of the fence the whole time, with no flicker.

- [ ] **Step 7: Commit**

```bash
git add src/render tests/unit
git commit -m "feat: draw picket fences, baking back fences and sorting front ones by their nearest end"
```

---

### Task 10: Wind and lamp-light masks

**Files:**
- Create: `src/render/wind.ts`, `src/render/lights.ts`
- Test: `tests/unit/wind-lights.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { WIND_FPS, swayOffset, windStep } from '../../src/render/wind';
import { bakeLightMask, lampsOf, lightBand } from '../../src/render/lights';
import { bakeTerrain } from '../../src/render/terrain-bake';
import { project, viewFor } from '../../src/render/iso';
import { parseManifest } from '../../src/world/manifest';
import { parseHole } from '../../src/world/hole';
import { rawHole } from '../helpers/makeHole';

describe('wind', () => {
  it('steps at 8 fps between two frames', () => {
    expect(WIND_FPS).toBe(8);
    expect(windStep(0)).toBe(0);
    expect(windStep(1 / 8)).toBe(1);
    expect(windStep(2 / 8)).toBe(0);
  });
  it('sways only on step 1, by one pixel', () => {
    expect(swayOffset(0, [3, 4])).toBe(0);
    expect([1, -1]).toContain(swayOffset(1, [3, 4]));
  });
});

describe('lights', () => {
  it('bands get weaker with distance', () => {
    expect(lightBand(0.1, 2)).toBe(3);
    expect(lightBand(1.0, 2)).toBe(2);
    expect(lightBand(1.9, 2)).toBe(1);
    expect(lightBand(2.5, 2)).toBe(0);
  });

  const manifest = parseManifest({
    lamp: { placeholder: { color: '#000', w: 2, h: 20 }, light: { radius: 2 } },
    rock: { placeholder: { color: '#000', w: 4, h: 4 } },
  });
  const hole = parseHole(rawHole({ width: 8, depth: 5, props: [{ sprite: 'lamp', at: [4, 2.5] }, { sprite: 'rock', at: [1, 1] }] }), manifest, 'lit.json');

  it('lists only light-casting props', () => {
    expect(lampsOf(hole, manifest)).toEqual([{ at: [4, 2.5], radius: 2 }]);
  });

  it('masks pixels near a lamp brighter than far ones', () => {
    const view = viewFor(hole, 360, 270);
    const mask = bakeLightMask(bakeTerrain(hole, view, 360, 270), view, lampsOf(hole, manifest));
    const band = (gx: number, gy: number) => {
      const [sx, sy] = project(view, gx, gy, 0);
      return mask[Math.round(sy) * 360 + Math.round(sx)];
    };
    expect(band(4, 2.5)).toBe(3);
    expect(band(0.5, 0.5)).toBe(0);
    expect(mask[0]).toBe(0);
  });

  it('returns an empty mask without lamps', () => {
    const view = viewFor(hole, 360, 270);
    expect(bakeLightMask(bakeTerrain(hole, view, 360, 270), view, []).every((v) => v === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/wind-lights.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `src/render/wind.ts`**

```ts
import type { Vec2 } from '../core/geometry';

/** The wind ticks at 8 steps a second on purpose: it should feel hand-animated, not simulated. */
export const WIND_FPS = 8;

export function windStep(time: number): number {
  return Math.floor(time * WIND_FPS) % 2;
}

/** How far a swaying sprite's top half shifts this step; neighbouring props lean opposite ways. */
export function swayOffset(step: number, at: Vec2): -1 | 0 | 1 {
  if (step === 0) return 0;
  return (Math.floor(at[0] * 7 + at[1] * 13) & 1) === 0 ? 1 : -1;
}
```

- [ ] **Step 4: Write `src/render/lights.ts`**

```ts
import type { Vec2 } from '../core/geometry';
import type { Hole } from '../world/hole';
import type { Manifest } from '../world/manifest';
import { unproject, type View } from './iso';
import type { TerrainBake } from './terrain-bake';

export interface Lamp {
  readonly at: Vec2;
  readonly radius: number;
}

/** Hard light bands, so pools read as pixel art rather than an airbrush. */
export function lightBand(dist: number, radius: number): number {
  if (dist < radius * 0.4) return 3;
  if (dist < radius * 0.7) return 2;
  if (dist < radius) return 1;
  return 0;
}

export function lampsOf(hole: Hole, manifest: Manifest): Lamp[] {
  return hole.props.flatMap((p) => {
    const light = manifest[p.sprite].light;
    return light ? [{ at: p.at, radius: light.radius }] : [];
  });
}

/** Light band (0..3) per buffer pixel, from the ground under it; 0 where there's no ground. */
export function bakeLightMask(bake: TerrainBake, view: View, lamps: readonly Lamp[]): Uint8Array {
  const mask = new Uint8Array(bake.width * bake.height);
  if (lamps.length === 0) return mask;
  for (let y = 0; y < bake.height; y++) {
    for (let x = 0; x < bake.width; x++) {
      const z = bake.ground[y * bake.width + x];
      if (Number.isNaN(z)) continue;
      const [gx, gy] = unproject(view, x + 0.5, y + 0.5, z);
      let band = 0;
      for (const l of lamps) band = Math.max(band, lightBand(Math.hypot(gx - l.at[0], gy - l.at[1]), l.radius));
      mask[y * bake.width + x] = band;
    }
  }
  return mask;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/unit/wind-lights.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/render/wind.ts src/render/lights.ts tests/unit/wind-lights.test.ts
git commit -m "feat: add the 8 fps wind step and baked lamp-light masks"
```

---

### Task 11: Async content, renderer v2 and the post pass in the game

**Files:**
- Create: `src/content.ts`
- Modify: `src/render/assets.ts`, `src/style.css`
- Rewrite: `src/render/renderer.ts`, `src/main.ts`

- [ ] **Step 1: Extend `src/render/assets.ts`** — append:

```ts
import type { Manifest } from '../world/manifest';

const SPRITE_URLS = import.meta.glob('../../assets/sprites/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function spriteUrl(file: string): string | undefined {
  return SPRITE_URLS[`../../assets/sprites/${file}`];
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load image ${url}`));
    img.src = url;
  });
}

/** Loads every manifest sprite that has an image. A listed image with no file is an error. */
export async function loadSprites(manifest: Manifest): Promise<Map<string, HTMLImageElement>> {
  const entries = await Promise.all(Object.entries(manifest).flatMap(([name, def]) => {
    if (!def.image) return [];
    const url = spriteUrl(def.image.src);
    if (!url) throw new Error(`manifest: ${name}.image file assets/sprites/${def.image.src} is missing`);
    return [loadImage(url).then((img) => [name, img] as const)];
  }));
  return new Map(entries);
}
```
(Move the new `import` line to the top of the file with the other import.)

- [ ] **Step 2: Create `src/content.ts`**

```ts
import manifestJson from '../assets/manifest.json';
import paletteJson from '../assets/palette.json';
import hole1 from './world/holes/01.json';
import hole2 from './world/holes/02.json';
import hole3 from './world/holes/03.json';
import { bakeToCanvases, loadImage, loadSprites, spriteUrl } from './render/assets';
import { viewFor, type View } from './render/iso';
import { bakeLightMask, lampsOf } from './render/lights';
import { createPalette, type Palette } from './render/palette';
import { bakeTerrain } from './render/terrain-bake';
import { parseGolfer, type GolferLayout } from './world/golfer';
import { parseHole, type Hole } from './world/hole';
import { parseManifest, type Manifest } from './world/manifest';

export const BUF_W = 360;
export const BUF_H = 270;

const GOLFER_JSON = import.meta.glob('../assets/golfer.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export interface HoleContent {
  readonly hole: Hole;
  readonly view: View;
  /** One canvas per wind frame. */
  readonly terrain: readonly HTMLCanvasElement[];
  readonly light: Uint8Array;
}

export interface GolferArt {
  readonly layout: GolferLayout;
  readonly image: HTMLImageElement;
}

export interface Content {
  readonly manifest: Manifest;
  readonly palette: Palette;
  readonly holes: readonly Hole[];
  readonly perHole: readonly HoleContent[];
  readonly sprites: ReadonlyMap<string, HTMLImageElement>;
  readonly golfer: GolferArt | null;
}

async function loadGolfer(): Promise<GolferArt | null> {
  const raw = Object.values(GOLFER_JSON)[0];
  if (raw === undefined) return null; // no golfer art ingested yet: placeholder golfer
  const layout = parseGolfer(raw);
  const url = spriteUrl(layout.src);
  if (!url) throw new Error(`golfer: assets/sprites/${layout.src} is missing`);
  return { layout, image: await loadImage(url) };
}

export async function loadContent(): Promise<Content> {
  const manifest = parseManifest(manifestJson);
  const palette = createPalette(paletteJson);
  const holes = [hole1, hole2, hole3].map((raw, i) => parseHole(raw, manifest, `holes/0${i + 1}.json`));
  const perHole = holes.map((hole) => {
    const view = viewFor(hole, BUF_W, BUF_H);
    const bake = bakeTerrain(hole, view, BUF_W, BUF_H);
    return { hole, view, terrain: bakeToCanvases(bake), light: bakeLightMask(bake, view, lampsOf(hole, manifest)) };
  });
  const [sprites, golfer] = await Promise.all([loadSprites(manifest), loadGolfer()]);
  return { manifest, palette, holes, perHole, sprites, golfer };
}
```

- [ ] **Step 3: Rewrite `src/render/renderer.ts`**

```ts
import type { Vec2 } from '../core/geometry';
import { aimAngle, type GameState } from '../game/state';
import { heightAt } from '../physics/terrain';
import { PLACEHOLDER_ANIMS, type GolferLayout } from '../world/golfer';
import type { Hole } from '../world/hole';
import type { Manifest, SpriteImage } from '../world/manifest';
import { classifyWall, picketPixels, wallDepth, type Px } from './fences';
import { golferPose, type GolferPose } from './golfer-pose';
import { depthOf, project, sortByDepth, type View } from './iso';
import type { PhaseLook } from './time-of-day';
import { swayOffset } from './wind';

export interface Frame {
  readonly state: GameState;
  readonly hole: Hole;
  readonly view: View;
  readonly terrain: CanvasImageSource;
  readonly manifest: Manifest;
  readonly sprites: ReadonlyMap<string, HTMLImageElement>;
  readonly golfer: { readonly layout: GolferLayout; readonly image: HTMLImageElement } | null;
  readonly look: PhaseLook;
  readonly time: number;
  /** Current wind step (0 or 1). */
  readonly wind: number;
  readonly width: number;
  readonly height: number;
}

interface Drawable {
  readonly depth: number;
  draw(ctx: CanvasRenderingContext2D): void;
}

const COLORS = {
  bg: '#2c2c3a', ball: '#fffaf0', cup: '#14141c', shadow: 'rgba(20,20,28,0.35)',
  pole: '#efe6d2', flag: '#c8463c', aim: '#fffaf0', aimShadow: 'rgba(20,20,28,0.6)',
  shirt: '#2f6f9a', legs: '#4a3b2e', skin: '#e7b98f', propSide: 'rgba(20,20,28,0.25)',
} as const;
const AIM_DOTS = 6;
const AIM_SPACING = 0.3;

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

const ground = (f: Frame, x: number, y: number, lift = 0): Vec2 => project(f.view, x, y, heightAt(f.hole, x, y) + lift);

/** A soft drop shadow at a sprite's foot, thrown the way the phase's light falls. */
function shadow(ctx: CanvasRenderingContext2D, f: Frame, sx: number, sy: number, w: number, h: number): void {
  const dx = f.look.shadow[0] * h * 0.5, dy = f.look.shadow[1] * h * 0.5;
  ctx.fillStyle = COLORS.shadow;
  ctx.beginPath();
  ctx.ellipse(Math.round(sx + dx / 2), Math.round(sy + dy / 2), Math.max(2, w * 0.35), Math.max(1, w * 0.15), 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws a sprite with its anchor on (sx, sy); the top half shifts by `sway` pixels. */
function drawImageSprite(ctx: CanvasRenderingContext2D, img: HTMLImageElement, image: SpriteImage, sx: number, sy: number, sway: number): void {
  const x = Math.round(sx - image.anchor[0]), y = Math.round(sy - image.anchor[1]);
  const split = Math.floor(img.height / 2);
  ctx.drawImage(img, 0, split, img.width, img.height - split, x, y + split, img.width, img.height - split);
  ctx.drawImage(img, 0, 0, img.width, split, x + sway, y, img.width, split);
}

const fenceCache = new WeakMap<Hole, Drawable[]>();

function plotPx(ctx: CanvasRenderingContext2D, px: readonly Px[]): void {
  for (const p of px) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 1, 1);
  }
}

function walls(f: Frame): Drawable[] {
  const cached = fenceCache.get(f.hole);
  if (cached) return cached;
  const items = f.hole.walls.flatMap((seg): Drawable[] => {
    const side = classifyWall(f.hole, seg);
    if (side === 'back') return [];
    const px = picketPixels(f.hole, f.view, seg);
    return [{ depth: wallDepth(seg, side), draw: (ctx) => plotPx(ctx, px) }];
  });
  fenceCache.set(f.hole, items);
  return items;
}

function props(f: Frame): Drawable[] {
  return f.hole.props.map((p) => {
    const def = f.manifest[p.sprite];
    const img = f.sprites.get(p.sprite);
    const [sx, sy] = ground(f, p.at[0], p.at[1]);
    const sway = def.sway ? swayOffset(f.wind, p.at) : 0;
    return {
      depth: depthOf(p.at[0], p.at[1]),
      draw: (ctx) => {
        if (img && def.image) {
          shadow(ctx, f, sx, sy, img.width, img.height);
          drawImageSprite(ctx, img, def.image, sx, sy, sway);
        } else if (def.placeholder) {
          const { color, w, h } = def.placeholder;
          shadow(ctx, f, sx, sy, w, h);
          rect(ctx, sx - w / 2, sy - h, w, h, color);
          rect(ctx, sx, sy - h, Math.ceil(w / 2), h, COLORS.propSide);
        }
      },
    };
  });
}

function flag(f: Frame): Drawable {
  const [cx, cy] = f.hole.cup;
  const [sx, sy] = ground(f, cx, cy);
  return {
    depth: depthOf(cx, cy) + 0.01,
    draw: (ctx) => {
      rect(ctx, sx, sy - 16, 1, 16, COLORS.pole);
      rect(ctx, sx + 1, sy - 16 + (f.wind ? 1 : 0), 6, 4, COLORS.flag);
    },
  };
}

function ball(f: Frame): Drawable[] {
  if (f.state.phase.kind === 'holed') return [];
  const b = f.state.ball;
  const [gx, gy] = ground(f, b.x, b.y);
  const [bx, by] = project(f.view, b.x, b.y, b.z);
  return [{
    depth: depthOf(b.x, b.y, b.z),
    draw: (ctx) => {
      rect(ctx, gx - 1, gy, 3, 1, COLORS.shadow);
      rect(ctx, bx - 1, by - 2, 2, 2, COLORS.ball);
    },
  }];
}

function drawGolfer(ctx: CanvasRenderingContext2D, f: Frame, pose: GolferPose, sx: number, sy: number): void {
  if (!f.golfer) {
    shadow(ctx, f, sx, sy, 6, 17);
    rect(ctx, sx - 2, sy - 6, 4, 6, COLORS.legs);
    rect(ctx, sx - 3, sy - 13, 6, 7, COLORS.shirt);
    rect(ctx, sx - 2, sy - 17, 4, 4, COLORS.skin);
    return;
  }
  const { cell: [cw, ch], anchor: [ax, ay], anims } = f.golfer.layout;
  const row = anims[pose.anim].rows[pose.facing];
  shadow(ctx, f, sx, sy, cw * 0.5, ch * 0.6);
  ctx.drawImage(f.golfer.image, pose.frame * cw, row * ch, cw, ch, Math.round(sx - ax), Math.round(sy - ay), cw, ch);
}

function golfer(f: Frame): Drawable[] {
  const pose = golferPose(f.state, f.golfer?.layout.anims ?? PLACEHOLDER_ANIMS, f.time);
  if (!pose) return [];
  const [sx, sy] = ground(f, pose.at[0], pose.at[1]);
  return [{ depth: depthOf(pose.at[0], pose.at[1]), draw: (ctx) => drawGolfer(ctx, f, pose, sx, sy) }];
}

function drawCup(ctx: CanvasRenderingContext2D, f: Frame): void {
  const [sx, sy] = ground(f, f.hole.cup[0], f.hole.cup[1]);
  ctx.fillStyle = COLORS.cup;
  ctx.beginPath();
  ctx.ellipse(Math.round(sx), Math.round(sy), 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAim(ctx: CanvasRenderingContext2D, f: Frame): void {
  const k = f.state.phase.kind;
  if (k !== 'aiming' && k !== 'charging') return;
  const b = f.state.ball;
  const aim = aimAngle(f.state);
  for (let i = 1; i <= AIM_DOTS; i++) {
    const d = i * AIM_SPACING;
    const [sx, sy] = ground(f, b.x + Math.cos(aim) * d, b.y + Math.sin(aim) * d);
    rect(ctx, sx, sy + 1, 1, 1, COLORS.aimShadow);
    rect(ctx, sx, sy, 1, 1, COLORS.aim);
  }
}

export function renderFrame(ctx: CanvasRenderingContext2D, f: Frame): void {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, f.width, f.height);
  ctx.drawImage(f.terrain, 0, 0);
  drawCup(ctx, f);
  for (const d of sortByDepth([...walls(f), ...props(f), flag(f), ...ball(f), ...golfer(f)])) d.draw(ctx);
  drawAim(ctx, f);
}
```

- [ ] **Step 4: Rewrite `src/main.ts`**

```ts
import './style.css';
import { BUF_H, BUF_W, loadContent, type Content } from './content';
import { attachInput, type InputEvent } from './core/input';
import { createStepper, startLoop } from './core/loop';
import { loadBest, saveBest, totalStrokes, type KeyValueStore } from './game/score';
import { clearEvents, initialState, reduce, update, type Action, type GameState } from './game/state';
import { STEP } from './physics/constants';
import { unproject } from './render/iso';
import { buildPhaseTables, postProcess, type PhaseTables } from './render/post';
import { renderFrame } from './render/renderer';
import { PHASES, phaseFor, type PhaseId } from './render/time-of-day';
import { windStep } from './render/wind';
import { createHud, type Hud } from './ui/hud';

const LOAD_ERROR = "Couldn't load the Backyard — try refreshing";
const PHASE_CHECK_MS = 60_000;

function safeStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function fitCanvas(canvas: HTMLCanvasElement): void {
  const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / BUF_W, window.innerHeight / BUF_H)));
  canvas.style.width = `${BUF_W * scale}px`;
  canvas.style.height = `${BUF_H * scale}px`;
}

const currentPhase = (): PhaseId => phaseFor(window.location.search, new Date().getHours());

function wireInput(canvas: HTMLCanvasElement, content: Content, getState: () => GameState | null, dispatch: (a: Action) => void): void {
  const onInput = (e: InputEvent) => {
    const state = getState();
    if (!state) return;
    if (e.type === 'escape') dispatch({ type: 'togglePause' });
    else if (e.type === 'aimAt') dispatch({ type: 'aimAt', point: unproject(content.perHole[state.holeIndex].view, e.sx, e.sy, state.ball.z) });
    else dispatch({ type: e.type });
  };
  attachInput(canvas, BUF_W, BUF_H, onInput);
  // A release that happens while the window is unfocused never arrives: drop the charge instead.
  window.addEventListener('blur', () => dispatch({ type: 'cancel' }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) dispatch({ type: 'cancel' });
  });
}

function runGame(ctx: CanvasRenderingContext2D, content: Content, hud: Hud, canvas: HTMLCanvasElement): void {
  let state: GameState = initialState(content.holes);
  const dispatch = (a: Action) => {
    state = reduce(state, a, content.holes);
  };
  hud.setCallbacks({ onPlay: () => dispatch({ type: 'start' }), onResume: () => dispatch({ type: 'resume' }), onRestart: () => dispatch({ type: 'start' }) });
  wireInput(canvas, content, () => state, dispatch);

  const tables = new Map<PhaseId, PhaseTables>();
  const tablesFor = (id: PhaseId) => tables.get(id) ?? tables.set(id, buildPhaseTables(content.palette, PHASES[id])).get(id)!;
  let phase = currentPhase();
  document.body.dataset.phase = phase;
  window.setInterval(() => {
    phase = currentPhase();
    document.body.dataset.phase = phase;
  }, PHASE_CHECK_MS);

  const storage = safeStorage();
  let best = loadBest(storage);
  let prevKind = state.phase.kind;
  let time = 0;
  const steps = createStepper(STEP);

  const frame = (dt: number) => {
    time += dt;
    const n = steps(dt);
    for (let i = 0; i < n; i++) state = update(state, STEP, content.holes);
    if (state.phase.kind === 'scorecard' && prevKind !== 'scorecard') best = saveBest(storage, totalStrokes(state.strokes));
    prevKind = state.phase.kind;
    const h = content.perHole[state.holeIndex];
    const look = PHASES[phase];
    const wind = windStep(time);
    renderFrame(ctx, {
      state, hole: h.hole, view: h.view, terrain: h.terrain[wind], manifest: content.manifest,
      sprites: content.sprites, golfer: content.golfer, look, time, wind, width: BUF_W, height: BUF_H,
    });
    postProcess(ctx, BUF_W, BUF_H, content.palette.lut, tablesFor(phase), look.lamps ? h.light : null);
    hud.update(state, content.holes, best);
    // Ball events accumulate across this frame's substeps; once read (audio, Task 19), drop them.
    state = clearEvents(state);
  };
  const stop = startLoop((dt) => {
    try {
      frame(dt);
    } catch (err) {
      console.error('Game loop stopped after an error:', err);
      hud.showError(LOAD_ERROR);
      stop();
    }
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __minigolf: unknown }).__minigolf = {
      getState: () => state,
      putt: (angle: number, power: number) => dispatch({ type: 'putt', angle, power }),
    };
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hud = createHud(document.getElementById('hud') as HTMLElement);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    console.error('2D canvas is not available');
    hud.showError(LOAD_ERROR);
    return;
  }
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  try {
    runGame(ctx, await loadContent(), hud, canvas);
  } catch (err) {
    console.error('Failed to load course data:', err);
    hud.showError(LOAD_ERROR);
  }
}

void boot();
```

- [ ] **Step 5: Let the HUD take callbacks after creation** — in `src/ui/hud.ts`:

- Change the `Hud` interface to add:
  ```ts
  setCallbacks(cb: HudCallbacks): void;
  ```
- Change `export function createHud(root: HTMLElement, cb: HudCallbacks): Hud {` to:
  ```ts
  export function createHud(root: HTMLElement): Hud {
    let cb: HudCallbacks = { onPlay: () => {}, onResume: () => {}, onRestart: () => {} };
  ```
- Change the three `button(...)` calls to wrap the callback so it's looked up at click time: `button('Play', () => cb.onPlay())`, `button('Resume', () => cb.onResume())`, `button('Restart course', () => cb.onRestart())`, `button('Play again', () => cb.onPlay())`.
- Add to the returned object:
  ```ts
      setCallbacks(next) {
        cb = next;
      },
  ```

- [ ] **Step 6: Page colour per phase** — append to `src/style.css`:

```css
body[data-phase="morning"] { --bg: #2c2c3a; }
body[data-phase="day"] { --bg: #2c2c3a; }
body[data-phase="dusk"] { --bg: #2a2450; }
body[data-phase="night"] { --bg: #14141c; }
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm test && npm run e2e`
Expected: all PASS.

By eye, run `npm run dev` and open each of `/?phase=morning`, `/?phase=day`, `/?phase=dusk`, `/?phase=night`:
- every pixel snaps to the palette (no smooth gradients)
- the grade changes per phase
- at dusk and night, banded warm pools sit around the lamp props on holes 2 and 3
- fringe tufts, the flag and the pool shimmer step at 8 fps
- shadows fall in a different direction each phase

The game still plays exactly as before.

- [ ] **Step 8: Commit**

```bash
git add src/content.ts src/render src/main.ts src/ui/hud.ts src/style.css
git commit -m "feat: async content loading, sprite renderer with shadows and sway, palette post pass in play"
```

---

### Task 12: Debug page — every hole at every phase

**Files:** Create: `debug.html`, `src/debug.ts`

- [ ] **Step 1: Create `debug.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Backyard — look check</title>
    <style>
      body { margin: 16px; background: #14141c; color: #efe6d2; font: 12px ui-monospace, monospace; }
      .grid { display: grid; grid-template-columns: repeat(4, 720px); gap: 12px; }
      canvas { width: 720px; height: 540px; image-rendering: pixelated; display: block; }
    </style>
  </head>
  <body>
    <div id="grid" class="grid"></div>
    <script type="module" src="/src/debug.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/debug.ts`**

```ts
import { BUF_H, BUF_W, loadContent } from './content';
import { initialState, type GameState } from './game/state';
import { restingBall } from './physics/ball';
import { buildPhaseTables, postProcess } from './render/post';
import { renderFrame } from './render/renderer';
import { PHASES, PHASE_IDS } from './render/time-of-day';

async function main(): Promise<void> {
  const content = await loadContent();
  const grid = document.getElementById('grid') as HTMLElement;
  content.perHole.forEach((h, i) => {
    const atTee: GameState = {
      ...initialState(content.holes), holeIndex: i, phase: { kind: 'aiming' }, aim: 0,
      ball: restingBall(h.hole, h.hole.tee),
    };
    for (const id of PHASE_IDS) {
      const canvas = document.createElement('canvas');
      canvas.width = BUF_W;
      canvas.height = BUF_H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('2D canvas is not available');
      const look = PHASES[id];
      renderFrame(ctx, {
        state: atTee, hole: h.hole, view: h.view, terrain: h.terrain[0], manifest: content.manifest,
        sprites: content.sprites, golfer: content.golfer, look, time: 0, wind: 0, width: BUF_W, height: BUF_H,
      });
      postProcess(ctx, BUF_W, BUF_H, content.palette.lut, buildPhaseTables(content.palette, look), look.lamps ? h.light : null);
      const fig = document.createElement('figure');
      fig.style.margin = '0';
      const label = document.createElement('figcaption');
      label.textContent = `${h.hole.name} · ${id}`;
      fig.append(label, canvas);
      grid.append(fig);
    }
  });
}

main().catch((err) => {
  console.error(err);
  document.body.textContent = `Debug page failed: ${String(err)}`;
});
```

- [ ] **Step 3: Verify**

Run `npm run dev` and open `/debug.html`. Expected: 12 panels (3 holes × 4 phases) with labels and no console errors. Run `npx tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add debug.html src/debug.ts
git commit -m "feat: add a debug page showing every hole at every time of day"
```

---

## Phase C — PixelLab art

### Task 13: Ingest tooling and the asset check

**Files:**
- Modify: `package.json`, `.gitignore`
- Create: `scripts/lib/sprite-tools.ts`, `scripts/ingest.ts`
- Test: `tests/unit/sprite-tools.test.ts`, `tests/unit/assets.test.ts`

- [ ] **Step 1: Install pngjs and add the script**

Run: `npm install -D pngjs@^7 @types/pngjs@^6`

Add to `package.json` `"scripts"`:
```json
    "ingest": "vite-node scripts/ingest.ts"
```

Append to `.gitignore`:
```
assets/raw/
```

- [ ] **Step 2: Write the failing test `tests/unit/sprite-tools.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { blank, blit, bottomCenter, opaqueBounds, packRows, snapToPalette, trim, type Bitmap } from '../../scripts/lib/sprite-tools';
import type { RGB } from '../../src/render/palette';

const colors: RGB[] = [[0, 0, 0], [255, 255, 255], [200, 50, 50]];
function withPixels(w: number, h: number, pts: [number, number, RGB, number?][]): Bitmap {
  const b = blank(w, h);
  const data = new Uint8Array(b.data);
  for (const [x, y, c, a = 255] of pts) data.set([...c, a], (y * w + x) * 4);
  return { ...b, data };
}

describe('snapToPalette', () => {
  it('snaps colours and makes alpha binary', () => {
    const b = snapToPalette(withPixels(3, 1, [[0, 0, [210, 40, 60]], [1, 0, [250, 250, 250], 100], [2, 0, [10, 10, 10], 200]]), colors);
    expect([...b.data.slice(0, 4)]).toEqual([200, 50, 50, 255]);
    expect(b.data[7]).toBe(0);
    expect([...b.data.slice(8, 12)]).toEqual([0, 0, 0, 255]);
  });
});

describe('bounds, trim and anchor', () => {
  const b = withPixels(10, 10, [[3, 2, colors[1]], [6, 7, colors[1]]]);
  it('finds opaque bounds (exclusive max)', () => {
    expect(opaqueBounds(b)).toEqual({ x0: 3, y0: 2, x1: 7, y1: 8 });
    expect(opaqueBounds(blank(4, 4))).toBeNull();
  });
  it('trims to the bounds plus padding', () => {
    const t = trim(b, 1);
    expect([t.width, t.height]).toEqual([6, 8]);
    expect(opaqueBounds(t)).toEqual({ x0: 1, y0: 1, x1: 5, y1: 7 });
  });
  it('anchors at the bottom centre of the opaque area', () => {
    expect(bottomCenter(b)).toEqual([5, 8]);
  });
});

describe('blit and packRows', () => {
  it('blit copies only opaque pixels and clips', () => {
    const out = blit(blank(2, 2), withPixels(2, 2, [[1, 1, colors[2]]]), 1, 1);
    expect(out.data.every((v) => v === 0)).toBe(true); // copied pixel lands at (2,2): clipped
  });
  it('packs rows bottom-aligned into equal cells', () => {
    const a = withPixels(8, 8, [[2, 5, colors[1]], [2, 6, colors[1]]]);
    const b = withPixels(12, 12, [[6, 9, colors[1]]]);
    const sheet = packRows([[a, a], [b]]);
    expect(sheet.cell[0]).toBeGreaterThanOrEqual(3);
    expect(sheet.bitmap.width).toBe(sheet.cell[0] * 2);
    expect(sheet.bitmap.height).toBe(sheet.cell[1] * 2);
    // every row's lowest opaque pixel sits on the row just above the anchor line
    const lowest = (row: number) => {
      const cell = { ...sheet.bitmap };
      let y = -1;
      for (let yy = row * sheet.cell[1]; yy < (row + 1) * sheet.cell[1]; yy++) {
        for (let xx = 0; xx < sheet.cell[0]; xx++) if (cell.data[(yy * cell.width + xx) * 4 + 3]) y = yy - row * sheet.cell[1];
      }
      return y;
    };
    expect(lowest(0)).toBe(sheet.anchor[1] - 1);
    expect(lowest(1)).toBe(sheet.anchor[1] - 1);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/unit/sprite-tools.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Write `scripts/lib/sprite-tools.ts`**

```ts
import { nearestIndex, type RGB } from '../../src/render/palette';

export interface Bitmap {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major. */
  readonly data: Uint8Array;
}

export interface Bounds { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

export interface Sheet {
  readonly bitmap: Bitmap;
  readonly cell: [number, number];
  readonly anchor: [number, number];
}

export const blank = (width: number, height: number): Bitmap => ({ width, height, data: new Uint8Array(width * height * 4) });

const alphaAt = (b: Bitmap, x: number, y: number) => b.data[(y * b.width + x) * 4 + 3];

export function snapToPalette(b: Bitmap, colors: readonly RGB[]): Bitmap {
  const data = new Uint8Array(b.data.length);
  for (let i = 0; i < data.length; i += 4) {
    if (b.data[i + 3] < 128) continue; // transparent stays (0,0,0,0)
    const c = colors[nearestIndex(colors, [b.data[i], b.data[i + 1], b.data[i + 2]])];
    data.set([c[0], c[1], c[2], 255], i);
  }
  return { ...b, data };
}

export function opaqueBounds(b: Bitmap): Bounds | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      if (!alphaAt(b, x, y)) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export function crop(b: Bitmap, x: number, y: number, w: number, h: number): Bitmap {
  const out = blank(w, h);
  return blit(out, b, -x, -y);
}

export function trim(b: Bitmap, pad = 1): Bitmap {
  const r = opaqueBounds(b);
  if (!r) return blank(1, 1);
  return crop(b, r.x0 - pad, r.y0 - pad, r.x1 - r.x0 + pad * 2, r.y1 - r.y0 + pad * 2);
}

export function bottomCenter(b: Bitmap): [number, number] {
  const r = opaqueBounds(b);
  return r ? [Math.floor((r.x0 + r.x1) / 2), r.y1] : [Math.floor(b.width / 2), b.height];
}

/** Copies src's opaque pixels onto a copy of dst at (dx, dy), clipping at dst's edges. */
export function blit(dst: Bitmap, src: Bitmap, dx: number, dy: number): Bitmap {
  const data = new Uint8Array(dst.data);
  for (let y = 0; y < src.height; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.width || !alphaAt(src, x, y)) continue;
      const s = (y * src.width + x) * 4;
      data.set(src.data.subarray(s, s + 4), (ty * dst.width + tx) * 4);
    }
  }
  return { ...dst, data };
}

function unionBounds(frames: readonly Bitmap[]): Bounds | null {
  return frames.map(opaqueBounds).reduce<Bounds | null>((acc, r) => {
    if (!r) return acc;
    if (!acc) return r;
    return { x0: Math.min(acc.x0, r.x0), y0: Math.min(acc.y0, r.y0), x1: Math.max(acc.x1, r.x1), y1: Math.max(acc.y1, r.y1) };
  }, null);
}

/**
 * Packs rows of frames into a sheet of equal cells. Each row is aligned as a group (its union's
 * bottom-centre lands on the cell anchor) so motion inside an animation is kept.
 */
export function packRows(rows: readonly (readonly Bitmap[])[]): Sheet {
  const groups = rows.map(unionBounds);
  const cw = Math.max(1, ...groups.map((g) => (g ? g.x1 - g.x0 : 0))) + 2;
  const ch = Math.max(1, ...groups.map((g) => (g ? g.y1 - g.y0 : 0))) + 2;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const anchor: [number, number] = [Math.floor(cw / 2), ch - 1];
  let sheet = blank(cw * cols, ch * rows.length);
  rows.forEach((frames, r) => {
    const g = groups[r];
    if (!g) return;
    const ox = anchor[0] - Math.floor((g.x0 + g.x1) / 2);
    const oy = anchor[1] - g.y1;
    frames.forEach((frame, c) => {
      const cell = blit(blank(cw, ch), frame, ox, oy);
      sheet = blit(sheet, cell, c * cw, r * ch);
    });
  });
  return { bitmap: sheet, cell: [cw, ch], anchor };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/unit/sprite-tools.test.ts`
Expected: PASS.

- [ ] **Step 6: Write `scripts/ingest.ts`**

```ts
// Usage:
//   npm run ingest -- object <name> <png>   → assets/sprites/<name>.png + manifest image/anchor
//   npm run ingest -- ui <name> <png>       → assets/ui/<name>.png
//   npm run ingest -- golfer <dir>          → assets/sprites/golfer.png + assets/golfer.json
//     <dir> is an extracted PixelLab character ZIP: <dir>/<state>/animations/<anim>/<direction>/frame_NNN.png
//     with animations named idle, backswing, stroke, celebrate.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import paletteJson from '../assets/palette.json';
import { parsePalette } from '../src/render/palette';
import { DIRS, GOLFER_ANIMS, type GolferAnim } from '../src/world/golfer';
import { bottomCenter, packRows, snapToPalette, trim, type Bitmap } from './lib/sprite-tools';

const colors = parsePalette(paletteJson);
const FPS: Record<GolferAnim, number> = { idle: 6, backswing: 1, stroke: 12, celebrate: 8 };

function readPng(file: string): Bitmap {
  const png = PNG.sync.read(readFileSync(file));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

function writePng(file: string, b: Bitmap): void {
  const png = new PNG({ width: b.width, height: b.height });
  png.data = Buffer.from(b.data);
  writeFileSync(file, PNG.sync.write(png));
}

function ingestObject(name: string, file: string): void {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`bad sprite name "${name}"`);
  const bmp = trim(snapToPalette(readPng(file), colors), 1);
  mkdirSync('assets/sprites', { recursive: true });
  writePng(`assets/sprites/${name}.png`, bmp);
  const manifest = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Record<string, Record<string, unknown>>;
  const anchor = bottomCenter(bmp);
  manifest[name] = { ...(manifest[name] ?? {}), image: { src: `${name}.png`, anchor } };
  writeFileSync('assets/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`object ${name}: ${bmp.width}x${bmp.height}, anchor ${anchor.join(',')}`);
}

function ingestUi(name: string, file: string): void {
  mkdirSync('assets/ui', { recursive: true });
  writePng(`assets/ui/${name}.png`, snapToPalette(readPng(file), colors));
  console.log(`ui ${name} written`);
}

function ingestGolfer(dir: string): void {
  const state = readdirSync(dir, { withFileTypes: true }).find((d) => d.isDirectory())?.name;
  if (!state) throw new Error(`no state folder in ${dir}`);
  const rows: Bitmap[][] = [];
  const anims: Record<string, { frames: number; fps: number; rows: Record<string, number> }> = {};
  for (const anim of GOLFER_ANIMS) {
    const animRows: Record<string, number> = {};
    let frames = Infinity;
    for (const d of DIRS) {
      const folder = join(dir, state, 'animations', anim, d);
      if (!existsSync(folder)) throw new Error(`missing ${folder} (rename the animation folder to "${anim}")`);
      const files = readdirSync(folder).filter((f) => f.endsWith('.png')).sort();
      if (files.length === 0) throw new Error(`no frames in ${folder}`);
      frames = Math.min(frames, files.length);
      animRows[d] = rows.length;
      rows.push(files.map((f) => snapToPalette(readPng(join(folder, f)), colors)));
    }
    anims[anim] = { frames, fps: FPS[anim], rows: animRows };
  }
  const sheet = packRows(rows);
  mkdirSync('assets/sprites', { recursive: true });
  writePng('assets/sprites/golfer.png', sheet.bitmap);
  writeFileSync('assets/golfer.json', `${JSON.stringify({ src: 'golfer.png', cell: sheet.cell, anchor: sheet.anchor, anims }, null, 2)}\n`);
  console.log(`golfer: ${rows.length} rows, cell ${sheet.cell.join('x')}, sheet ${sheet.bitmap.width}x${sheet.bitmap.height}`);
}

const [kind, a, b] = process.argv.slice(2);
try {
  if (kind === 'object' && a && b) ingestObject(a, b);
  else if (kind === 'ui' && a && b) ingestUi(a, b);
  else if (kind === 'golfer' && a) ingestGolfer(a);
  else {
    console.error('Usage: npm run ingest -- object <name> <png> | ui <name> <png> | golfer <dir>');
    process.exitCode = 2;
  }
} catch (err) {
  console.error(String(err));
  process.exitCode = 1;
}
```

- [ ] **Step 7: Write the asset check `tests/unit/assets.test.ts`**

```ts
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/manifest.json';
import paletteJson from '../../assets/palette.json';
import { parsePalette } from '../../src/render/palette';
import { parseGolfer } from '../../src/world/golfer';
import { parseManifest } from '../../src/world/manifest';

const palette = new Set(parsePalette(paletteJson).map((c) => c.join(',')));
const pngsIn = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => `${dir}/${f}`) : []);

describe('assets', () => {
  it('every manifest image file exists', () => {
    for (const [name, def] of Object.entries(parseManifest(manifestJson))) {
      if (def.image) expect(existsSync(`assets/sprites/${def.image.src}`), `${name}: ${def.image.src}`).toBe(true);
    }
  });

  it('every sprite and UI image uses only palette colours and full or no alpha', () => {
    for (const file of [...pngsIn('assets/sprites'), ...pngsIn('assets/ui')]) {
      const png = PNG.sync.read(readFileSync(file));
      for (let i = 0; i < png.data.length; i += 4) {
        const a = png.data[i + 3];
        if (a === 0) continue;
        expect(a, `${file}: partial alpha at pixel ${i / 4}`).toBe(255);
        expect(palette.has(`${png.data[i]},${png.data[i + 1]},${png.data[i + 2]}`), `${file}: off-palette at pixel ${i / 4}`).toBe(true);
      }
    }
  });

  it('the golfer layout (if present) matches its sheet', () => {
    if (!existsSync('assets/golfer.json')) return;
    const g = parseGolfer(JSON.parse(readFileSync('assets/golfer.json', 'utf8')));
    const png = PNG.sync.read(readFileSync(`assets/sprites/${g.src}`));
    const rowCount = Math.max(...Object.values(g.anims).flatMap((a) => Object.values(a.rows))) + 1;
    const maxFrames = Math.max(...Object.values(g.anims).map((a) => a.frames));
    expect(png.height).toBe(rowCount * g.cell[1]);
    expect(png.width).toBeGreaterThanOrEqual(maxFrames * g.cell[0]);
  });
});
```

- [ ] **Step 8: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. No sprites exist yet, so the palette check has nothing to check.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore scripts tests/unit/sprite-tools.test.ts tests/unit/assets.test.ts
git commit -m "feat: add the PixelLab ingest script (palette snap, trim, sheet packing) and asset checks"
```

---

### Task 14: Style lock — golfer and gnome, then STOP for approval

This task spends about 7 PixelLab generations. It ends by asking the user to approve the style before any other art is made.

**Tools:** `mcp__pixellab__create_character`, `get_character`, `create_object_pro_flash`, `get_object`. Load their schemas with ToolSearch if needed. The palette's hex list is in `assets/palette.json`; pass it as `palette` with `palette_name: "Backyard"` wherever a tool accepts it.

- [ ] **Step 1: Create the golfer**

Call `create_character` with:
```json
{
  "name": "Backyard Golfer",
  "description": "friendly casual golfer in a blue polo shirt, khaki shorts and a white cap, holding a putter, relaxed summer afternoon",
  "mode": "v3",
  "view": "high top-down",
  "size": 32,
  "outline": "selective outline",
  "detail": "medium detail"
}
```
Poll `get_character(character_id)` until it's completed. Record the character id and the **south rotation URL** it lists.

- [ ] **Step 2: Save the golfer's south view**

```bash
mkdir -p assets/raw
curl -sSL -o assets/raw/golfer-south.png "<south rotation URL>"
```

- [ ] **Step 3: Create the gnome, styled after the golfer**

Call `create_object_pro_flash` with:
```json
{
  "name": "gnome",
  "description": "classic garden gnome with a red pointed hat, white beard and blue coat, standing, cozy backyard",
  "width": 32, "height": 32, "n_directions": 1, "view": "high top-down",
  "palette": ["<the 32 hex colours from assets/palette.json>"], "palette_name": "Backyard",
  "style_image": { "url": "<golfer south rotation URL>", "usage_description": "match this pixel scale, outline and shading" }
}
```
Poll `get_object(object_id)` until completed, then download its PNG: `curl -sSL -o assets/raw/gnome.png "<png URL>"`.

If the style image is refused for size (it must fit inside 32×32), crop it locally to 32×32 around the figure and pass it as `base64` instead.

- [ ] **Step 4: Ingest the gnome**

Run: `npm run ingest -- object gnome assets/raw/gnome.png`
Then run: `npx vitest run tests/unit/assets.test.ts`. Expected: PASS.

- [ ] **Step 5: Show it**

Run `npm run dev` and open `/debug.html`. Hole 1's two gnomes now use the new sprite. Save a screenshot of the debug page and keep `assets/raw/golfer-south.png`.

- [ ] **Step 6: Commit the gnome**

```bash
git add assets/sprites/gnome.png assets/manifest.json
git commit -m "feat: add the PixelLab garden gnome (style anchor)"
```

- [ ] **Step 7: STOP — report for approval**

Report status `DONE_WITH_CONCERNS` with:
- the paths of `assets/raw/golfer-south.png` and the debug-page screenshot
- the golfer character id and the gnome object id
- the generations spent

The controller shows these to the user. **Don't start Task 15 until the user approves the style.** If they ask for changes, regenerate with an adjusted description, re-ingest, and report again.

---

### Task 15: The remaining props

About 50 PixelLab generations. Every call uses the approved gnome as the style anchor, so the set matches.

**Style-lock decision (user, after Task 14):** keep the style and the golfer, but make props smaller. The first gnome came out almost person-height (about 30 px, roughly 2 tiles). Garden props should be roughly knee-to-waist high next to the 32 px golfer. So Step 0 remakes the gnome small, and the sizes below are scaled to match.

**Files:** Modify: `assets/manifest.json`. Create: `assets/sprites/*.png`.

- [ ] **Step 0: Remake the gnome small**

Call `create_object_pro_flash` with the same description as Task 14 and these settings:
- `width: 20, height: 24`
- the Backyard palette
- `style_image`: a 20×24 crop of `assets/raw/gnome.png`, centred on the face and coat, passed as `base64`. The anchor must fit inside the canvas, and the crop carries the outline and shading style.

Download the result to `assets/raw/gnome-small.png`, then run `npm run ingest -- object gnome assets/raw/gnome-small.png`, which replaces the big one. This small gnome's PNG URL is **the style anchor for every prop below**.

- [ ] **Step 1: Generate each prop** with `create_object_pro_flash`. Every call uses:
  - `n_directions: 1` and `view: "high top-down"`
  - the Backyard `palette` and `palette_name`
  - `style_image: { "url": "<small gnome PNG URL from Step 0>", "usage_description": "same pixel scale, outline and shading as this gnome" }`

| name | description | width×height |
|---|---|---|
| big-gnome | large garden gnome holding a tiny lantern, red hat, blue coat | 24×32 |
| flowerpot | terracotta flower pot with red geraniums | 20×20 |
| bush | round leafy green garden shrub | 24×24 |
| lamp | black iron garden lamp post with a warm glowing lantern on top | 20×48 |
| tree | small leafy backyard apple tree | 48×56 |
| bird-bath | stone bird bath with a little water | 20×24 |
| watering-can | green metal watering can | 20×20 |
| hose-reel | garden hose reel wound with green hose | 20×20 |
| string-light-pole | wooden pole with a string of warm fairy lights | 20×48 |

Poll each `get_object` until completed and download it to `assets/raw/<name>.png`. Check each preview. If one comes out clearly wrong (wrong subject, background not transparent, extreme mismatch with the gnome), regenerate once with a sharper description and note it.

- [ ] **Step 2: Ingest each**

For each name: `npm run ingest -- object <name> assets/raw/<name>.png`

- [ ] **Step 3: Set gameplay fields** — edit `assets/manifest.json` so every entry has these fields. Keep the `image` objects that ingest wrote, and keep existing placeholders:

| name | footprint | sway | light |
|---|---|---|---|
| gnome | circle r 0.3 | — | — |
| big-gnome | circle r 0.5 | — | — |
| flowerpot | circle r 0.2 | — | — |
| bush | circle r 0.4 | true | — |
| lamp | circle r 0.1 | — | radius 2.5 |
| tree | circle r 0.35 | true | — |
| bird-bath | circle r 0.3 | — | — |
| watering-can | circle r 0.2 | — | — |
| hose-reel | circle r 0.25 | — | — |
| string-light-pole | circle r 0.1 | — | radius 2 |

For example: `"bush": { "footprint": { "kind": "circle", "r": 0.4 }, "placeholder": { ... }, "image": { ... }, "sway": true }`.

- [ ] **Step 4: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (the palette check covers every new PNG).

By eye on `/debug.html`: the props sit on the ground at their anchors, the bushes sway in the live game, and the lamps glow at dusk and night.

- [ ] **Step 5: Commit**

```bash
git add assets/sprites assets/manifest.json
git commit -m "feat: add PixelLab backyard props (gnomes, plants, lamps, garden bits)"
```

---

### Task 16: Golfer animations

About 32 PixelLab generations.

**Files:** Create: `assets/sprites/golfer.png`, `assets/golfer.json`.

- [ ] **Step 1: Queue the four animations** on the Task 14 character with `animate_character`:
  1. `{ "character_id": "<id>", "template_animation_id": "breathing-idle", "animation_name": "idle" }` (template mode; all 8 directions)
  2. `{ "character_id": "<id>", "mode": "v3", "action_description": "slowly drawing a golf putter back, getting ready to putt", "frame_count": 6, "directions": ["south","south-west","west","north-west","north","north-east","east","south-east"], "animation_name": "backswing" }`
  3. The same as item 2, but with `"action_description": "swinging a golf putter forward smoothly to tap a ball"` and `"animation_name": "stroke"`.
  4. The same as item 2, but with `"action_description": "happy fist pump celebration"`, `"frame_count": 8` and `"animation_name": "celebrate"`.

Wait with `wait_for_jobs` (or poll `get_character`) until all directions are complete. If a direction fails, append it with `animation_group_id` and the same `animation_name`.

- [ ] **Step 2: Download and extract**

From `get_character`, take the character ZIP download link (`/mcp/characters/<id>/download`, as the tool prints it):
```bash
curl -sSL -o assets/raw/golfer.zip "<download link>"
rm -rf assets/raw/golfer && mkdir -p assets/raw/golfer && unzip -q -o assets/raw/golfer.zip -d assets/raw/golfer
ls assets/raw/golfer/*/animations
```
Expected folders: `idle`, `backswing`, `stroke` and `celebrate`. If PixelLab named a folder differently (for example `breathing-idle`), rename it to the expected name with `mv`.

- [ ] **Step 3: Ingest**

Run: `npm run ingest -- golfer assets/raw/golfer`
Expected: `golfer: 32 rows, cell WxH, sheet ...`.

- [ ] **Step 4: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. The golfer layout test now runs.

By eye in the game:
- the golfer stands behind the ball facing the aim in all 8 directions as you circle the mouse
- holding the power winds the backswing
- releasing plays the stroke
- holing out plays the celebration

If the golfer floats or sinks relative to the ball, the anchor is off. Fix it in `scripts/lib/sprite-tools.ts` (`packRows`) and add a test for the case, rather than hand-editing `golfer.json`.

- [ ] **Step 5: Commit**

```bash
git add assets/sprites/golfer.png assets/golfer.json
git commit -m "feat: add the PixelLab golfer with idle, backswing, stroke and celebrate in 8 directions"
```

---

### Task 17: Dress the holes

**Files:** Modify: `src/world/holes/01.json`, `02.json`, `03.json`, and `tests/fixtures/solutions.ts` if needed.

- [ ] **Step 1: Add decoration props** by appending to each hole's `"props"` array:

`01.json` (Gnome Alley):
```json
    { "sprite": "string-light-pole", "at": [6, 0.4] },
    { "sprite": "string-light-pole", "at": [6, 6.6] },
    { "sprite": "bird-bath", "at": [11.4, 6.4] },
    { "sprite": "watering-can", "at": [2, 6.5] }
```

`02.json` (Picket Bank):
```json
    { "sprite": "watering-can", "at": [0.5, 0.5] },
    { "sprite": "string-light-pole", "at": [11.6, 4.4] },
    { "sprite": "hose-reel", "at": [8.5, 9.5] }
```

`03.json` (Pool Hop):
```json
    { "sprite": "tree", "at": [13.4, 6.4] },
    { "sprite": "bird-bath", "at": [0.6, 2.4] },
    { "sprite": "string-light-pole", "at": [5, 0.4] },
    { "sprite": "string-light-pole", "at": [5, 6.6] },
    { "sprite": "hose-reel", "at": [11.5, 6.4] }
```

- [ ] **Step 2: Validate and re-solve**

Run: `npx vitest run tests/unit/holes.test.ts`
- If a hole fails validation because a prop overlaps the tee or cup, move that prop by half a tile into the rough or a corner.
- Then run `npm run solve -- 1`, `npm run solve -- 2` and `npm run solve -- 3`. If a solution changed, update `tests/fixtures/solutions.ts`. If a hole can no longer be solved in par, the new prop is blocking the line: move it out of the way and solve again.
- Re-run the tests. Expected: PASS.

- [ ] **Step 3: By eye**

Each hole should look dressed but uncluttered on `/debug.html`. Lamps and string lights light pools on all three holes at night.

- [ ] **Step 4: Commit**

```bash
git add src/world/holes tests/fixtures/solutions.ts
git commit -m "feat: dress the Backyard holes with lights, trees and garden bits"
```

---

### Task 18: Title panel

About 10 PixelLab generations.

**Files:** Create: `assets/ui/title-panel.png`. Modify: `src/ui/hud.ts`, `src/style.css`.

- [ ] **Step 1: Generate**

Call `create_ui_asset` with:
```json
{
  "name": "title-panel",
  "description": "cozy painted wooden backyard sign board, warm wood planks, small leaves and a tiny golf flag in the corners, empty centre for text",
  "width": 256, "height": 192, "no_background": true,
  "palette": ["<Backyard hex colours>"], "palette_name": "Backyard"
}
```
Poll `get_ui_asset` until completed. Download the image to `assets/raw/title-panel.png`, then run `npm run ingest -- ui title-panel assets/raw/title-panel.png`.

- [ ] **Step 2: Use it on the title card** — in `src/ui/hud.ts` add:

```ts
import titlePanelUrl from '../../assets/ui/title-panel.png';
```
After `const title = overlay();`, add:
```ts
  title.card.classList.add('title-card');
  title.card.style.backgroundImage = `url(${titlePanelUrl})`;
```

Append to `src/style.css`:
```css
.card.title-card {
  width: 512px; height: 384px; padding-top: 120px;
  background: transparent center / contain no-repeat;
  image-rendering: pixelated;
}
.card.title-card h1 { color: var(--ink); text-shadow: 0 2px 0 #0008; }
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run e2e`
Expected: PASS. The e2e test still finds the "Backyard" heading and the Play button. By eye, the title card shows the wooden sign behind the text.

- [ ] **Step 4: Commit**

```bash
git add assets/ui src/ui/hud.ts src/style.css
git commit -m "feat: add the PixelLab wooden sign title card"
```

---

## Phase D — sound

### Task 19: Generated sound effects and ambience

**Files:**
- Create: `src/audio/sfx-math.ts`, `src/audio/sfx.ts`
- Modify: `src/main.ts`
- Test: `tests/unit/sfx.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { ambienceFor, puttPitch, puttVolume, rollVolume, soundsFor } from '../../src/audio/sfx-math';

describe('sound mapping', () => {
  it('putt volume and pitch rise with power and clamp', () => {
    expect(puttVolume(0)).toBeLessThan(puttVolume(1));
    expect(puttVolume(5)).toBe(puttVolume(1));
    expect(puttPitch(1)).toBeGreaterThan(puttPitch(0));
    expect(puttPitch(Number.NaN)).toBe(puttPitch(0));
  });
  it('rolling gets louder with speed and is silent at rest', () => {
    expect(rollVolume(0)).toBe(0);
    expect(rollVolume(3)).toBeGreaterThan(rollVolume(1));
    expect(rollVolume(100)).toBe(rollVolume(6));
  });
  it('birds by day, crickets by dusk and night', () => {
    expect(ambienceFor('morning')).toBe('birds');
    expect(ambienceFor('day')).toBe('birds');
    expect(ambienceFor('dusk')).toBe('crickets');
    expect(ambienceFor('night')).toBe('crickets');
  });
  it('maps ball events to one sound each per frame', () => {
    expect(soundsFor(['wall', 'wall', 'lip', 'holed'])).toEqual(['wall', 'plink']);
    expect(soundsFor(['water'])).toEqual(['splash']);
    expect(soundsFor(['land', 'stopped'])).toEqual(['land']);
    expect(soundsFor([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/unit/sfx.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `src/audio/sfx-math.ts`**

```ts
import type { BallEvent } from '../physics/ball';
import type { PhaseId } from '../render/time-of-day';

export type Sound = 'wall' | 'land' | 'plink' | 'splash';
export type Ambience = 'birds' | 'crickets';

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export const puttVolume = (power: number): number => 0.15 + 0.55 * clamp01(power);
export const puttPitch = (power: number): number => 1 + 0.6 * clamp01(power);
/** Rolling hiss volume for a ball speed in tiles/s (full at 6). */
export const rollVolume = (speed: number): number => clamp01(speed / 6) * 0.25;
export const ambienceFor = (phase: PhaseId): Ambience => (phase === 'dusk' || phase === 'night' ? 'crickets' : 'birds');

const SOUND_OF: Partial<Record<BallEvent, Sound>> = { wall: 'wall', land: 'land', holed: 'plink', water: 'splash' };

/** The sounds a frame's ball events trigger, each at most once, in first-seen order. */
export function soundsFor(events: readonly BallEvent[]): Sound[] {
  return [...new Set(events.flatMap((e) => (SOUND_OF[e] ? [SOUND_OF[e] as Sound] : [])))];
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/unit/sfx.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `src/audio/sfx.ts`** (Web Audio; checked by ear)

```ts
import { puttPitch, puttVolume, rollVolume, type Ambience, type Sound } from './sfx-math';

export interface Sfx {
  /** Call from a user gesture: browsers only allow audio to start after one. */
  unlock(): void;
  putt(power: number): void;
  play(sound: Sound): void;
  setRoll(speed: number): void;
  setAmbience(kind: Ambience): void;
}

const SILENT: Sfx = { unlock() {}, putt() {}, play() {}, setRoll() {}, setAmbience() {} };

export function createSfx(): Sfx {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return SILENT;
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let rollGain: GainNode | null = null;
  let ambience: Ambience | null = null;
  let ambienceTimer = 0;
  let crickets: { osc: OscillatorNode; gain: GainNode } | null = null;

  const env = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };
  const tone = (type: OscillatorType, freq: number, peak: number, decay: number, at = 0, freqEnd?: number) => {
    if (!ac || !master) return;
    const t = ac.currentTime + at;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
    env(g, t, peak, 0.005, decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + decay + 0.05);
  };
  const burst = (filter: BiquadFilterType, freq: number, peak: number, decay: number, freqEnd?: number) => {
    if (!ac || !master || !noise) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    src.buffer = noise;
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + decay);
    env(g, t, peak, 0.005, decay);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + decay + 0.05);
  };

  const chirp = () => {
    tone('sine', 3200 + Math.random() * 800, 0.03, 0.08, 0, 4200);
    tone('sine', 3400 + Math.random() * 800, 0.025, 0.07, 0.12, 4400);
  };

  const stopAmbience = () => {
    window.clearTimeout(ambienceTimer);
    crickets?.osc.stop();
    crickets = null;
  };

  const startAmbience = (kind: Ambience) => {
    stopAmbience();
    if (!ac || !master) return;
    if (kind === 'birds') {
      const next = () => {
        chirp();
        ambienceTimer = window.setTimeout(next, 1500 + Math.random() * 2500);
      };
      next();
    } else {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const lfo = ac.createOscillator();
      const lfoGain = ac.createGain();
      osc.frequency.value = 4400;
      lfo.type = 'square';
      lfo.frequency.value = 30;
      lfoGain.gain.value = 0.012;
      gain.gain.value = 0.012;
      lfo.connect(lfoGain).connect(gain.gain);
      osc.connect(gain).connect(master);
      osc.start();
      lfo.start();
      crickets = { osc, gain };
    }
  };

  return {
    unlock() {
      if (ac) return;
      try {
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.8;
        master.connect(ac.destination);
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const ch = noise.getChannelData(0);
        for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
        const roll = ac.createBufferSource();
        const lp = ac.createBiquadFilter();
        rollGain = ac.createGain();
        roll.buffer = noise;
        roll.loop = true;
        lp.type = 'lowpass';
        lp.frequency.value = 500;
        rollGain.gain.value = 0;
        roll.connect(lp).connect(rollGain).connect(master);
        roll.start();
        if (ambience) startAmbience(ambience);
      } catch (err) {
        console.warn('Audio unavailable:', err);
        ac = null;
      }
    },
    putt(power) {
      burst('bandpass', 1800 * puttPitch(power), puttVolume(power), 0.05);
      tone('sine', 900 * puttPitch(power), puttVolume(power) * 0.5, 0.04);
    },
    play(sound) {
      if (sound === 'plink') {
        tone('sine', 1568, 0.25, 0.4);
        tone('sine', 2349, 0.15, 0.35, 0.03);
      } else if (sound === 'splash') {
        burst('lowpass', 2000, 0.35, 0.5, 300);
      } else if (sound === 'wall') {
        tone('square', 300, 0.06, 0.025);
      } else {
        tone('sine', 140, 0.15, 0.06);
      }
    },
    setRoll(speed) {
      if (ac && rollGain) rollGain.gain.setTargetAtTime(rollVolume(speed), ac.currentTime, 0.05);
    },
    setAmbience(kind) {
      if (kind === ambience) return;
      ambience = kind;
      if (ac) startAmbience(kind);
    },
  };
}
```

- [ ] **Step 6: Wire sound into `src/main.ts`**

Add imports:
```ts
import { ambienceFor, soundsFor } from './audio/sfx-math';
import { createSfx } from './audio/sfx';
import { MAX_PUTT_SPEED } from './physics/constants';
```
(merge `MAX_PUTT_SPEED` into the existing `./physics/constants` import).

In `runGame`, after `wireInput(...)`:
```ts
  const sfx = createSfx();
  const unlock = () => sfx.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  sfx.setAmbience(ambienceFor(phase));
```
Move this block below the line where `phase` is first assigned. Inside the `setInterval` callback, add `sfx.setAmbience(ambienceFor(phase));`.

In `frame`, replace `prevKind = state.phase.kind;` with:
```ts
    if (prevKind === 'charging' && state.phase.kind === 'rolling') {
      sfx.putt(Math.hypot(state.ball.vx, state.ball.vy) / MAX_PUTT_SPEED);
    }
    prevKind = state.phase.kind;
    for (const s of soundsFor(state.events)) sfx.play(s);
    sfx.setRoll(state.phase.kind === 'rolling' && !state.ball.airborne ? Math.hypot(state.ball.vx, state.ball.vy) : 0);
```
Make sure this runs before `state = clearEvents(state)` at the end of `frame`.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npx vitest run && npm run e2e`
Expected: PASS.

By ear (`npm run dev`, click Play):
- the putt taps louder with more power
- the ball hisses while rolling
- a fence gives a tick, the cup plinks, and the pool splashes
- birds chirp by day; `?phase=night` gives crickets

There should be no sound before the first click, and no console errors.

- [ ] **Step 8: Commit**

```bash
git add src/audio src/main.ts tests/unit/sfx.test.ts
git commit -m "feat: add generated putt, roll, plink, splash and tick sounds with day and night ambience"
```

---

## Phase E — finish

### Task 20: Final verification

**Files:** none new (fix whatever this finds).

- [ ] **Step 1: Run every check**

Run: `npx tsc --noEmit`, `npm run coverage`, `npm run e2e` and `npm run build`. Expected: all pass, with coverage at or above 80% on physics, world and game. Delete `test-results/` and `playwright-report/`.

- [ ] **Step 2: Performance**

Run `npm run dev`, play hole 1, and paste this into the browser console:
```js
let n = 0, t0 = performance.now(); (function f(){ if (++n < 300) requestAnimationFrame(f); else console.log('fps', (300 / ((performance.now() - t0) / 1000)).toFixed(1)); })();
```
Expected: about 60 fps. If it's clearly lower, profile; the post pass is the likely cost. Report the number.

Also check the bundle with `ls -la dist/assets`. Expected: under 1 MB in total.

- [ ] **Step 3: Full by-eye pass**

Open `/debug.html` and the game at each `?phase=`. Confirm:
- palette-only pixels
- fringe and wind
- pool rim and shimmer
- light pools at dusk and night
- shadows per phase
- PixelLab props and golfer in all 8 directions, with the stroke and celebration
- fences that never cover the ball
- the title panel
- sounds

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: final polish from the look and art verification pass"
```
(Skip this if nothing changed.)

---

## Done for Plan 2

- The Backyard slice has the full look: dithered code-drawn terrain with a fringe, palette post pass, four time-of-day looks with light pools, stepped wind, PixelLab golfer and props, title panel and sound.
- Plan 1's leftovers are closed: dev-tool advisories, wall slide and corner physics, NaN strike, Pool Hop tuning, fence draw order, the earth-side overlap and async loading.
- All tests, coverage, e2e and the build pass.
- **About 95–100 PixelLab generations** spent (golfer 2, gnome 5, props about 45, animations about 32, title panel 10, plus retries).
