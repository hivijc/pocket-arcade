# Bluebird Run (one-slope slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Bluebird Run, Pocket Arcade's fourth game: a sunny-day isometric snowboard score run down one hand-made slope (Pinecone Bowl). It plays with a keyboard on desktop and with thumb-drag touch on iPhone, and it gets a card on the hub.

**Architecture:** A self-contained game under `games/bluebird-run/`, built the same way as Paper Route. Pure sim modules (`sim/`) and a pure reducer (`game/`) step a fixed 60 Hz simulation. The slope ground is code-baked into 16-tile chunks and drawn with depth-sorted PixelLab sprites into a 360×270 buffer. A palette post pass and upscale finish the frame, and a DOM HUD sits on top. Engine pieces are copied from `games/paper-route/` and adapted. Nothing outside the game folder is imported.

**Tech Stack:** TypeScript 5.9, Canvas 2D, Web Audio, Vite 6, Vitest 5 (coverage v8), Playwright (Chromium; iPhone 13 profile over CDP touches), Node 22, pngjs, and the PixelLab MCP for art.

**Spec:** `docs/superpowers/specs/2026-11-10-bluebird-run-design.md`. Read it before any task. Numbers below match the spec, and every tunable number lives in `sim/constants.ts`.

---

## Conventions for every task

- **Node:** prefix every node, npm or npx command with
  `export PATH=$HOME/.nvm/versions/node/v22.22.3/bin:$PATH && `. It's omitted below for brevity.
- **Run from the worktree root:** `/Users/nathanielleong/Desktop/3dpixelartgame/.claude/worktrees/downhill-snowboard-e2195c`.
- `G` means `games/bluebird-run`, and `P` means `games/paper-route` (the source of the copied code).
- **Unit tests:** `npx vitest run games/bluebird-run/tests/unit/<file>.test.ts`.
- **Immutability:** state is never mutated. The only exceptions are the ones Paper Route documents:
  per-frame pixel buffers, caches, and live input sets. Each one needs a comment saying it's
  deliberate.
- **Commits:** `<type>: <description>` (feat, fix, test, refactor, docs, chore), ending with the
  line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push and never merge into `main`.
- **Imports:** the game imports nothing outside `games/bluebird-run/`.
- **Axes:** a slope point is `[c, d]`. `c` (across) runs from 0 at the **screen-left** edge to 16 at
  the **screen-right** edge, and `d` (downhill) runs from 0 at the start hut to `length`. Grid
  `x = d`, `y = 16 − c`. Downhill moves ↘ on screen, and turning right (→, heading > 0) heads
  towards larger `c` (screen up-right).

## File map

```
games/bluebird-run/
  index.html                         Task 1
  src/main.ts                        Task 1 stub → Task 17
  src/style.css                      Task 1 copy → Task 15
  src/content.ts                     Task 17
  src/core/geometry.ts, loop.ts      Task 1 (copied)
  src/core/hash.ts                   Task 2
  src/core/touch.ts                  Task 11 (pure gesture interpreter)
  src/core/input.ts                  Task 11 (keyboard + pointer wiring)
  src/sim/constants.ts               Task 2
  src/sim/board.ts                   Task 4
  src/sim/air.ts                     Task 5
  src/sim/tricks.ts                  Task 6
  src/sim/gates.ts                   Task 7
  src/sim/hazards.ts                 Task 8
  src/world/slope.ts                 Task 3
  src/world/slopes/pinecone-bowl.json   Task 17, tuned in Task 18
  src/world/manifest.ts              Task 1 (copied)
  src/world/rider.ts                 Task 14
  src/game/events.ts, score.ts       Task 9
  src/game/state.ts, tick.ts         Task 10
  src/render/palette.ts, dither.ts   Task 1 (copied)
  src/render/iso.ts                  Task 2
  src/render/post.ts                 Task 1 (copied, MORNING → SUNNY)
  src/render/slope-bake.ts           Task 12
  src/render/chunks.ts, assets.ts    Task 12 (copied, import path changed)
  src/render/camera.ts               Task 12
  src/render/tracks.ts, particles.ts Task 13
  src/render/renderer.ts             Task 14
  src/ui/layout.ts                   Task 1 (copied from src/ui/layout.ts)
  src/ui/hud-text.ts, hud.ts         Task 15
  src/audio/sfx-math.ts, sfx.ts      Task 16
  assets/palette.json, manifest.json Task 1
  scripts/lib/sprite-tools.ts        Task 1 (copied)
  scripts/ingest.ts                  Task 20
  tests/unit/*.test.ts               each task
  tests/helpers/make-slope.ts        Task 3
  tests/helpers/bot.ts               Task 18
  tests/e2e/hook.ts, bluebird-run.spec.ts    Task 17
  tests/e2e/bluebird-touch.spec.ts           Task 19
root: vite.config.ts, package.json, vitest.config.ts, playwright.config.ts   Task 1
root: index.html, public/hub/bluebird-run.png, tests/e2e/hub.spec.ts, README.md   Task 23
```

---

### Task 1: Scaffold the game folder, copy the engine and wire up the root

**Files:**
- Create: `G/index.html`, `G/src/main.ts`, `G/assets/palette.json`, `G/assets/manifest.json`
- Copy: listed in Step 1
- Modify: `vite.config.ts`, `package.json`, `vitest.config.ts`, `playwright.config.ts`

- [ ] **Step 1: Make the folders and copy the modules that need no changes, with their tests**

```bash
G=games/bluebird-run; P=games/paper-route
mkdir -p $G/src/{core,render,sim,game,world/slopes,ui,audio} $G/assets/sprites $G/scripts/lib $G/tests/{unit,e2e,helpers}
cp $P/src/core/geometry.ts $P/src/core/loop.ts $G/src/core/
cp $P/src/render/palette.ts $P/src/render/dither.ts $P/src/render/post.ts $G/src/render/
cp $P/src/world/manifest.ts $G/src/world/
cp $P/src/style.css $G/src/style.css
cp $P/scripts/lib/sprite-tools.ts $G/scripts/lib/
cp src/ui/layout.ts $G/src/ui/layout.ts
cp $P/tests/unit/geometry.test.ts $P/tests/unit/loop.test.ts $P/tests/unit/palette.test.ts \
   $P/tests/unit/sprite-tools.test.ts $P/tests/unit/manifest.test.ts $P/tests/unit/post.test.ts $G/tests/unit/
cp tests/unit/layout.test.ts $G/tests/unit/layout.test.ts
```

- [ ] **Step 2: Rename the grade to SUNNY and retune it**

In `G/src/render/post.ts`, replace the `MORNING` declaration (and its doc comment) with:

```ts
/** The one sunny-day look: bright and a touch cool, so snow shadows read blue. Daytime only. */
export const SUNNY: Grade = { mul: [1, 1, 1.03], add: [4, 5, 9] };
```

Then run `sed -i '' 's/MORNING/SUNNY/g' games/bluebird-run/tests/unit/post.test.ts`.

- [ ] **Step 3: Write the Bluebird palette**

`G/assets/palette.json` holds exactly 32 colours. It includes the `#9fd8ee` sky that `post.test.ts` uses.

```json
{
  "name": "Bluebird",
  "colors": [
    "#14141c", "#2c2c3a", "#4a4a5a", "#8a8a96", "#b8b8c4",
    "#ffffff", "#f4f8ff", "#e3edf8", "#c9daee", "#a9c2e2", "#8aa6d4", "#6b84bf", "#4d5f9a",
    "#9fd8ee", "#5aa7d0", "#2f6f9a", "#1d3b5c",
    "#1f3a2c", "#2f5530", "#3f6b3a", "#5e8c45",
    "#2e2420", "#4a3b2e", "#6b4f3a",
    "#c8463c", "#7a2e2e", "#3d63c9", "#f2c25b", "#e98a52", "#e7b98f", "#9b5fc0", "#8fca6c"
  ]
}
```

In `G/tests/unit/palette.test.ts`, change the test title `'loads the 32-colour Maple Lane palette'`
to `'loads the 32-colour Bluebird palette'`.

- [ ] **Step 4: Write the placeholder manifest**

`G/assets/manifest.json` gives every sprite a placeholder box. The ingest script adds the `image`
entries later.

```json
{
  "pine": { "placeholder": { "color": "#2f5530", "w": 14, "h": 30 } },
  "rock-s": { "placeholder": { "color": "#8a8a96", "w": 8, "h": 5 } },
  "rock-l": { "placeholder": { "color": "#4a4a5a", "w": 16, "h": 10 } },
  "snowman": { "placeholder": { "color": "#f4f8ff", "w": 12, "h": 20 } },
  "flag-blue": { "placeholder": { "color": "#3d63c9", "w": 4, "h": 18 } },
  "flag-red": { "placeholder": { "color": "#c8463c", "w": 4, "h": 18 } },
  "ramp": { "placeholder": { "color": "#c9daee", "w": 36, "h": 10 } },
  "flake": { "placeholder": { "color": "#f2c25b", "w": 6, "h": 6 } },
  "hut": { "placeholder": { "color": "#6b4f3a", "w": 40, "h": 34 } },
  "banner": { "placeholder": { "color": "#c8463c", "w": 60, "h": 30 } },
  "skier-red": { "placeholder": { "color": "#c8463c", "w": 10, "h": 22 } },
  "skier-green": { "placeholder": { "color": "#8fca6c", "w": 10, "h": 22 } },
  "boarder-purple": { "placeholder": { "color": "#9b5fc0", "w": 10, "h": 22 } }
}
```

In `G/tests/unit/manifest.test.ts`, replace the last test (`'parses the game manifest, which has
every sprite the street and renderer use'`) with:

```ts
  it('parses the game manifest, which has every sprite the slope and renderer use', () => {
    const m = parseManifest(manifestJson);
    for (const name of ['pine', 'rock-s', 'rock-l', 'snowman', 'flag-blue', 'flag-red', 'ramp', 'flake', 'hut', 'banner',
      'skier-red', 'skier-green', 'boarder-purple']) {
      expect(m[name], name).toBeDefined();
    }
  });
```

- [ ] **Step 5: Write the page and a stub entry point**

`G/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#9fd8ee" />
    <title>Bluebird Run</title>
  </head>
  <body>
    <a class="arcade-back" href="../../">← Pocket Arcade</a>
    <div id="stage"><canvas id="game" width="360" height="270"></canvas></div>
    <div id="hud"></div>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
```

`G/src/main.ts` (replaced in Task 17):

```ts
import './style.css';
```

- [ ] **Step 6: Wire up the root config**

`vite.config.ts`: in `rollupOptions.input`, add a line after `paperRoute`:

```ts
        bluebirdRun: at('./games/bluebird-run/index.html'),
```

`package.json` scripts: add these after `ingest:paper-route`:

```json
    "dev:bluebird-run": "vite --open /games/bluebird-run/",
    "ingest:bluebird-run": "vite-node games/bluebird-run/scripts/ingest.ts"
```

`vitest.config.ts`: add these to the end of `coverage.include`:

```ts
'games/bluebird-run/src/sim/**', 'games/bluebird-run/src/game/**', 'games/bluebird-run/src/world/**',
'games/bluebird-run/src/core/touch.ts', 'games/bluebird-run/src/render/tracks.ts', 'games/bluebird-run/src/render/particles.ts'
```

`playwright.config.ts`: add the project, and turn off server reuse so that a vite server from
another worktree on port 5199 fails loudly instead of being tested by mistake:

```ts
    { name: 'bluebird-run', testDir: 'games/bluebird-run/tests/e2e', testIgnore: 'hook.ts' },
```

and in `webServer`, set `reuseExistingServer: false,`.

- [ ] **Step 7: Run the copied tests and the typecheck**

Run: `npx vitest run games/bluebird-run && npx tsc --noEmit`
Expected: every copied test file passes (geometry, loop, palette, sprite-tools, manifest, post,
layout), and tsc prints nothing.

- [ ] **Step 8: Commit**

```bash
git add games/bluebird-run vite.config.ts package.json vitest.config.ts playwright.config.ts
git commit -m "chore: scaffold Bluebird Run with copied engine modules and root wiring"
```

---

### Task 2: Constants, hash and iso slope axes

**Files:**
- Create: `G/src/sim/constants.ts`, `G/src/core/hash.ts`, `G/src/render/iso.ts`
- Test: `G/tests/unit/iso.test.ts`, `G/tests/unit/hash.test.ts`

- [ ] **Step 1: Write the constants** (no test; later tasks consume them)

`G/src/sim/constants.ts`:

```ts
/** Every tunable number in Bluebird Run (spec §5). Starting values; tune here only. */

export const STEP = 1 / 60;

export const SLOPE = { width: 16, powder: 2, minC: 0.4, maxC: 15.6 } as const;

export const BOARD = {
  radius: 0.3,
  /** Degrees per second while a turn input is held. */
  turnRate: 150,
  /** Degrees per second back toward straight downhill with no input. */
  straighten: 40,
  maxHeading: 75,
  /** Downhill pull, tiles/s², scaled by cos(heading). */
  pull: 5,
  /** Linear drag per second; pull / drag = 8 tiles/s top speed. */
  drag: 0.625,
  powderDrag: 3,
  carveFrom: 45,
  carveSpan: 30,
  /** Extra braking, tiles/s², at a full carve (carveFrom + carveSpan). */
  carveBrake: 4,
  minSpeed: 1,
  sprayFrom: 45,
  spraySpeed: 3,
} as const;

export const AIR = {
  ollieTime: 0.45,
  ollieHeight: 0.5,
  /** Seconds on the ground after a landing before another ollie. */
  regrab: 0.15,
  rampBase: 0.5,
  rampPerSpeed: 0.1,
  rampPeakK: 0.25,
  rampLen: 3,
  rampHalfWidth: 1,
  lipHeight: 0.5,
  /** Degrees per second of spin at full turn input. */
  spinRate: 540,
} as const;

export const TRICK = { window: 35, per180: 150, grab: 200, grabMin: 0.3, styleMin: 360, style: 1.5 } as const;

export const GATE = { base: 100, streak: 50, poleSlack: 0.3, minGap: 2, maxGap: 6 } as const;

export const FLAKE = { points: 25, radius: 0.4 } as const;

export const CRASH = { tumble: 1.2, invuln: 1.5, slide: 3 } as const;

export const RIDERS = { wake: 30, radius: 0.3 } as const;

export const HAZARD_R = { pine: 0.35, 'rock-s': 0.3, 'rock-l': 0.5, snowman: 0.35 } as const;

/** Height (tiles) the rider must be above to pass over each obstacle. */
export const CLEAR_Z = { pine: 2, 'rock-s': 0.3, 'rock-l': 0.6, snowman: 1, rider: 1.2 } as const;

export const RUN = {
  countdown: 3,
  runout: 1.5,
  runoutBrake: 4,
  bonusPerSecond: 40,
  startC: 8,
  startD: 4,
  /** No listed hazard may sit at d below this. */
  safeStart: 8,
} as const;
```

- [ ] **Step 2: Write the failing tests**

`G/tests/unit/hash.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hash2 } from '../../src/core/hash';

describe('hash2', () => {
  it('is deterministic and in [0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const v = hash2(i, i * 3, 7);
      expect(v).toBe(hash2(i, i * 3, 7));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('changes with the seed', () => {
    expect(hash2(3, 4, 1)).not.toBe(hash2(3, 4, 2));
  });
});
```

`G/tests/unit/iso.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { depthOf, fromGrid, ORIGIN, project, slopePx, sortByDepth, toGrid, unproject } from '../../src/render/iso';

describe('slope axes', () => {
  it('puts the screen-left start corner (c 16, d 0) at the origin', () => {
    expect(slopePx(ORIGIN, 16, 0)).toEqual([0, 0]);
  });
  it('moves down-right on screen when going downhill', () => {
    const [x0, y0] = slopePx(ORIGIN, 8, 10);
    const [x1, y1] = slopePx(ORIGIN, 8, 11);
    expect([x1 - x0, y1 - y0]).toEqual([16, 8]);
  });
  it('moves up-right on screen when c grows (turning right)', () => {
    const [x0, y0] = slopePx(ORIGIN, 8, 10);
    const [x1, y1] = slopePx(ORIGIN, 9, 10);
    expect([x1 - x0, y1 - y0]).toEqual([16, -8]);
  });
  it('lifts by 16 px per tile of height', () => {
    expect(slopePx(ORIGIN, 8, 10, 1)[1]).toBe(slopePx(ORIGIN, 8, 10)[1] - 16);
  });
  it('round-trips grid conversion and unprojection', () => {
    const [x, y] = toGrid(5, 30);
    expect(fromGrid(x, y)).toEqual([5, 30]);
    const [sx, sy] = project(ORIGIN, x, y, 0);
    const [gx, gy] = unproject(ORIGIN, sx, sy);
    expect(gx).toBeCloseTo(x);
    expect(gy).toBeCloseTo(y);
  });
  it('draws nearer (further downhill, further screen-left) things later', () => {
    expect(depthOf(8, 11)).toBeGreaterThan(depthOf(8, 10));
    expect(depthOf(7, 10)).toBeGreaterThan(depthOf(8, 10));
    const sorted = sortByDepth([{ depth: 3, n: 'a' }, { depth: 1, n: 'b' }]);
    expect(sorted.map((s) => s.n)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 3: Run the tests and check they fail**

Run: `npx vitest run games/bluebird-run/tests/unit/iso.test.ts games/bluebird-run/tests/unit/hash.test.ts`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 4: Implement them**

`G/src/core/hash.ts`:

```ts
/** Deterministic pseudo-random value in [0, 1) for integer inputs and a seed (same as render/dither's hash2). */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
```

`G/src/render/iso.ts`:

```ts
import type { Vec2 } from '../core/geometry';
import { SLOPE } from '../sim/constants';

export const TILE_W = 32;
export const TILE_H = 16;
/** Screen pixels per tile of height. */
export const Z_PX = 16;

export interface View {
  readonly ox: number;
  readonly oy: number;
}

/** World pixel space: grid (0, 0, 0) sits at pixel (0, 0). */
export const ORIGIN: View = { ox: 0, oy: 0 };

export function project(v: View, x: number, y: number, z: number): Vec2 {
  return [v.ox + ((x - y) * TILE_W) / 2, v.oy + ((x + y) * TILE_H) / 2 - z * Z_PX];
}

export function unproject(v: View, sx: number, sy: number, z = 0): Vec2 {
  const a = (sx - v.ox) / (TILE_W / 2); // x - y
  const b = (sy - v.oy + z * Z_PX) / (TILE_H / 2); // x + y
  return [(a + b) / 2, (b - a) / 2];
}

/** Slope point [c, d] → grid [x, y]: d (downhill) is grid x; c (screen-left 0 → screen-right 16) runs against grid y. */
export const toGrid = (c: number, d: number): Vec2 => [d, SLOPE.width - c];
/** Grid [x, y] → slope point [c, d]. */
export const fromGrid = (x: number, y: number): Vec2 => [SLOPE.width - y, x];

export function slopePx(v: View, c: number, d: number, z = 0): Vec2 {
  return project(v, d, SLOPE.width - c, z);
}

/** Larger depth = closer to the viewer = drawn later. */
export function depthOf(c: number, d: number): number {
  return d + (SLOPE.width - c);
}

export function sortByDepth<T extends { readonly depth: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.depth - b.depth);
}
```

- [ ] **Step 5: Run the tests and check they pass**

Run: the same command as Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add games/bluebird-run/src/sim/constants.ts games/bluebird-run/src/core/hash.ts games/bluebird-run/src/render/iso.ts games/bluebird-run/tests/unit/iso.test.ts games/bluebird-run/tests/unit/hash.test.ts
git commit -m "feat: Bluebird Run constants and slope iso axes"
```

---

### Task 3: Slope data loader and validator

**Files:**
- Create: `G/src/world/slope.ts`, `G/tests/helpers/make-slope.ts`
- Test: `G/tests/unit/slope.test.ts`

- [ ] **Step 1: Write the test helper**

`G/tests/helpers/make-slope.ts`:

```ts
import { parseSlope, type Slope } from '../../src/world/slope';

/** A valid, empty 120-tile slope as raw JSON, with fields overridden. */
export const rawSlope = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'Test Run', length: 120, finish: 110, par: 30,
  surfaces: [], gates: [], ramps: [], hazards: [], riders: [], flakes: [], ...over,
});

/** Parsed test slope. Border pines are off unless asked for, so physics tests see only what they list. */
export const makeSlope = (over: Record<string, unknown> = {}, borders = false): Slope => parseSlope(rawSlope(over), { borders });
```

- [ ] **Step 2: Write the failing test**

`G/tests/unit/slope.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { borderPines, parseSlope, SlopeError } from '../../src/world/slope';
import { makeSlope, rawSlope } from '../helpers/make-slope';

describe('parseSlope', () => {
  it('parses a full slope', () => {
    const s = makeSlope({
      surfaces: [{ kind: 'packed', rect: [5, 20, 4, 10] }],
      gates: [{ d: 30, c: [6, 10], color: 'blue' }, { d: 40, c: [9, 5], color: 'red' }],
      ramps: [{ d: 60, c: 8 }],
      hazards: [{ kind: 'pine', at: [3, 50] }, { kind: 'rock-s', at: [9, 70] }],
      riders: [{ look: 'skier-red', speed: 3.5, path: [[8, 40], [5, 60]] }],
      flakes: [[8, 55], [8, 57]],
    });
    expect(s.name).toBe('Test Run');
    expect(s.surfaces[0]).toEqual({ kind: 'packed', rect: { c0: 5, d0: 20, c1: 9, d1: 30 } });
    expect(s.gates[1].c).toEqual([5, 9]); // flags are stored low, high
    expect(s.ramps).toEqual([{ d: 60, c: 8 }]);
    expect(s.hazards).toHaveLength(2);
    expect(s.riders[0].path).toEqual([[8, 40], [5, 60]]);
    expect(s.flakes).toEqual([[8, 55], [8, 57]]);
  });

  it.each([
    ['a non-object', 5, /must be an object/],
    ['an empty name', rawSlope({ name: '' }), /name/],
    ['a short length', rawSlope({ length: 30 }), /length/],
    ['a finish past the end', rawSlope({ finish: 120 }), /finish/],
    ['no par', rawSlope({ par: 0 }), /par/],
    ['an off-slope flake', rawSlope({ flakes: [[17, 10]] }), /flakes\[0\].*off the slope/],
    ['a bad surface kind', rawSlope({ surfaces: [{ kind: 'ice', rect: [1, 1, 1, 1] }] }), /surfaces\[0\]\.kind/],
    ['a zero-size surface', rawSlope({ surfaces: [{ kind: 'shade', rect: [1, 1, 0, 1] }] }), /surfaces\[0\].*positive size/],
    ['gate flags too close', rawSlope({ gates: [{ d: 30, c: [6, 7], color: 'blue' }] }), /gates\[0\].*apart/],
    ['gate flags too far', rawSlope({ gates: [{ d: 30, c: [2, 9], color: 'blue' }] }), /gates\[0\].*apart/],
    ['gates out of order', rawSlope({ gates: [{ d: 40, c: [6, 10], color: 'blue' }, { d: 30, c: [6, 10], color: 'red' }] }), /gates\[1\].*increasing d/],
    ['a bad gate colour', rawSlope({ gates: [{ d: 30, c: [6, 10], color: 'green' }] }), /gates\[0\]\.color/],
    ['a ramp off the end', rawSlope({ ramps: [{ d: 118, c: 8 }] }), /ramps\[0\].*off the end/],
    ['an unknown hazard', rawSlope({ hazards: [{ kind: 'yeti', at: [8, 50] }] }), /hazards\[0\]\.kind/],
    ['a hazard in the start area', rawSlope({ hazards: [{ kind: 'pine', at: [8, 5] }] }), /hazards\[0\].*start area/],
    ['a hazard on a ramp', rawSlope({ ramps: [{ d: 60, c: 8 }], hazards: [{ kind: 'rock-l', at: [8.5, 61] }] }), /hazards\[0\].*ramps\[0\]/],
    ['a hazard inside a gate', rawSlope({ gates: [{ d: 30, c: [6, 10], color: 'blue' }], hazards: [{ kind: 'snowman', at: [8, 30.2] }] }), /hazards\[0\].*gates\[0\]/],
    ['a rider with no speed', rawSlope({ riders: [{ look: 'skier-red', speed: 0, path: [[8, 40], [5, 60]] }] }), /riders\[0\].*speed/],
    ['a rider going uphill', rawSlope({ riders: [{ look: 'skier-red', speed: 3, path: [[8, 60], [5, 40]] }] }), /riders\[0\]\.path.*downhill/],
    ['an unknown rider look', rawSlope({ riders: [{ look: 'yeti', speed: 3, path: [[8, 40], [5, 60]] }] }), /riders\[0\]\.look/],
    ['a one-point rider path', rawSlope({ riders: [{ look: 'skier-red', speed: 3, path: [[8, 40]] }] }), /riders\[0\]\.path/],
  ])('rejects %s', (_label, raw, msg) => {
    expect(() => parseSlope(raw, { borders: false })).toThrow(SlopeError);
    expect(() => parseSlope(raw, { borders: false })).toThrow(msg);
  });

  it('adds border pines by default', () => {
    const s = parseSlope(rawSlope());
    expect(s.hazards.length).toBeGreaterThan(20);
    expect(s.hazards.every((h) => h.kind === 'pine')).toBe(true);
  });
});

describe('borderPines', () => {
  it('is deterministic and keeps to the powder edges past the start', () => {
    const a = borderPines(200);
    expect(borderPines(200)).toEqual(a);
    for (const h of a) {
      const [c, d] = h.at;
      expect(c < 1.6 || c > 14.4).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0.5);
      expect(c).toBeLessThanOrEqual(15.5);
      expect(d).toBeGreaterThanOrEqual(6);
      expect(d).toBeLessThan(201);
    }
  });
});
```

- [ ] **Step 3: Run the test and check it fails**

Run: `npx vitest run games/bluebird-run/tests/unit/slope.test.ts`
Expected: FAIL, because the module isn't found.

- [ ] **Step 4: Implement the loader**

`G/src/world/slope.ts`:

```ts
import type { Vec2 } from '../core/geometry';
import { hash2 } from '../core/hash';
import { AIR, GATE, HAZARD_R, RUN, SLOPE } from '../sim/constants';

export const HAZARD_KINDS = ['pine', 'rock-s', 'rock-l', 'snowman'] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];
export const RIDER_LOOKS = ['skier-red', 'skier-green', 'boarder-purple'] as const;
export type RiderLook = (typeof RIDER_LOOKS)[number];
const SURFACE_KINDS = ['packed', 'shade'] as const;
export type SurfaceKind = (typeof SURFACE_KINDS)[number];
const GATE_COLORS = ['blue', 'red'] as const;
export type GateColor = (typeof GATE_COLORS)[number];

export interface Rect { readonly c0: number; readonly d0: number; readonly c1: number; readonly d1: number }
export interface Surface { readonly kind: SurfaceKind; readonly rect: Rect }
export interface Gate { readonly d: number; readonly c: readonly [number, number]; readonly color: GateColor }
export interface Ramp { readonly d: number; readonly c: number }
export interface Hazard { readonly kind: HazardKind; readonly at: Vec2 }
export interface OtherRider { readonly look: RiderLook; readonly speed: number; readonly path: readonly Vec2[] }

export interface Slope {
  readonly name: string;
  readonly length: number;
  readonly finish: number;
  readonly par: number;
  readonly surfaces: readonly Surface[];
  readonly gates: readonly Gate[];
  readonly ramps: readonly Ramp[];
  readonly hazards: readonly Hazard[];
  readonly riders: readonly OtherRider[];
  readonly flakes: readonly Vec2[];
}

export class SlopeError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function fail(msg: string): never {
  throw new SlopeError(`slope: ${msg}`);
}

function point(v: unknown, field: string, length: number): Vec2 {
  if (!Array.isArray(v) || v.length !== 2 || !v.every(isNum)) fail(`${field} must be [c, d]`);
  const [c, d] = v as number[];
  if (c < 0 || c > SLOPE.width || d < 0 || d > length) fail(`${field} [${c}, ${d}] is off the slope`);
  return [c, d];
}

function list(raw: Obj, key: string): unknown[] {
  const v = raw[key] ?? [];
  if (!Array.isArray(v)) fail(`${key} must be an array`);
  return v as unknown[];
}

function oneOf<T extends string>(v: unknown, options: readonly T[], field: string): T {
  if (typeof v !== 'string' || !options.includes(v as T)) fail(`${field} must be one of ${options.join(', ')}`);
  return v as T;
}

function obj(v: unknown, field: string): Obj {
  if (!isObj(v)) fail(`${field} must be an object`);
  return v as Obj;
}

function parseRect(v: unknown, field: string, length: number): Rect {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(isNum)) fail(`${field} must be [c0, d0, w, h]`);
  const [c0, d0, w, h] = v as number[];
  if (w <= 0 || h <= 0) fail(`${field} needs a positive size`);
  point([c0, d0], field, length);
  point([c0 + w, d0 + h], field, length);
  return { c0, d0, c1: c0 + w, d1: d0 + h };
}

function parseSurface(v: unknown, i: number, length: number): Surface {
  const f = `surfaces[${i}]`;
  const o = obj(v, f);
  return { kind: oneOf(o.kind, SURFACE_KINDS, `${f}.kind`), rect: parseRect(o.rect, `${f}.rect`, length) };
}

function parseGate(v: unknown, i: number, length: number): Gate {
  const f = `gates[${i}]`;
  const o = obj(v, f);
  if (!isNum(o.d)) fail(`${f} needs d`);
  if (!Array.isArray(o.c) || o.c.length !== 2 || !o.c.every(isNum)) fail(`${f}.c must be the two flag positions`);
  const [a, b] = o.c as number[];
  point([a, o.d as number], f, length);
  point([b, o.d as number], f, length);
  const gap = Math.abs(b - a);
  if (gap < GATE.minGap || gap > GATE.maxGap) fail(`${f} flags must be ${GATE.minGap}–${GATE.maxGap} tiles apart`);
  return { d: o.d as number, c: [Math.min(a, b), Math.max(a, b)], color: oneOf(o.color, GATE_COLORS, `${f}.color`) };
}

function parseRamp(v: unknown, i: number, length: number): Ramp {
  const f = `ramps[${i}]`;
  const o = obj(v, f);
  const [c, d] = point([o.c, o.d], f, length);
  if (d + AIR.rampLen > length) fail(`${f} runs off the end of the slope`);
  return { c, d };
}

function parseHazard(v: unknown, i: number, length: number): Hazard {
  const f = `hazards[${i}]`;
  const o = obj(v, f);
  return { kind: oneOf(o.kind, HAZARD_KINDS, `${f}.kind`), at: point(o.at, `${f}.at`, length) };
}

function parseRider(v: unknown, i: number, length: number): OtherRider {
  const f = `riders[${i}]`;
  const o = obj(v, f);
  if (!isNum(o.speed) || (o.speed as number) <= 0) fail(`${f} needs a positive speed`);
  const look = oneOf(o.look, RIDER_LOOKS, `${f}.look`);
  const raw = Array.isArray(o.path) ? o.path : [];
  if (raw.length < 2) fail(`${f}.path needs at least 2 points`);
  const path = raw.map((p, j) => point(p, `${f}.path[${j}]`, length));
  path.slice(1).forEach((p, j) => {
    if (p[1] <= path[j][1]) fail(`${f}.path must run downhill (increasing d)`);
  });
  return { look, speed: o.speed as number, path };
}

function checkGateOrder(gates: readonly Gate[]): void {
  gates.slice(1).forEach((g, i) => {
    if (g.d <= gates[i].d) fail(`gates[${i + 1}] must come after gates[${i}] (increasing d)`);
  });
}

const onRamp = (r: Ramp, [c, d]: Vec2, pad: number): boolean =>
  Math.abs(c - r.c) <= AIR.rampHalfWidth + pad && d >= r.d - pad && d <= r.d + AIR.rampLen + pad;
const inGate = (g: Gate, [c, d]: Vec2): boolean => Math.abs(d - g.d) < 0.6 && c > g.c[0] && c < g.c[1];

function checkHazards(s: Slope): void {
  s.hazards.forEach((h, i) => {
    const f = `hazards[${i}] (${h.kind})`;
    if (h.at[1] < RUN.safeStart) fail(`${f} is within the start area (d < ${RUN.safeStart})`);
    const r = s.ramps.findIndex((ramp) => onRamp(ramp, h.at, HAZARD_R[h.kind]));
    if (r >= 0) fail(`${f} sits on ramps[${r}]`);
    const g = s.gates.findIndex((gate) => inGate(gate, h.at));
    if (g >= 0) fail(`${f} sits inside gates[${g}]`);
  });
}

const BORDER = { from: 6, step: 1.6, density: 0.7 } as const;

/** Seeded pines along both powder edges (0.5–1.5 and 14.5–15.5 across), so the edges never need listing by hand. */
export function borderPines(length: number): Hazard[] {
  const rows = Math.ceil((length - BORDER.from) / BORDER.step);
  return Array.from({ length: rows }, (_, i) => i).flatMap((i) =>
    [0, 1].flatMap((side): Hazard[] => {
      if (hash2(i, side, 41) > BORDER.density) return [];
      const c = side === 0 ? 0.5 + hash2(i, side, 42) : SLOPE.width - 1.5 + hash2(i, side, 42);
      const d = BORDER.from + i * BORDER.step + hash2(i, side, 43) * 0.8;
      return d < length ? [{ kind: 'pine', at: [c, d] }] : [];
    }),
  );
}

export interface ParseOptions {
  /** Add the seeded border pines (default true). */
  readonly borders?: boolean;
}

export function parseSlope(raw: unknown, opts: ParseOptions = {}): Slope {
  const o = obj(raw, 'the slope');
  if (typeof o.name !== 'string' || o.name === '') fail('name must be a non-empty string');
  if (!Number.isInteger(o.length) || (o.length as number) < 50) fail('length must be a whole number of at least 50');
  const length = o.length as number;
  if (!isNum(o.finish) || (o.finish as number) < 20 || (o.finish as number) >= length) fail('finish must be between 20 and length');
  if (!isNum(o.par) || (o.par as number) <= 0) fail('par must be positive');
  const gates = list(o, 'gates').map((v, i) => parseGate(v, i, length));
  checkGateOrder(gates);
  const slope: Slope = {
    name: o.name as string,
    length,
    finish: o.finish as number,
    par: o.par as number,
    surfaces: list(o, 'surfaces').map((v, i) => parseSurface(v, i, length)),
    gates,
    ramps: list(o, 'ramps').map((v, i) => parseRamp(v, i, length)),
    hazards: list(o, 'hazards').map((v, i) => parseHazard(v, i, length)),
    riders: list(o, 'riders').map((v, i) => parseRider(v, i, length)),
    flakes: list(o, 'flakes').map((v, i) => point(v, `flakes[${i}]`, length)),
  };
  checkHazards(slope);
  return opts.borders === false ? slope : { ...slope, hazards: [...slope.hazards, ...borderPines(length)] };
}
```

Note: `obj(raw, 'the slope')` throws `slope: the slope must be an object`, which matches the
`/must be an object/` test.

- [ ] **Step 5: Run the test and check it passes**

Run: `npx vitest run games/bluebird-run/tests/unit/slope.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add games/bluebird-run/src/world/slope.ts games/bluebird-run/tests/helpers/make-slope.ts games/bluebird-run/tests/unit/slope.test.ts
git commit -m "feat: Bluebird Run slope loader with validation and border pines"
```

---

### Task 4: Board physics on the ground, crash and tumble

**Files:**
- Create: `G/src/sim/board.ts`
- Test: `G/tests/unit/board.test.ts`

- [ ] **Step 1: Write the failing test**

`G/tests/unit/board.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  canCrash, carveBrake, crash, facing, inPowder, newBoard, stepGround, stepTumble, turnHeading, type Board, type Controls,
} from '../../src/sim/board';
import { STEP } from '../../src/sim/constants';

const ride = (b: Board, seconds: number, controls: Controls = { turn: 0, jump: false }): Board => {
  let out = b;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = stepGround(out, controls, STEP);
  return out;
};

describe('heading', () => {
  it('turns at 150°/s and clamps at ±75', () => {
    expect(turnHeading(0, 1, 0.1)).toBeCloseTo(15);
    expect(turnHeading(0, -0.5, 0.1)).toBeCloseTo(-7.5);
    expect(turnHeading(70, 1, 0.1)).toBe(75);
    expect(turnHeading(-70, -1, 0.1)).toBe(-75);
  });
  it('straightens at 40°/s with no input, stopping exactly at 0', () => {
    expect(turnHeading(10, 0, 0.1)).toBeCloseTo(6);
    expect(turnHeading(-1, 0, 0.1)).toBe(0);
  });
});

describe('speed', () => {
  it('accelerates straight down toward a top speed of 8 tiles/s', () => {
    const b = ride(newBoard(8, 10), 12);
    expect(b.speed).toBeGreaterThan(7.9);
    expect(b.speed).toBeLessThanOrEqual(8);
  });
  it('never drops below 1 tile/s', () => {
    expect(ride(newBoard(8, 10), 0.1).speed).toBeGreaterThanOrEqual(1);
  });
  it('brakes on a hard carve', () => {
    expect(carveBrake(30)).toBe(0);
    expect(carveBrake(75)).toBeCloseTo(4);
    const fast = { ...newBoard(8, 10), speed: 8, heading: 75 };
    expect(ride(fast, 3, { turn: 1, jump: false }).speed).toBeLessThan(2);
  });
  it('is slow in deep powder at the edges', () => {
    expect(inPowder(1)).toBe(true);
    expect(inPowder(8)).toBe(false);
    expect(inPowder(15)).toBe(true);
    expect(ride(newBoard(1, 10), 12).speed).toBeLessThan(3);
  });
});

describe('movement', () => {
  it('moves downhill, and toward larger c when heading right', () => {
    const b = ride({ ...newBoard(8, 10), speed: 4, heading: 30 }, 0.5, { turn: 0.0001, jump: false });
    expect(b.d).toBeGreaterThan(10);
    expect(b.c).toBeGreaterThan(8);
  });
  it('keeps the rider on the slope', () => {
    const right = ride({ ...newBoard(15, 10), heading: 75, speed: 6 }, 2, { turn: 1, jump: false });
    const left = ride({ ...newBoard(1, 10), heading: -75, speed: 6 }, 2, { turn: -1, jump: false });
    expect(right.c).toBe(15.6);
    expect(left.c).toBe(0.4);
  });
});

describe('crash', () => {
  it('tumbles, slides to a stop, then stands up facing downhill with invulnerability', () => {
    const hit = crash({ ...newBoard(8, 50), speed: 6, heading: 40 });
    expect(hit.tumble).toBe(1.2);
    expect(canCrash(hit)).toBe(false);
    let b = hit;
    for (let i = 0; i < 80; i++) b = stepTumble(b, STEP);
    expect(b.tumble).toBe(0);
    expect(b.heading).toBe(0);
    expect(b.speed).toBe(0);
    expect(b.invuln).toBe(1.5);
    expect(b.d).toBeGreaterThan(50);
    expect(canCrash(ride(b, 1.6))).toBe(true);
  });
  it('reports facing as heading plus any spin', () => {
    const b = newBoard(8, 10);
    expect(facing({ ...b, heading: 20 })).toBe(20);
    expect(facing({ ...b, heading: 20, air: { kind: 'ollie', t: 0, duration: 1, peak: 1, base: 0, spin: 180, grab: 0, grabbing: false } })).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run games/bluebird-run/tests/unit/board.test.ts`. Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement it**

`G/src/sim/board.ts`:

```ts
import { BOARD, CRASH, SLOPE } from './constants';

/** Per-step input, the same shape for keyboard and touch. turn is −1…1 (proportional on touch). */
export interface Controls {
  readonly turn: number;
  readonly jump: boolean;
}

export const NO_CONTROLS: Controls = { turn: 0, jump: false };

export interface Air {
  readonly kind: 'ollie' | 'ramp';
  /** Seconds since take-off. */
  readonly t: number;
  readonly duration: number;
  /** Arc height above the straight line from base to 0, tiles. */
  readonly peak: number;
  /** Height at take-off (the ramp lip), easing to 0 at landing. */
  readonly base: number;
  /** Accumulated spin, degrees (sign = direction). */
  readonly spin: number;
  /** Seconds of grab held. */
  readonly grab: number;
  /** Grab held on the latest step (drives the pose). */
  readonly grabbing: boolean;
}

export interface Board {
  readonly c: number;
  readonly d: number;
  /** Degrees from straight downhill; > 0 heads toward larger c (screen-right). */
  readonly heading: number;
  /** Tiles per second along the heading. */
  readonly speed: number;
  /** Height above the snow, tiles. */
  readonly z: number;
  readonly air: Air | null;
  /** Seconds of crash tumble left. */
  readonly tumble: number;
  /** Seconds of blinking invulnerability left. */
  readonly invuln: number;
  /** Seconds before another ollie is allowed. */
  readonly regrab: number;
}

export const newBoard = (c: number, d: number): Board => ({ c, d, heading: 0, speed: 0, z: 0, air: null, tumble: 0, invuln: 0, regrab: 0 });

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const toRad = (deg: number): number => (deg * Math.PI) / 180;

export const inPowder = (c: number): boolean => c < SLOPE.powder || c > SLOPE.width - SLOPE.powder;

export function turnHeading(h: number, turn: number, dt: number): number {
  if (turn !== 0) return clamp(h + turn * BOARD.turnRate * dt, -BOARD.maxHeading, BOARD.maxHeading);
  const step = BOARD.straighten * dt;
  return Math.abs(h) <= step ? 0 : h - Math.sign(h) * step;
}

/** Extra braking (tiles/s²) once the carve passes carveFrom degrees. */
export function carveBrake(h: number): number {
  const over = Math.abs(h) - BOARD.carveFrom;
  return over > 0 ? (BOARD.carveBrake * over) / BOARD.carveSpan : 0;
}

export function stepSpeed(v: number, h: number, c: number, dt: number): number {
  const drag = BOARD.drag * (inPowder(c) ? BOARD.powderDrag : 1);
  const a = BOARD.pull * Math.cos(toRad(h)) - drag * v - carveBrake(h);
  return Math.max(BOARD.minSpeed, v + a * dt);
}

/** Where the board ends up after dt along its heading and speed (c clamped to the slope). */
export function travel(b: Board, dt: number): { readonly c: number; readonly d: number } {
  const r = toRad(b.heading);
  return { c: clamp(b.c + b.speed * Math.sin(r) * dt, SLOPE.minC, SLOPE.maxC), d: b.d + b.speed * Math.cos(r) * dt };
}

const tickTimers = (b: Board, dt: number) => ({ invuln: Math.max(0, b.invuln - dt), regrab: Math.max(0, b.regrab - dt) });

export function stepGround(b: Board, controls: Controls, dt: number): Board {
  const heading = turnHeading(b.heading, controls.turn, dt);
  const speed = stepSpeed(b.speed, heading, b.c, dt);
  const next = { ...b, heading, speed, ...tickTimers(b, dt) };
  return { ...next, ...travel(next, dt) };
}

export const canCrash = (b: Board): boolean => b.tumble <= 0 && b.invuln <= 0;

export const crash = (b: Board): Board => ({ ...b, tumble: CRASH.tumble, air: null, z: 0, regrab: 0 });

export function stepTumble(b: Board, dt: number): Board {
  const tumble = Math.max(0, b.tumble - dt);
  const moved = { ...b, ...travel(b, dt), speed: b.speed * Math.exp(-CRASH.slide * dt), tumble };
  return tumble > 0 ? moved : { ...moved, heading: 0, speed: 0, invuln: CRASH.invuln };
}

/** Which way the rider's body points, degrees: heading plus any spin in the air. */
export const facing = (b: Board): number => b.heading + (b.air?.spin ?? 0);
```

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run games/bluebird-run/tests/unit/board.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/bluebird-run/src/sim/board.ts games/bluebird-run/tests/unit/board.test.ts
git commit -m "feat: Bluebird Run board physics (carve, speed, powder, tumble)"
```

---

### Task 5: Ollie, ramps and air

**Files:**
- Create: `G/src/sim/air.ts`
- Test: `G/tests/unit/air.test.ts`

- [ ] **Step 1: Write the failing test**

`G/tests/unit/air.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  airHeight, canOllie, crossedLip, groundZ, hasLanded, launch, ollie, rampAirtime, stepAir, touchDown,
} from '../../src/sim/air';
import { crash, newBoard, type Board } from '../../src/sim/board';
import { STEP } from '../../src/sim/constants';

const fly = (b: Board, seconds: number, turn = 0, jump = false): Board => {
  let out = b;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = stepAir(out, { turn, jump }, STEP);
  return out;
};

describe('ollie', () => {
  it('takes off from the ground only', () => {
    const b = { ...newBoard(8, 20), speed: 5 };
    const up = ollie(b);
    expect(up.air).toMatchObject({ kind: 'ollie', duration: 0.45, peak: 0.5, base: 0, t: 0, spin: 0, grab: 0 });
    expect(ollie(up)).toBe(up);
    expect(ollie(crash(b))).toEqual(crash(b));
    expect(canOllie({ ...b, regrab: 0.1 })).toBe(false);
  });
  it('arcs up to 0.5 tiles and lands after 0.45 s', () => {
    const up = ollie({ ...newBoard(8, 20), speed: 5 });
    expect(fly(up, 0.225).z).toBeCloseTo(0.5, 1);
    expect(hasLanded(fly(up, 0.2))).toBe(false);
    expect(hasLanded(fly(up, 0.46))).toBe(true);
  });
});

describe('ramps', () => {
  const ramp = { d: 50, c: 8 };
  it('stays longer in the air the faster you hit the lip', () => {
    expect(rampAirtime(3)).toBeCloseTo(0.8);
    expect(rampAirtime(8)).toBeCloseTo(1.3);
    const air = launch({ ...newBoard(8, 53), speed: 8 }).air!;
    expect(air).toMatchObject({ kind: 'ramp', base: 0.5 });
    expect(air.peak).toBeCloseTo(0.25 * 1.3 * 8);
  });
  it('detects crossing the lip only inside the ramp width', () => {
    const at = (c: number, d: number) => ({ ...newBoard(c, d), speed: 6 });
    expect(crossedLip(ramp, 52.9, at(8, 53.05))).toBe(true);
    expect(crossedLip(ramp, 52.9, at(10.5, 53.05))).toBe(false);
    expect(crossedLip(ramp, 53.1, at(8, 53.2))).toBe(false);
  });
  it('raises the snow along the ramp', () => {
    expect(groundZ([ramp], 8, 49)).toBe(0);
    expect(groundZ([ramp], 8, 51.5)).toBeCloseTo(0.25);
    expect(groundZ([ramp], 12, 51.5)).toBe(0);
  });
});

describe('air step', () => {
  it('starts at the base height, eases down to 0 and moves with take-off speed', () => {
    const a = launch({ ...newBoard(8, 53), speed: 6 }).air!;
    expect(airHeight(a)).toBeCloseTo(0.5);
    expect(airHeight({ ...a, t: a.duration })).toBeCloseTo(0);
    const b = fly(launch({ ...newBoard(8, 53), speed: 6 }), 0.5);
    expect(b.d).toBeCloseTo(56, 1);
    expect(b.speed).toBe(6);
  });
  it('spins at 540°/s with full turn input and builds grab time while jump is held', () => {
    const b = fly(launch({ ...newBoard(8, 53), speed: 8 }), 0.5, -1, true);
    expect(b.air!.spin).toBeCloseTo(-270, 0);
    expect(b.air!.grab).toBeCloseTo(0.5, 1);
    expect(b.air!.grabbing).toBe(true);
    expect(fly(b, STEP, 0, false).air!.grabbing).toBe(false);
  });
  it('touches down on the snow with a short regrab delay', () => {
    const b = touchDown(fly(ollie({ ...newBoard(8, 20), speed: 5 }), 0.5));
    expect(b.air).toBeNull();
    expect(b.z).toBe(0);
    expect(b.regrab).toBe(0.15);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run games/bluebird-run/tests/unit/air.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement it**

`G/src/sim/air.ts`:

```ts
import type { Ramp } from '../world/slope';
import { travel, type Air, type Board, type Controls } from './board';
import { AIR } from './constants';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const canOllie = (b: Board): boolean => b.air === null && b.tumble <= 0 && b.regrab <= 0;

const takeOff = (b: Board, arc: Pick<Air, 'kind' | 'duration' | 'peak' | 'base'>): Board =>
  ({ ...b, air: { ...arc, t: 0, spin: 0, grab: 0, grabbing: false } });

/** A small hop from the ground (Space / tap). Unchanged when not allowed. */
export const ollie = (b: Board): Board =>
  canOllie(b) ? takeOff(b, { kind: 'ollie', duration: AIR.ollieTime, peak: AIR.ollieHeight, base: 0 }) : b;

export const rampAirtime = (speed: number): number => AIR.rampBase + AIR.rampPerSpeed * speed;

/** Leaves a kicker's lip: faster means longer and higher. */
export function launch(b: Board): Board {
  const duration = rampAirtime(b.speed);
  return takeOff({ ...b, z: AIR.lipHeight }, { kind: 'ramp', duration, peak: AIR.rampPeakK * duration * b.speed, base: AIR.lipHeight });
}

/** Height on the arc: eases from base to 0 with a parabolic bump of `peak`. */
export function airHeight(a: Air): number {
  const u = clamp01(a.t / a.duration);
  return a.base * (1 - u) + 4 * a.peak * u * (1 - u);
}

/** One step in the air: the board keeps its take-off heading and speed; turn spins, jump grabs. */
export function stepAir(b: Board, controls: Controls, dt: number): Board {
  if (!b.air) return b;
  const a = b.air;
  const air: Air = {
    ...a,
    t: a.t + dt,
    spin: a.spin + controls.turn * AIR.spinRate * dt,
    grab: controls.jump ? a.grab + dt : a.grab,
    grabbing: controls.jump,
  };
  return { ...b, ...travel(b, dt), air, z: airHeight(air), invuln: Math.max(0, b.invuln - dt) };
}

export const hasLanded = (b: Board): boolean => b.air !== null && b.air.t >= b.air.duration;

export const touchDown = (b: Board): Board => ({ ...b, air: null, z: 0, regrab: AIR.regrab });

export const onRamp = (r: Ramp, c: number, d: number): boolean =>
  Math.abs(c - r.c) <= AIR.rampHalfWidth && d >= r.d && d < r.d + AIR.rampLen;

/** Snow height under a point: rises along a ramp to its lip, 0 elsewhere. */
export function groundZ(ramps: readonly Ramp[], c: number, d: number): number {
  const r = ramps.find((ramp) => onRamp(ramp, c, d));
  return r ? AIR.lipHeight * clamp01((d - r.d) / AIR.rampLen) : 0;
}

/** True on the step a grounded board passes a ramp's lip within its width. */
export const crossedLip = (r: Ramp, prevD: number, b: Board): boolean =>
  b.air === null && Math.abs(b.c - r.c) <= AIR.rampHalfWidth && prevD < r.d + AIR.rampLen && b.d >= r.d + AIR.rampLen;
```

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run games/bluebird-run/tests/unit/air.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/bluebird-run/src/sim/air.ts games/bluebird-run/tests/unit/air.test.ts
git commit -m "feat: Bluebird Run ollie, kicker launch and air step"
```

---

### Task 6: Tricks and landings

**Files:**
- Create: `G/src/sim/tricks.ts`
- Test: `G/tests/unit/tricks.test.ts`

- [ ] **Step 1: Write the failing test**

`G/tests/unit/tricks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isCleanLanding, trickName, trickOf } from '../../src/sim/tricks';

describe('isCleanLanding', () => {
  it.each([[0, true], [30, true], [35, true], [36, false], [90, false], [145, true], [180, true], [216, false], [360, true], [-180, true], [-200, true], [-250, false]])(
    'spin %s° → %s', (spin, clean) => {
      expect(isCleanLanding(spin)).toBe(clean);
    },
  );
});

describe('trickOf', () => {
  it('is null for a plain landing', () => {
    expect(trickOf(10, 0.1)).toBeNull();
  });
  it('scores 150 per 180° of spin in either direction', () => {
    expect(trickOf(360, 0)).toEqual({ halves: 2, grabbed: false, points: 300, name: '360' });
    expect(trickOf(-170, 0)).toEqual({ halves: 1, grabbed: false, points: 150, name: '180' });
  });
  it('needs 0.3 s of grab for the grab bonus', () => {
    expect(trickOf(0, 0.29)).toBeNull();
    expect(trickOf(0, 0.3)).toEqual({ halves: 0, grabbed: true, points: 200, name: 'Grab' });
    expect(trickOf(180, 0.5)).toEqual({ halves: 1, grabbed: true, points: 350, name: '180 Grab' });
  });
  it('adds a ×1.5 style bonus for 360° or more with a grab', () => {
    expect(trickOf(540, 0.4)).toEqual({ halves: 3, grabbed: true, points: 975, name: '540 Grab' });
  });
  it('names tricks', () => {
    expect(trickName(4, false)).toBe('720');
    expect(trickName(0, true)).toBe('Grab');
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run games/bluebird-run/tests/unit/tricks.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement it**

`G/src/sim/tricks.ts`:

```ts
import { TRICK } from './constants';

export interface Trick {
  /** Half-turns (180° each) landed. */
  readonly halves: number;
  readonly grabbed: boolean;
  readonly points: number;
  readonly name: string;
}

/** Clean when the spin ends within ±35° of any multiple of 180° (switch landings are fine). */
export function isCleanLanding(spin: number): boolean {
  return Math.abs(spin - 180 * Math.round(spin / 180)) <= TRICK.window;
}

export function trickName(halves: number, grabbed: boolean): string {
  return [halves > 0 ? String(halves * 180) : '', grabbed ? 'Grab' : ''].filter(Boolean).join(' ');
}

/** The trick a clean landing scores, or null if there was nothing to score. */
export function trickOf(spin: number, grabTime: number): Trick | null {
  const halves = Math.abs(Math.round(spin / 180));
  const grabbed = grabTime >= TRICK.grabMin;
  if (halves === 0 && !grabbed) return null;
  const base = halves * TRICK.per180 + (grabbed ? TRICK.grab : 0);
  const styled = grabbed && halves * 180 >= TRICK.styleMin;
  return { halves, grabbed, points: Math.round(base * (styled ? TRICK.style : 1)), name: trickName(halves, grabbed) };
}
```

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run games/bluebird-run/tests/unit/tricks.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/bluebird-run/src/sim/tricks.ts games/bluebird-run/tests/unit/tricks.test.ts
git commit -m "feat: Bluebird Run spin and grab tricks with landing check"
```

---

### Task 7: Slalom gates and streaks

**Files:**
- Create: `G/src/sim/gates.ts`
- Test: `G/tests/unit/gates.test.ts`

- [ ] **Step 1: Write the failing test**

`G/tests/unit/gates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { between, crossGates, gatePoints, NO_GATES } from '../../src/sim/gates';
import type { Gate } from '../../src/world/slope';

const gates: Gate[] = [
  { d: 10, c: [6, 10], color: 'blue' },
  { d: 20, c: [3, 7], color: 'red' },
  { d: 30, c: [8, 12], color: 'blue' },
];

describe('gates', () => {
  it('counts poles as inside, with a little slack', () => {
    expect(between(gates[0], 6)).toBe(true);
    expect(between(gates[0], 10.3)).toBe(true);
    expect(between(gates[0], 10.4)).toBe(false);
  });
  it('scores 100 plus 50 for each earlier gate in the streak', () => {
    expect(gatePoints(0)).toBe(100);
    expect(gatePoints(2)).toBe(200);
  });
  it('does nothing before the next gate', () => {
    expect(crossGates(gates, NO_GATES, 9.9, 8)).toEqual({ progress: NO_GATES, results: [] });
  });
  it('passes gates in order and grows the streak', () => {
    const a = crossGates(gates, NO_GATES, 10, 8);
    expect(a.results).toEqual([{ kind: 'pass', index: 0, points: 100, streak: 1 }]);
    const b = crossGates(gates, a.progress, 20, 5);
    expect(b.results).toEqual([{ kind: 'pass', index: 1, points: 150, streak: 2 }]);
    expect(b.progress).toEqual({ next: 2, streak: 2, passed: 2 });
  });
  it('resets the streak on a miss without other cost', () => {
    const a = crossGates(gates, { next: 1, streak: 1, passed: 1 }, 20, 12);
    expect(a.results).toEqual([{ kind: 'miss', index: 1 }]);
    expect(a.progress).toEqual({ next: 2, streak: 0, passed: 1 });
    expect(crossGates(gates, a.progress, 30, 9).results).toEqual([{ kind: 'pass', index: 2, points: 100, streak: 1 }]);
  });
  it('resolves several gates crossed in one step', () => {
    expect(crossGates(gates, NO_GATES, 30, 9).results.map((r) => r.kind)).toEqual(['pass', 'miss', 'pass']);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run games/bluebird-run/tests/unit/gates.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement it**

`G/src/sim/gates.ts`:

```ts
import type { Gate } from '../world/slope';
import { GATE } from './constants';

export interface GateProgress {
  /** Index of the next gate to resolve. */
  readonly next: number;
  /** Unbroken passes so far. */
  readonly streak: number;
  readonly passed: number;
}

export const NO_GATES: GateProgress = { next: 0, streak: 0, passed: 0 };

export type GateResult =
  | { readonly kind: 'pass'; readonly index: number; readonly points: number; readonly streak: number }
  | { readonly kind: 'miss'; readonly index: number };

export const gatePoints = (streakBefore: number): number => GATE.base + GATE.streak * streakBefore;

export const between = (g: Gate, c: number): boolean => c >= g.c[0] - GATE.poleSlack && c <= g.c[1] + GATE.poleSlack;

/** Resolves every gate whose line the rider has reached (gates are sorted by d). */
export function crossGates(gates: readonly Gate[], progress: GateProgress, d: number, c: number): { progress: GateProgress; results: GateResult[] } {
  if (progress.next >= gates.length || gates[progress.next].d > d) return { progress, results: [] };
  const index = progress.next;
  const result: GateResult = between(gates[index], c)
    ? { kind: 'pass', index, points: gatePoints(progress.streak), streak: progress.streak + 1 }
    : { kind: 'miss', index };
  const next: GateProgress = result.kind === 'pass'
    ? { next: index + 1, streak: result.streak, passed: progress.passed + 1 }
    : { next: index + 1, streak: 0, passed: progress.passed };
  const rest = crossGates(gates, next, d, c);
  return { progress: rest.progress, results: [result, ...rest.results] };
}
```

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run games/bluebird-run/tests/unit/gates.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/bluebird-run/src/sim/gates.ts games/bluebird-run/tests/unit/gates.test.ts
git commit -m "feat: Bluebird Run slalom gates with streak scoring"
```

---

### Task 8: Hazards and other riders

**Files:**
- Create: `G/src/sim/hazards.ts`
- Test: `G/tests/unit/hazards.test.ts`

- [ ] **Step 1: Write the failing test**

`G/tests/unit/hazards.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hitHazard, hitsRider, pathLength, pointAlong, riderPos, wakes } from '../../src/sim/hazards';
import type { Hazard, OtherRider } from '../../src/world/slope';

const hazards: Hazard[] = [
  { kind: 'pine', at: [4, 20] },
  { kind: 'rock-s', at: [8, 30] },
  { kind: 'rock-l', at: [10, 40] },
  { kind: 'snowman', at: [6, 50] },
];

describe('hitHazard', () => {
  it('finds an overlap between the rider and a footprint', () => {
    expect(hitHazard(hazards, 4.5, 20.2, 0)).toBe(0);
    expect(hitHazard(hazards, 5.2, 20, 0)).toBe(-1);
  });
  it('lets an ollie clear a small rock but not a big one', () => {
    expect(hitHazard(hazards, 8, 30, 0.2)).toBe(1);
    expect(hitHazard(hazards, 8, 30, 0.4)).toBe(-1);
    expect(hitHazard(hazards, 10, 40, 0.5)).toBe(2);
    expect(hitHazard(hazards, 10, 40, 0.7)).toBe(-1);
  });
  it('lets a high kicker jump clear a snowman, and skips burst ones', () => {
    expect(hitHazard(hazards, 6, 50, 0.9)).toBe(3);
    expect(hitHazard(hazards, 6, 50, 1.1)).toBe(-1);
    expect(hitHazard(hazards, 6, 50, 0, [3])).toBe(-1);
  });
});

describe('other riders', () => {
  const r: OtherRider = { look: 'skier-red', speed: 2, path: [[8, 100], [8, 110], [4, 113]] };
  it('measures and walks a path', () => {
    expect(pathLength(r.path)).toBeCloseTo(15);
    expect(pointAlong(r.path, 0)).toEqual({ c: 8, d: 100 });
    expect(pointAlong(r.path, 5)).toEqual({ c: 8, d: 105 });
    expect(pointAlong(r.path, 12.5)).toEqual({ c: 6, d: 111.5 });
    expect(pointAlong(r.path, 15.1)).toBeNull();
  });
  it('wakes when the player comes within 30 tiles above its start', () => {
    expect(wakes(r, 69)).toBe(false);
    expect(wakes(r, 70)).toBe(true);
  });
  it('moves along its path from the moment it woke', () => {
    expect(riderPos(r, null, 50)).toBeNull();
    expect(riderPos(r, 10, 12.5)).toEqual({ c: 8, d: 105 });
  });
  it('crashes the player on touch unless they are high enough', () => {
    const at = [{ c: 8, d: 105 }, null];
    expect(hitsRider(at, 8.4, 105.2, 0)).toBe(true);
    expect(hitsRider(at, 9, 105, 0)).toBe(false);
    expect(hitsRider(at, 8, 105, 1.3)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run games/bluebird-run/tests/unit/hazards.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement it**

`G/src/sim/hazards.ts`:

```ts
import { distance, type Vec2 } from '../core/geometry';
import type { Hazard, OtherRider } from '../world/slope';
import { BOARD, CLEAR_Z, HAZARD_R, RIDERS } from './constants';

/** Index of the hazard the rider at (c, d, z) overlaps, or −1. `skip` lists hazards that are gone (burst snowmen). */
export function hitHazard(hazards: readonly Hazard[], c: number, d: number, z: number, skip: readonly number[] = []): number {
  return hazards.findIndex((h, i) =>
    Math.abs(h.at[1] - d) < 1.5 && z < CLEAR_Z[h.kind] && !skip.includes(i) && distance(h.at, [c, d]) <= HAZARD_R[h.kind] + BOARD.radius);
}

export interface RiderPos {
  readonly c: number;
  readonly d: number;
}

export function pathLength(path: readonly Vec2[]): number {
  return path.slice(1).reduce((n, p, i) => n + distance(path[i], p), 0);
}

/** The point `dist` tiles along a path, or null past its end (the rider has left the slope). */
export function pointAlong(path: readonly Vec2[], dist: number): RiderPos | null {
  let left = dist;
  for (let i = 1; i < path.length; i++) {
    const seg = distance(path[i - 1], path[i]);
    if (left <= seg) {
      const t = seg === 0 ? 0 : left / seg;
      return { c: path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, d: path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t };
    }
    left -= seg;
  }
  return null;
}

export const wakes = (r: OtherRider, playerD: number): boolean => playerD >= r.path[0][1] - RIDERS.wake;

export const riderPos = (r: OtherRider, startedAt: number | null, now: number): RiderPos | null =>
  startedAt === null ? null : pointAlong(r.path, r.speed * Math.max(0, now - startedAt));

export function hitsRider(positions: readonly (RiderPos | null)[], c: number, d: number, z: number): boolean {
  if (z >= CLEAR_Z.rider) return false;
  return positions.some((p) => p !== null && distance([p.c, p.d], [c, d]) <= RIDERS.radius + BOARD.radius);
}
```

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run games/bluebird-run/tests/unit/hazards.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/bluebird-run/src/sim/hazards.ts games/bluebird-run/tests/unit/hazards.test.ts
git commit -m "feat: Bluebird Run hazard overlaps and other riders on paths"
```

---

### Task 9: Game events, scoring and storage

**Files:**
- Create: `G/src/game/events.ts`, `G/src/game/score.ts`
- Test: `G/tests/unit/score.test.ts`

- [ ] **Step 1: Write the failing test**

`G/tests/unit/score.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { emit } from '../../src/game/events';
import { BEST_KEY, loadBest, loadMuted, MUTE_KEY, saveBest, saveMuted, timeBonus, type KeyValueStore } from '../../src/game/score';

const memory = (init: Record<string, string> = {}): KeyValueStore => {
  const data = new Map(Object.entries(init)); // a test fake store: mutated on purpose
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('timeBonus', () => {
  it('pays 40 per second under par, never negative', () => {
    expect(timeBonus(60, 75)).toBe(600);
    expect(timeBonus(74.26, 75)).toBe(30);
    expect(timeBonus(80, 75)).toBe(0);
  });
});

describe('best score', () => {
  it('loads 0 when missing, junk or unavailable', () => {
    expect(loadBest(null)).toBe(0);
    expect(loadBest(memory({ [BEST_KEY]: 'abc' }))).toBe(0);
    expect(loadBest(memory({ [BEST_KEY]: '1234' }))).toBe(1234);
  });
  it('only saves a better score', () => {
    const store = memory({ [BEST_KEY]: '500' });
    expect(saveBest(store, 300)).toBe(500);
    expect(saveBest(store, 900)).toBe(900);
    expect(loadBest(store)).toBe(900);
  });
  it('survives a store that throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bad: KeyValueStore = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    expect(loadBest(bad)).toBe(0);
    expect(saveBest(bad, 10)).toBe(10);
    expect(loadMuted(bad)).toBe(false);
    saveMuted(bad, true);
    warn.mockRestore();
  });
});

describe('mute flag', () => {
  it('round-trips', () => {
    const store = memory();
    expect(loadMuted(store)).toBe(false);
    saveMuted(store, true);
    expect(store.getItem(MUTE_KEY)).toBe('1');
    expect(loadMuted(store)).toBe(true);
  });
});

describe('emit', () => {
  it('appends events without touching the original', () => {
    const s = { events: [{ type: 'go' as const }] };
    const t = emit(s, { type: 'flake' });
    expect(t.events).toEqual([{ type: 'go' }, { type: 'flake' }]);
    expect(s.events).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run games/bluebird-run/tests/unit/score.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement them**

`G/src/game/events.ts`:

```ts
import type { Vec2 } from '../core/geometry';
import type { Trick } from '../sim/tricks';

export type GameEvent =
  | { readonly type: 'beep'; readonly n: number }
  | { readonly type: 'go' }
  | { readonly type: 'ollie' }
  | { readonly type: 'launch' }
  | { readonly type: 'land'; readonly trick: Trick | null }
  | { readonly type: 'wipeout' }
  | { readonly type: 'crash'; readonly what: string }
  | { readonly type: 'burst'; readonly at: Vec2 }
  | { readonly type: 'gate'; readonly points: number; readonly streak: number }
  | { readonly type: 'miss' }
  | { readonly type: 'flake' }
  | { readonly type: 'finish'; readonly time: number; readonly bonus: number };

/** Appends events to any state that carries an event list. */
export const emit = <T extends { readonly events: readonly GameEvent[] }>(s: T, ...events: GameEvent[]): T => ({
  ...s,
  events: [...s.events, ...events],
});
```

`G/src/game/score.ts`:

```ts
import { RUN } from '../sim/constants';

export const timeBonus = (time: number, par: number): number => Math.round(Math.max(0, par - time) * RUN.bonusPerSecond);

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const BEST_KEY = 'bluebird-run.best';
export const MUTE_KEY = 'bluebird-run.muted';

function read(store: KeyValueStore | null, key: string): string | null {
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(store: KeyValueStore | null, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch (err) {
    console.warn(`Could not save ${key}:`, err);
  }
}

export function loadBest(store: KeyValueStore | null): number {
  const n = Number(read(store, BEST_KEY));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Stores `score` if it beats the saved best; returns the best either way. */
export function saveBest(store: KeyValueStore | null, score: number): number {
  const prev = loadBest(store);
  if (score <= prev) return prev;
  write(store, BEST_KEY, String(score));
  return score;
}

export const loadMuted = (store: KeyValueStore | null): boolean => read(store, MUTE_KEY) === '1';
export const saveMuted = (store: KeyValueStore | null, muted: boolean): void => write(store, MUTE_KEY, muted ? '1' : '0');
```

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run games/bluebird-run/tests/unit/score.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/bluebird-run/src/game/events.ts games/bluebird-run/src/game/score.ts games/bluebird-run/tests/unit/score.test.ts
git commit -m "feat: Bluebird Run events, time bonus and saved best/mute"
```

---

### Task 10: Game state reducer and the riding tick

**Files:**
- Create: `G/src/game/state.ts`, `G/src/game/tick.ts`
- Test: `G/tests/unit/state.test.ts`

- [ ] **Step 1: Write the failing test**

`G/tests/unit/state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clearEvents, initialState, newRun, reduce, type GameState } from '../../src/game/state';
import type { Controls } from '../../src/sim/board';
import { STEP } from '../../src/sim/constants';
import type { Slope } from '../../src/world/slope';
import { makeSlope } from '../helpers/make-slope';

const NONE: Controls = { turn: 0, jump: false };
const tickFor = (s: GameState, slope: Slope, seconds: number, controls: Controls = NONE): GameState => {
  let out = s;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = reduce(out, { type: 'tick', dt: STEP, controls }, slope);
  return out;
};
const riding = (slope: Slope, over: Partial<GameState> = {}): GameState => ({ ...newRun(slope), phase: 'riding', clock: 0, events: [], ...over });
const types = (s: GameState) => s.events.map((e) => e.type);

describe('run flow', () => {
  const slope = makeSlope();
  it('starts on the title card and ignores ticks there', () => {
    const s = initialState(slope);
    expect(s.phase).toBe('title');
    expect(tickFor(s, slope, 1)).toEqual(s);
  });
  it('counts down 3, 2, 1, then goes', () => {
    const s = reduce(initialState(slope), { type: 'start' }, slope);
    expect(s.phase).toBe('countdown');
    expect(s.events).toEqual([{ type: 'beep', n: 3 }]);
    const later = tickFor(clearEvents(s), slope, 3.05);
    expect(later.events).toEqual([{ type: 'beep', n: 2 }, { type: 'beep', n: 1 }, { type: 'go' }]);
    expect(later.phase).toBe('riding');
    expect(later.board.d).toBeCloseTo(4, 1); // only a tick or two of riding after "go"
  });
  it('rides downhill and runs the clock', () => {
    const s = tickFor(riding(slope), slope, 2);
    expect(s.board.d).toBeGreaterThan(8);
    expect(s.time).toBeCloseTo(2);
  });
  it('pauses and resumes', () => {
    const p = reduce(riding(slope), { type: 'togglePause' }, slope);
    expect(p.paused).toBe(true);
    expect(tickFor(p, slope, 1)).toEqual(p);
    expect(reduce(p, { type: 'togglePause' }, slope).paused).toBe(false);
  });
  it('jumps on the title card to start, and ollies while riding', () => {
    expect(reduce(initialState(slope), { type: 'jump' }, slope).phase).toBe('countdown');
    const up = reduce(riding(slope), { type: 'jump' }, slope);
    expect(up.board.air?.kind).toBe('ollie');
    expect(types(up)).toEqual(['ollie']);
    expect(reduce(up, { type: 'jump' }, slope).events).toHaveLength(1);
  });
  it('restarts from anything but the title', () => {
    const s = tickFor(riding(slope), slope, 1);
    expect(reduce(s, { type: 'restart' }, slope).phase).toBe('countdown');
    expect(reduce(initialState(slope), { type: 'restart' }, slope).phase).toBe('title');
  });
});

describe('riding', () => {
  it('passes a gate and scores it', () => {
    const slope = makeSlope({ gates: [{ d: 12, c: [6, 10], color: 'blue' }] });
    const s = tickFor(riding(slope), slope, 3);
    expect(s.events).toContainEqual({ type: 'gate', points: 100, streak: 1 });
    expect(s.score).toBe(100);
    expect(s.gates.passed).toBe(1);
  });
  it('collects a snowflake once', () => {
    const slope = makeSlope({ flakes: [[8, 10]] });
    const s = tickFor(riding(slope), slope, 3);
    expect(s.flakes).toEqual([0]);
    expect(s.score).toBe(25);
    expect(types(s).filter((t) => t === 'flake')).toHaveLength(1);
  });
  it('crashes into a tree, tumbles and carries on', () => {
    const slope = makeSlope({ hazards: [{ kind: 'pine', at: [8, 10] }] });
    const s = tickFor(riding(slope), slope, 3);
    expect(s.events).toContainEqual({ type: 'crash', what: 'pine' });
    expect(s.crashes).toBe(1);
    expect(s.phase).toBe('riding');
  });
  it('bursts a snowman it hits, and the snowman is gone afterwards', () => {
    const slope = makeSlope({ hazards: [{ kind: 'snowman', at: [8, 10] }] });
    const s = tickFor(riding(slope), slope, 6);
    expect(s.burst).toEqual([0]);
    expect(types(s)).toContain('burst');
    expect(s.crashes).toBe(1);
  });
  it('launches off a kicker and lands clean', () => {
    const slope = makeSlope({ ramps: [{ d: 10, c: 8 }] });
    const s = tickFor(riding(slope), slope, 4);
    expect(types(s)).toContain('launch');
    expect(s.events).toContainEqual({ type: 'land', trick: null });
    expect(s.crashes).toBe(0);
  });
  it('scores a spin landed clean and remembers the best trick', () => {
    const slope = makeSlope({ ramps: [{ d: 10, c: 8 }] });
    let s = riding(slope);
    for (let i = 0; i < 600 && !s.board.air; i++) s = reduce(s, { type: 'tick', dt: STEP, controls: NONE }, slope);
    expect(s.board.air?.kind).toBe('ramp');
    // Spin until 360° (540°/s), then stop turning and let it land.
    while (s.board.air && Math.abs(s.board.air.spin) < 357) s = reduce(s, { type: 'tick', dt: STEP, controls: { turn: 1, jump: false } }, slope);
    s = tickFor(s, slope, 2);
    expect(s.bestTrick?.name).toBe('360');
    expect(s.score).toBe(300);
  });
  it('wipes out on a sideways landing', () => {
    const slope = makeSlope();
    const air = { kind: 'ollie' as const, t: 0.44, duration: 0.45, peak: 0.5, base: 0, spin: 90, grab: 0, grabbing: false };
    const s = tickFor(riding(slope, { board: { ...newRun(slope).board, speed: 5, air } }), slope, 0.05);
    expect(types(s)).toContain('wipeout');
    expect(s.board.tumble).toBeGreaterThan(0);
  });
  it('crashes into another rider once it wakes', () => {
    const slope = makeSlope({ riders: [{ look: 'skier-red', speed: 0.5, path: [[8, 12], [8, 30]] }] });
    const s = tickFor(riding(slope), slope, 4);
    expect(s.events).toContainEqual({ type: 'crash', what: 'rider' });
  });
});

describe('finish', () => {
  it('stops the clock at the line, pays the time bonus, runs out, then shows the end card', () => {
    const slope = makeSlope({ length: 60, finish: 20, par: 30 });
    let s = riding(slope);
    while (s.phase === 'riding') s = reduce(s, { type: 'tick', dt: STEP, controls: NONE }, slope);
    expect(s.phase).toBe('runout');
    const fin = s.events.find((e) => e.type === 'finish');
    expect(fin).toBeDefined();
    expect(s.finishTime).toBeCloseTo(s.time);
    expect(s.score).toBe(s.bonus);
    expect(s.bonus).toBeGreaterThan(0);
    const end = tickFor(s, slope, 1.6);
    expect(end.phase).toBe('over');
    expect(end.time).toBe(s.time);
    expect(reduce(end, { type: 'jump' }, slope).phase).toBe('countdown');
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run games/bluebird-run/tests/unit/state.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the reducer**

`G/src/game/state.ts`:

```ts
import { ollie } from '../sim/air';
import { newBoard, travel, turnHeading, type Board, type Controls } from '../sim/board';
import { RUN } from '../sim/constants';
import { NO_GATES, type GateProgress } from '../sim/gates';
import type { Trick } from '../sim/tricks';
import type { Slope } from '../world/slope';
import { emit, type GameEvent } from './events';
import { tick } from './tick';

export type { GameEvent } from './events';

export type Phase = 'title' | 'countdown' | 'riding' | 'runout' | 'over';

export interface GameState {
  readonly phase: Phase;
  readonly paused: boolean;
  /** Seconds left in the countdown or the finish run-out. */
  readonly clock: number;
  /** The run clock: seconds since "go", frozen at the finish line. */
  readonly time: number;
  readonly board: Board;
  readonly gates: GateProgress;
  /** Indices of snowflakes collected. */
  readonly flakes: readonly number[];
  /** Per other rider: the run time it woke, or null. */
  readonly riders: readonly (number | null)[];
  /** Indices of snowmen burst (no longer hazards). */
  readonly burst: readonly number[];
  readonly score: number;
  readonly tricks: number;
  readonly bestTrick: Trick | null;
  readonly crashes: number;
  readonly finishTime: number | null;
  readonly bonus: number;
  /** Events since the last clearEvents (read by audio, particles and HUD each frame). */
  readonly events: readonly GameEvent[];
}

export type Action =
  | { readonly type: 'start' }
  | { readonly type: 'restart' }
  | { readonly type: 'togglePause' }
  | { readonly type: 'jump' }
  | { readonly type: 'tick'; readonly dt: number; readonly controls: Controls };

export function newRun(slope: Slope): GameState {
  return {
    phase: 'countdown', paused: false, clock: RUN.countdown, time: 0, board: newBoard(RUN.startC, RUN.startD),
    gates: NO_GATES, flakes: [], riders: slope.riders.map(() => null), burst: [], score: 0, tricks: 0, bestTrick: null,
    crashes: 0, finishTime: null, bonus: 0, events: [{ type: 'beep', n: RUN.countdown }],
  };
}

export const initialState = (slope: Slope): GameState => ({ ...newRun(slope), phase: 'title', events: [] });
export const clearEvents = (s: GameState): GameState => (s.events.length === 0 ? s : { ...s, events: [] });

const PAUSABLE: readonly Phase[] = ['countdown', 'riding', 'runout'];

function stepCountdown(s: GameState, dt: number): GameState {
  const clock = s.clock - dt;
  if (clock <= 0) return emit({ ...s, phase: 'riding', clock: 0 }, { type: 'go' });
  const next = { ...s, clock };
  return Math.ceil(clock) < Math.ceil(s.clock) ? emit(next, { type: 'beep', n: Math.ceil(clock) }) : next;
}

/** After the line: straighten, brake to a stop, then the end card. */
function stepRunout(s: GameState, dt: number): GameState {
  const b = s.board;
  const slowed = { ...b, heading: turnHeading(b.heading, 0, dt), speed: Math.max(0, b.speed - RUN.runoutBrake * dt) };
  const board = { ...slowed, ...travel(slowed, dt) };
  const clock = s.clock - dt;
  return clock <= 0 ? { ...s, board, clock: 0, phase: 'over' } : { ...s, board, clock };
}

function jump(s: GameState, slope: Slope): GameState {
  if (s.phase === 'title' || s.phase === 'over') return newRun(slope);
  if (s.phase !== 'riding' || s.paused) return s;
  const board = ollie(s.board);
  return board === s.board ? s : emit({ ...s, board }, { type: 'ollie' });
}

export function reduce(s: GameState, a: Action, slope: Slope): GameState {
  switch (a.type) {
    case 'start': return s.phase === 'title' || s.phase === 'over' ? newRun(slope) : s;
    case 'restart': return s.phase === 'title' ? s : newRun(slope);
    case 'togglePause': return PAUSABLE.includes(s.phase) ? { ...s, paused: !s.paused } : s;
    case 'jump': return jump(s, slope);
    case 'tick':
      if (s.paused) return s;
      if (s.phase === 'countdown') return stepCountdown(s, a.dt);
      if (s.phase === 'riding') return tick(s, slope, a.controls, a.dt);
      if (s.phase === 'runout') return stepRunout(s, a.dt);
      return s;
  }
}
```

- [ ] **Step 4: Implement the riding tick**

`G/src/game/tick.ts`:

```ts
import { distance } from '../core/geometry';
import { crossedLip, groundZ, hasLanded, launch, stepAir, touchDown } from '../sim/air';
import { canCrash, crash, stepGround, stepTumble, type Board, type Controls } from '../sim/board';
import { BOARD, FLAKE, RUN } from '../sim/constants';
import { crossGates } from '../sim/gates';
import { hitHazard, hitsRider, riderPos, wakes } from '../sim/hazards';
import { isCleanLanding, trickOf } from '../sim/tricks';
import type { Slope } from '../world/slope';
import { emit, type GameEvent } from './events';
import { timeBonus } from './score';
import type { GameState } from './state';

type Step = (s: GameState, slope: Slope, prev: Board) => GameState;

function moveBoard(s: GameState, slope: Slope, controls: Controls, dt: number): GameState {
  const b = s.board;
  if (b.tumble > 0) return { ...s, board: stepTumble(b, dt) };
  if (b.air) return { ...s, board: stepAir(b, controls, dt) };
  const g = stepGround(b, controls, dt);
  return { ...s, board: { ...g, z: groundZ(slope.ramps, g.c, g.d) } };
}

const crashed = (s: GameState, event: GameEvent): GameState =>
  emit({ ...s, board: crash(s.board), crashes: s.crashes + 1 }, event);

const ramps: Step = (s, slope, prev) => {
  if (s.board.air || s.board.tumble > 0) return s;
  return slope.ramps.some((r) => crossedLip(r, prev.d, s.board)) ? emit({ ...s, board: launch(s.board) }, { type: 'launch' }) : s;
};

const landing: Step = (s) => {
  const b = s.board;
  if (!hasLanded(b) || !b.air) return s;
  if (!isCleanLanding(b.air.spin)) return crashed(s, { type: 'wipeout' });
  const trick = trickOf(b.air.spin, b.air.grab);
  const bestTrick = trick && (!s.bestTrick || trick.points > s.bestTrick.points) ? trick : s.bestTrick;
  return emit(
    { ...s, board: touchDown(b), score: s.score + (trick?.points ?? 0), tricks: s.tricks + (trick ? 1 : 0), bestTrick },
    { type: 'land', trick },
  );
};

const hazards: Step = (s, slope) => {
  const b = s.board;
  if (!canCrash(b)) return s;
  const i = hitHazard(slope.hazards, b.c, b.d, b.z, s.burst);
  if (i < 0) return s;
  const h = slope.hazards[i];
  const hit = crashed(s, { type: 'crash', what: h.kind });
  return h.kind === 'snowman' ? emit({ ...hit, burst: [...hit.burst, i] }, { type: 'burst', at: h.at }) : hit;
};

const riders: Step = (s, slope) => {
  const started = slope.riders.map((r, i) => s.riders[i] ?? (wakes(r, s.board.d) ? s.time : null));
  const next = started.every((v, i) => v === s.riders[i]) ? s : { ...s, riders: started };
  const b = next.board;
  if (!canCrash(b)) return next;
  const at = slope.riders.map((r, i) => riderPos(r, started[i], next.time));
  return hitsRider(at, b.c, b.d, b.z) ? crashed(next, { type: 'crash', what: 'rider' }) : next;
};

const gates: Step = (s, slope) => {
  const { progress, results } = crossGates(slope.gates, s.gates, s.board.d, s.board.c);
  if (results.length === 0) return s;
  const points = results.reduce((n, r) => n + (r.kind === 'pass' ? r.points : 0), 0);
  const events = results.map((r): GameEvent => (r.kind === 'pass' ? { type: 'gate', points: r.points, streak: r.streak } : { type: 'miss' }));
  return emit({ ...s, gates: progress, score: s.score + points }, ...events);
};

const flakes: Step = (s, slope) => {
  const b = s.board;
  const got = slope.flakes.flatMap((f, i) => (!s.flakes.includes(i) && distance(f, [b.c, b.d]) <= FLAKE.radius + BOARD.radius ? [i] : []));
  if (got.length === 0) return s;
  return emit({ ...s, flakes: [...s.flakes, ...got], score: s.score + got.length * FLAKE.points }, ...got.map((): GameEvent => ({ type: 'flake' })));
};

const finish: Step = (s, slope) => {
  if (s.board.d < slope.finish) return s;
  const bonus = timeBonus(s.time, slope.par);
  const board = s.board.air ? touchDown(s.board) : s.board;
  return emit(
    { ...s, phase: 'runout', clock: RUN.runout, finishTime: s.time, bonus, score: s.score + bonus, board },
    { type: 'finish', time: s.time, bonus },
  );
};

const STEPS: readonly Step[] = [ramps, landing, hazards, riders, gates, flakes, finish];

/** One fixed sim step of a run in progress. Later steps are skipped once the phase changes. */
export function tick(s: GameState, slope: Slope, controls: Controls, dt: number): GameState {
  const prev = s.board;
  const moved = moveBoard({ ...s, time: s.time + dt }, slope, controls, dt);
  return STEPS.reduce((acc, step) => (acc.phase === 'riding' ? step(acc, slope, prev) : acc), moved);
}
```

- [ ] **Step 5: Run the test and check it passes**

Run: `npx vitest run games/bluebird-run/tests/unit/state.test.ts`. Expected: PASS.

If `'scores a spin landed clean'` fails because the air ends before 357° is spun, the kicker
airtime is too short at the approach speed (`0.5 + 0.1·v` s needs v ≥ 1.7 for 0.67 s). Check
`stepSpeed`. Don't edit the constants.

- [ ] **Step 6: Commit**

```bash
git add games/bluebird-run/src/game/state.ts games/bluebird-run/src/game/tick.ts games/bluebird-run/tests/unit/state.test.ts
git commit -m "feat: Bluebird Run reducer: countdown, riding, tricks, crashes, finish"
```

---

### Task 11: Touch gestures and input wiring

**Files:**
- Create: `G/src/core/touch.ts`, `G/src/core/input.ts`
- Test: `G/tests/unit/touch.test.ts`, `G/tests/unit/input.test.ts`

- [ ] **Step 1: Write the failing tests**

`G/tests/unit/touch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NO_TOUCH, stepTouch, touchHeld, touchTurn, type TouchSample, type TouchState } from '../../src/core/touch';

const run = (samples: TouchSample[]) =>
  samples.reduce<{ state: TouchState; jumps: number }>((acc, e) => {
    const r = stepTouch(acc.state, e);
    return { state: r.state, jumps: acc.jumps + (r.jump ? 1 : 0) };
  }, { state: NO_TOUCH, jumps: 0 });

describe('touch steering', () => {
  it('maps drag offset from the anchor to turn, full at ±48 px', () => {
    const { state } = run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'move', id: 1, x: 124, y: 310, t: 50 }]);
    expect(touchTurn(state)).toBeCloseTo(0.5);
    expect(touchTurn(run([{ kind: 'down', id: 1, x: 100, y: 0, t: 0 }, { kind: 'move', id: 1, x: 20, y: 0, t: 50 }]).state)).toBe(-1);
    expect(touchTurn(NO_TOUCH)).toBe(0);
  });
  it('holds while any finger is down and releases to 0', () => {
    const down = run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }]);
    expect(touchHeld(down.state)).toBe(true);
    const up = run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'move', id: 1, x: 140, y: 300, t: 100 }, { kind: 'up', id: 1, x: 140, y: 300, t: 400 }]);
    expect(touchHeld(up.state)).toBe(false);
    expect(touchTurn(up.state)).toBe(0);
  });
});

describe('touch jumps', () => {
  it('jumps on a quick, still tap', () => {
    expect(run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'up', id: 1, x: 103, y: 302, t: 120 }]).jumps).toBe(1);
  });
  it('does not jump on a slow press or a drag', () => {
    expect(run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'up', id: 1, x: 100, y: 300, t: 400 }]).jumps).toBe(0);
    expect(run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'move', id: 1, x: 120, y: 300, t: 60 }, { kind: 'up', id: 1, x: 100, y: 300, t: 120 }]).jumps).toBe(0);
    expect(run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'cancel', id: 1, x: 100, y: 300, t: 50 }]).jumps).toBe(0);
  });
  it('jumps when a second finger lands while steering, and keeps steering', () => {
    const r = run([
      { kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'move', id: 1, x: 148, y: 300, t: 100 },
      { kind: 'down', id: 2, x: 300, y: 300, t: 200 }, { kind: 'up', id: 2, x: 300, y: 300, t: 260 },
    ]);
    expect(r.jumps).toBe(1);
    expect(touchTurn(r.state)).toBe(1);
  });
  it('ignores moves from fingers it is not tracking', () => {
    const r = run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'move', id: 9, x: 200, y: 300, t: 10 }]);
    expect(touchTurn(r.state)).toBe(0);
  });
});
```

`G/tests/unit/input.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { actionFor, isGameKey, keyControls, mergeControls } from '../../src/core/input';

describe('keyboard', () => {
  it('maps one-shot keys to actions', () => {
    expect(actionFor('Space')).toEqual({ type: 'jump' });
    expect(actionFor('Enter')).toEqual({ type: 'start' });
    expect(actionFor('KeyR')).toEqual({ type: 'restart' });
    expect(actionFor('Escape')).toEqual({ type: 'togglePause' });
    expect(actionFor('KeyZ')).toBeNull();
    expect(isGameKey('ArrowLeft')).toBe(true);
    expect(isGameKey('KeyZ')).toBe(false);
  });
  it('turns held keys into controls', () => {
    expect(keyControls(new Set(['ArrowRight']))).toEqual({ turn: 1, jump: false });
    expect(keyControls(new Set(['KeyA', 'Space']))).toEqual({ turn: -1, jump: true });
    expect(keyControls(new Set(['KeyA', 'KeyD']))).toEqual({ turn: 0, jump: false });
  });
  it('merges keyboard and touch, keyboard turn first', () => {
    expect(mergeControls({ turn: 0, jump: false }, { turn: 0.4, jump: true })).toEqual({ turn: 0.4, jump: true });
    expect(mergeControls({ turn: -1, jump: false }, { turn: 0.4, jump: false })).toEqual({ turn: -1, jump: false });
  });
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npx vitest run games/bluebird-run/tests/unit/touch.test.ts games/bluebird-run/tests/unit/input.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement touch.ts**

`G/src/core/touch.ts`:

```ts
/** Pure thumb-drag gesture interpreter (spec §5 Touch). Pointer wiring lives in input.ts. */

export const TOUCH = { fullTurnPx: 48, tapMs: 180, tapPx: 8 } as const;

export interface Finger {
  readonly id: number;
  readonly x0: number;
  readonly y0: number;
  readonly t0: number;
  readonly x: number;
  readonly y: number;
  /** Furthest distance from the anchor so far, px. */
  readonly maxMove: number;
}

export interface TouchState {
  /** The steering finger: its first contact is the anchor. */
  readonly primary: Finger | null;
  /** Ids of any other fingers down. */
  readonly others: readonly number[];
}

export interface TouchSample {
  readonly kind: 'down' | 'move' | 'up' | 'cancel';
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Milliseconds. */
  readonly t: number;
}

export const NO_TOUCH: TouchState = { primary: null, others: [] };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function moved(f: Finger, x: number, y: number): Finger {
  return { ...f, x, y, maxMove: Math.max(f.maxMove, Math.hypot(x - f.x0, y - f.y0)) };
}

/** Feeds one sample; `jump` is true when it completes a tap or lands a second finger. */
export function stepTouch(s: TouchState, e: TouchSample): { state: TouchState; jump: boolean } {
  const p = s.primary;
  switch (e.kind) {
    case 'down':
      if (!p) return { state: { ...s, primary: { id: e.id, x0: e.x, y0: e.y, t0: e.t, x: e.x, y: e.y, maxMove: 0 } }, jump: false };
      return { state: { ...s, others: [...s.others, e.id] }, jump: true };
    case 'move':
      return { state: p && p.id === e.id ? { ...s, primary: moved(p, e.x, e.y) } : s, jump: false };
    case 'up':
    case 'cancel': {
      if (!p || p.id !== e.id) return { state: { ...s, others: s.others.filter((id) => id !== e.id) }, jump: false };
      const last = moved(p, e.x, e.y);
      const tap = e.kind === 'up' && e.t - p.t0 < TOUCH.tapMs && last.maxMove < TOUCH.tapPx;
      return { state: { ...s, primary: null }, jump: tap };
    }
  }
}

export const touchTurn = (s: TouchState): number => (s.primary ? clamp((s.primary.x - s.primary.x0) / TOUCH.fullTurnPx, -1, 1) : 0);

/** Any finger down: in the air this is a grab. */
export const touchHeld = (s: TouchState): boolean => s.primary !== null || s.others.length > 0;
```

- [ ] **Step 4: Implement input.ts**

`G/src/core/input.ts`:

```ts
import type { Action } from '../game/state';
import type { Controls } from '../sim/board';
import { NO_TOUCH, stepTouch, touchHeld, touchTurn, type TouchSample, type TouchState } from './touch';

type Edge = Exclude<Action, { type: 'tick' }>;

const EDGES: Readonly<Record<string, Edge>> = {
  Space: { type: 'jump' },
  Enter: { type: 'start' },
  KeyR: { type: 'restart' },
  Escape: { type: 'togglePause' },
};
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const HELD = new Set([...LEFT, ...RIGHT, 'Space']);

export const actionFor = (code: string): Edge | null => EDGES[code] ?? null;
export const isGameKey = (code: string): boolean => code in EDGES || HELD.has(code);

const anyHeld = (held: ReadonlySet<string>, codes: readonly string[]) => codes.some((c) => held.has(c));

export function keyControls(held: ReadonlySet<string>): Controls {
  const l = anyHeld(held, LEFT);
  const r = anyHeld(held, RIGHT);
  return { turn: l === r ? 0 : r ? 1 : -1, jump: held.has('Space') };
}

export const mergeControls = (keys: Controls, touch: Controls): Controls =>
  ({ turn: keys.turn !== 0 ? keys.turn : touch.turn, jump: keys.jump || touch.jump });

export interface Input {
  controls(): Controls;
  detach(): void;
}

type KeyLike = Event & { readonly code?: string; readonly repeat?: boolean };

/** Pointer presses on HUD buttons and links are theirs, not steering. */
const onControl = (e: PointerEvent): boolean => e.target instanceof Element && e.target.closest('button, a') !== null;

const sampleOf = (kind: TouchSample['kind'], e: PointerEvent): TouchSample =>
  ({ kind, id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp });

/** Keyboard on `target` (the window) plus pointer drags anywhere on the page. One-shot presses call onAction. */
export function attachInput(target: Window, onAction: (a: Action) => void): Input {
  const held = new Set<string>(); // live key state: mutated on purpose
  let touch: TouchState = NO_TOUCH; // live gesture state: replaced on each pointer event
  const keydown = (e: Event) => {
    const { code = '', repeat = false } = e as KeyLike;
    if (!isGameKey(code)) return;
    e.preventDefault();
    held.add(code);
    const a = actionFor(code);
    if (a && !repeat) onAction(a);
  };
  const keyup = (e: Event) => held.delete((e as KeyLike).code ?? '');
  const feed = (kind: TouchSample['kind']) => (e: PointerEvent) => {
    if (kind === 'down' && onControl(e)) return;
    const r = stepTouch(touch, sampleOf(kind, e));
    touch = r.state;
    if (r.jump) onAction({ type: 'jump' });
  };
  const blur = () => {
    held.clear();
    touch = NO_TOUCH;
  };
  const listeners: [string, EventListener][] = [
    ['keydown', keydown], ['keyup', keyup], ['blur', blur],
    ['pointerdown', feed('down') as EventListener], ['pointermove', feed('move') as EventListener],
    ['pointerup', feed('up') as EventListener], ['pointercancel', feed('cancel') as EventListener],
  ];
  for (const [type, fn] of listeners) target.addEventListener(type, fn);
  return {
    controls: () => mergeControls(keyControls(held), { turn: touchTurn(touch), jump: touchHeld(touch) }),
    detach: () => {
      for (const [type, fn] of listeners) target.removeEventListener(type, fn);
    },
  };
}
```

- [ ] **Step 5: Run the tests and check they pass**

Run: `npx vitest run games/bluebird-run/tests/unit/touch.test.ts games/bluebird-run/tests/unit/input.test.ts`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add games/bluebird-run/src/core/touch.ts games/bluebird-run/src/core/input.ts games/bluebird-run/tests/unit/touch.test.ts games/bluebird-run/tests/unit/input.test.ts
git commit -m "feat: Bluebird Run thumb-drag touch gestures and keyboard input"
```

---

### Task 12: Snow ground bake, chunk cache and camera

**Files:**
- Create: `G/src/render/slope-bake.ts`, `G/src/render/camera.ts`
- Copy and adapt: `G/src/render/chunks.ts`, `G/src/render/assets.ts`, `G/tests/unit/assets.test.ts`
- Test: `G/tests/unit/slope-bake.test.ts`, `G/tests/unit/camera.test.ts`, `G/tests/unit/chunks.test.ts`

- [ ] **Step 1: Copy the chunk cache and asset loader, pointing them at the new bake**

```bash
G=games/bluebird-run; P=games/paper-route
cp $P/src/render/chunks.ts $P/src/render/assets.ts $G/src/render/
cp $P/tests/unit/assets.test.ts $G/tests/unit/
sed -i '' "s#'./street-bake'#'./slope-bake'#" $G/src/render/chunks.ts $G/src/render/assets.ts
```

Also change the doc comment in `chunks.ts` from `far (high s) first` to `far (high d) first`.

- [ ] **Step 2: Write the failing tests**

`G/tests/unit/slope-bake.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ORIGIN, slopePx } from '../../src/render/iso';
import { bakeChunk, chunkBounds, chunkCount, chunkRange, groundAt, ownerChunk, pixelKind, RAMPS, type ChunkBake } from '../../src/render/slope-bake';
import { makeSlope } from '../helpers/make-slope';

const slope = makeSlope({ length: 100, finish: 90, surfaces: [{ kind: 'packed', rect: [6, 20, 4, 10] }, { kind: 'shade', rect: [6, 25, 2, 2] }] });
const alphaAt = (b: ChunkBake, wx: number, wy: number): number => {
  const x = wx - b.x, y = wy - b.y;
  if (x < 0 || y < 0 || x >= b.width || y >= b.height) return 0;
  return b.frames[0][(y * b.width + x) * 4 + 3];
};

describe('groundAt', () => {
  it('is groomed in the middle and powder at both edges', () => {
    expect(groundAt(slope, 8, 10)).toBe('groomed');
    expect(groundAt(slope, 0.5, 10)).toBe('powder');
    expect(groundAt(slope, 15.5, 10)).toBe('powder');
  });
  it('applies surfaces, later ones on top', () => {
    expect(groundAt(slope, 7, 22)).toBe('packed');
    expect(groundAt(slope, 7, 26)).toBe('shade');
  });
  it('is null off the slope', () => {
    expect(groundAt(slope, -0.1, 10)).toBeNull();
    expect(groundAt(slope, 16, 10)).toBeNull();
    expect(groundAt(slope, 8, 100)).toBeNull();
  });
});

describe('pixelKind', () => {
  it('reads the snow under a pixel', () => {
    const [x, y] = slopePx(ORIGIN, 8, 10);
    expect(pixelKind(slope, x, y)?.kind).toBe('groomed');
  });
  it('finds the rock side below the screen-left edge (c = 0)', () => {
    const [x, y] = slopePx(ORIGIN, 0, 50, -0.25);
    expect(pixelKind(slope, x, y)?.kind).toBe('sideC');
  });
  it('finds the rock side below the bottom end (d = length)', () => {
    const [x, y] = slopePx(ORIGIN, 8, 100, -0.25);
    expect(pixelKind(slope, x, y)?.kind).toBe('sideD');
  });
  it('is sky off the slope', () => {
    const [x, y] = slopePx(ORIGIN, 20, 50);
    expect(pixelKind(slope, x, y)).toBeNull();
  });
});

describe('chunks', () => {
  it('splits the slope into 16-tile chunks', () => {
    expect(chunkCount(100)).toBe(7);
    expect(chunkRange(100, 6)).toEqual([96, 100]);
  });
  it('gives each pixel exactly one owner chunk', () => {
    const [x, y] = slopePx(ORIGIN, 8, 16.5);
    expect(ownerChunk(100, x, y)).toBe(1);
  });
  it('bakes opaque snow inside its range and nothing in a neighbour range', () => {
    const b = bakeChunk(slope, 1);
    const [x, y] = slopePx(ORIGIN, 8, 20).map(Math.round);
    expect(alphaAt(b, x, y)).toBe(255);
    const [fx, fy] = slopePx(ORIGIN, 8, 40).map(Math.round);
    expect(alphaAt(b, fx, fy)).toBe(0);
    expect(chunkBounds(100, 1).width).toBe(b.width);
  });
  it('paints a ragged snow lip just outside the screen-right edge', () => {
    const b = bakeChunk(slope, 1);
    let painted = 0;
    let samples = 0;
    for (let d = 17; d < 31; d += 0.5) {
      const [x, y] = slopePx(ORIGIN, 16, d).map(Math.round);
      painted += alphaAt(b, x, y - 2) ? 1 : 0; // 2 px above the edge is sky, inside the lip
      samples++;
    }
    expect(painted).toBeGreaterThan(0);
    expect(painted).toBeLessThan(samples); // ragged, not a solid line
  });
  it('uses snow-white ramps for snow', () => {
    expect(RAMPS.powder.at(-1)).toEqual([255, 255, 255]);
  });
});
```

`G/tests/unit/camera.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cameraTarget, followCamera, RIDER_ANCHOR, snapCamera, viewOf } from '../../src/render/camera';
import { slopePx } from '../../src/render/iso';

describe('camera', () => {
  it('puts a centred rider at the anchor', () => {
    const cam = cameraTarget(8, 50);
    expect(slopePx(viewOf(cam), 8, 50)).toEqual([RIDER_ANCHOR[0], RIDER_ANCHOR[1]]);
  });
  it('follows across at half rate, so carving doesn't swing the view', () => {
    const a = cameraTarget(8, 50);
    const b = cameraTarget(12, 50);
    const [x0] = slopePx(viewOf(a), 12, 50);
    const [x1] = slopePx(viewOf(b), 12, 50);
    expect(x0 - x1).toBeCloseTo(32); // 4 tiles across = 64 px, half followed
  });
  it('eases toward the target and snaps to whole pixels', () => {
    const c = followCamera({ x: 0, y: 0 }, { x: 100, y: 50 }, 0.1);
    expect(c.x).toBeGreaterThan(0);
    expect(c.x).toBeLessThan(100);
    expect(snapCamera({ x: 1.6, y: -2.4 })).toEqual({ x: 2, y: -2 });
  });
});
```

`G/tests/unit/chunks.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { cameraTarget, snapCamera } from '../../src/render/camera';
import { createChunkCache, visibleChunks } from '../../src/render/chunks';

describe('chunk cache', () => {
  it('lists the chunks around the rider, far first', () => {
    const v = visibleChunks(360, snapCamera(cameraTarget(8, 100)), 360, 270);
    expect(v.length).toBeGreaterThan(0);
    expect(v).toContain(6);
    expect([...v].sort((a, b) => b - a)).toEqual(v);
  });
  it('bakes once and evicts what is not kept', () => {
    const bake = vi.fn((i: number) => i * 10);
    const cache = createChunkCache(bake);
    expect(cache.get(2)).toBe(20);
    cache.get(2);
    expect(bake).toHaveBeenCalledTimes(1);
    cache.get(3);
    cache.keepOnly([3]);
    expect(cache.size).toBe(1);
  });
});
```

- [ ] **Step 3: Run the tests and check they fail**

Run: `npx vitest run games/bluebird-run/tests/unit/slope-bake.test.ts games/bluebird-run/tests/unit/camera.test.ts games/bluebird-run/tests/unit/chunks.test.ts games/bluebird-run/tests/unit/assets.test.ts`
Expected: FAIL, because `slope-bake` and `camera` don't exist yet.

- [ ] **Step 4: Implement the bake**

`G/src/render/slope-bake.ts`. It's adapted from Paper Route's `street-bake.ts` (read that file
first): the same owner-chunk, padding, fringe-search and colourise structure, with snow surfaces
and the slope's own axes.

```ts
import { SLOPE } from '../sim/constants';
import type { Slope } from '../world/slope';
import { hash2, rampLevel, valueNoise } from './dither';
import { ORIGIN, slopePx, TILE_H, TILE_W, unproject, Z_PX } from './iso';
import { parseHex, type RGB } from './palette';

export const CHUNK_TILES = 16;
/** How far below the snow the rock sides hang, tiles. */
const SIDE_Z = -0.6;
const FRINGE_R = 3;
const PAD = Math.max(2 * FRINGE_R + 1, Math.ceil(-SIDE_Z * Z_PX) + FRINGE_R + 1);
const W = SLOPE.width;

export type Kind = 'groomed' | 'packed' | 'powder' | 'shade' | 'sideC' | 'sideD';
const KINDS: readonly Kind[] = ['groomed', 'packed', 'powder', 'shade', 'sideC', 'sideD'];
const POWDER = KINDS.indexOf('powder');

const hexes = (...h: string[]): RGB[] => h.map(parseHex);
export const RAMPS: Readonly<Record<Kind | 'lip', readonly RGB[]>> = {
  groomed: hexes('#a9c2e2', '#c9daee', '#e3edf8', '#f4f8ff'),
  packed: hexes('#8aa6d4', '#a9c2e2', '#b8b8c4', '#c9daee'),
  powder: hexes('#e3edf8', '#f4f8ff', '#ffffff'),
  shade: hexes('#4d5f9a', '#6b84bf', '#8aa6d4'),
  sideC: hexes('#2c2c3a', '#4a4a5a', '#8a8a96'),
  sideD: hexes('#14141c', '#2c2c3a', '#4a4a5a'),
  lip: hexes('#c9daee', '#f4f8ff', '#ffffff'),
};
const SHADE: Readonly<Record<Kind, number>> = { groomed: 0.6, packed: 0.5, powder: 0.65, shade: 0.5, sideC: 0.5, sideD: 0.5 };

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ChunkBake extends PixelRect {
  readonly index: number;
  /** RGBA pixels (one frame: snow has no wind). Transparent where another chunk owns the pixel. */
  readonly frames: readonly Uint8ClampedArray[];
}

export type Ground = Pick<Slope, 'length' | 'surfaces'>;

/** Where powder gives way to groomed snow on each side: a lumpy line, not a ruler edge. */
const powderEdge = (d: number, side: 0 | 1): number => SLOPE.powder + (valueNoise(d * 6, side * 97, 4, 9) - 0.5) * 0.7;

/** The snow surface at a slope point, or null off the slope. */
export function groundAt(g: Ground, c: number, d: number): Kind | null {
  if (c < 0 || c >= W || d < 0 || d >= g.length) return null;
  if (c < powderEdge(d, 0) || c > W - powderEdge(d, 1)) return 'powder';
  for (let i = g.surfaces.length - 1; i >= 0; i--) {
    const r = g.surfaces[i].rect;
    if (c >= r.c0 && c < r.c1 && d >= r.d0 && d < r.d1) return g.surfaces[i].kind;
  }
  return 'groomed';
}

export interface PixelHit {
  readonly kind: Kind;
  readonly c: number;
  readonly d: number;
}

/** What the slope shows at world pixel (wx, wy): snow on top, a rock side, or null for sky. */
export function pixelKind(g: Ground, wx: number, wy: number): PixelHit | null {
  const [x, y] = unproject(ORIGIN, wx, wy, 0);
  const top = groundAt(g, W - y, x);
  if (top) return { kind: top, c: W - y, d: x };
  // The long screen-left edge: the plane y = W (c = 0), hanging down to SIDE_Z.
  const lx = wx / (TILE_W / 2) + W;
  const lz = ((lx + W) * (TILE_H / 2) - wy) / Z_PX;
  if (lx >= 0 && lx <= g.length && lz >= SIDE_Z && lz <= 0) return { kind: 'sideC', c: 0, d: lx };
  // The bottom end: the plane x = length.
  const ey = g.length - wx / (TILE_W / 2);
  const ez = ((g.length + ey) * (TILE_H / 2) - wy) / Z_PX;
  if (ey >= 0 && ey <= W && ez >= SIDE_Z && ez <= 0) return { kind: 'sideD', c: W - ey, d: g.length };
  return null;
}

export const chunkCount = (length: number): number => Math.ceil(length / CHUNK_TILES);

export const chunkRange = (length: number, index: number): [number, number] =>
  [index * CHUNK_TILES, Math.min(length, (index + 1) * CHUNK_TILES)];

/** Which chunk draws world pixel (wx, wy): decided by the d its centre unprojects to at height 0. */
export function ownerChunk(length: number, wx: number, wy: number): number {
  const d = unproject(ORIGIN, wx, wy, 0)[0];
  return Math.max(0, Math.min(chunkCount(length) - 1, Math.floor(d / CHUNK_TILES)));
}

export function chunkBounds(length: number, index: number): PixelRect {
  const [d0, d1] = chunkRange(length, index);
  const pts = [0, W].flatMap((c) => [d0, d1].flatMap((d) => [0, SIDE_Z].map((z) => slopePx(ORIGIN, c, d, z))));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.floor(Math.min(...xs)) - PAD;
  const y = Math.floor(Math.min(...ys)) - PAD;
  return { x, y, width: Math.ceil(Math.max(...xs)) + PAD - x, height: Math.ceil(Math.max(...ys)) + PAD - y };
}

/** Corduroy: faint grooming lines running downhill on groomed snow. */
function shadeAt(kind: Kind, gx: number, gy: number): number {
  if (kind !== 'groomed') return SHADE[kind];
  return SHADE.groomed + ((((gx >> 1) + gy) & 7) === 0 ? -0.18 : 0);
}

interface Offset { readonly dx: number; readonly dy: number; readonly dist: number }

const LIP_OFFSETS: readonly Offset[] = (() => {
  const all: Offset[] = [];
  for (let dy = -FRINGE_R; dy <= FRINGE_R; dy++) {
    for (let dx = -FRINGE_R; dx <= FRINGE_R; dx++) {
      if (dx * dx + dy * dy <= FRINGE_R * FRINGE_R) all.push({ dx, dy, dist: Math.sqrt(dx * dx + dy * dy) });
    }
  }
  return all.sort((p, q) => p.dist - q.dist);
})();

/** Distance (px) to the nearest powder pixel within the lip radius, or 0 if none. */
function nearestPowder(kind: Int8Array, w: number, h: number, x: number, y: number): number {
  for (const { dx, dy, dist } of LIP_OFFSETS) {
    const xx = x + dx;
    const yy = y + dy;
    if (xx >= 0 && xx < w && yy >= 0 && yy < h && kind[yy * w + xx] === POWDER) return dist;
  }
  return 0;
}

function put(out: Uint8ClampedArray, i: number, c: RGB): void {
  out[i * 4] = c[0];
  out[i * 4 + 1] = c[1];
  out[i * 4 + 2] = c[2];
  out[i * 4 + 3] = 255;
}

interface Classified {
  readonly kind: Int8Array;
  readonly own: Uint8Array;
}

function classify(g: Ground, index: number, b: PixelRect): Classified {
  const n = b.width * b.height;
  const kind = new Int8Array(n).fill(-1);
  const own = new Uint8Array(n);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const i = y * b.width + x;
      const wx = b.x + x + 0.5;
      const wy = b.y + y + 0.5;
      own[i] = ownerChunk(g.length, wx, wy) === index ? 1 : 0;
      const p = pixelKind(g, wx, wy);
      if (p) kind[i] = KINDS.indexOf(p.kind);
    }
  }
  return { kind, own };
}

function colorize(b: PixelRect, k: Classified): Uint8ClampedArray {
  const out = new Uint8ClampedArray(b.width * b.height * 4);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const i = y * b.width + x;
      if (!k.own[i]) continue;
      const gx = b.x + x; // world pixel: noise and dither line up across chunks
      const gy = b.y + y;
      if (k.kind[i] >= 0) {
        const kind = KINDS[k.kind[i]];
        const ramp = RAMPS[kind];
        const noise = valueNoise(gx, gy, 9, 3) - 0.5;
        put(out, i, ramp[rampLevel(shadeAt(kind, gx, gy) + noise * 0.25, ramp.length, gx, gy)]);
        continue;
      }
      const dist = nearestPowder(k.kind, b.width, b.height, x, y);
      if (dist <= 0) continue;
      const p = 1 - dist / (FRINGE_R + 1);
      if (hash2(gx, gy, 11) < p * 0.8) put(out, i, RAMPS.lip[rampLevel(p, RAMPS.lip.length, gx, gy)]);
    }
  }
  return out;
}

/** Bakes one 16-tile chunk of the slope. */
export function bakeChunk(g: Ground, index: number): ChunkBake {
  const b = chunkBounds(g.length, index);
  return { index, ...b, frames: [colorize(b, classify(g, index, b))] };
}
```

Check `chunks.ts` after the sed: it calls `chunkBounds(length, i)` and `chunkCount(length)`, which
match the signatures above.

- [ ] **Step 5: Implement the camera**

`G/src/render/camera.ts`:

```ts
import { SLOPE } from '../sim/constants';
import { ORIGIN, slopePx, type View } from './iso';

/** World pixel at the buffer's top-left corner. */
export interface Camera {
  readonly x: number;
  readonly y: number;
}

/** Where the rider sits in the 360×270 buffer: upper left, so the slope below and ahead (↘) is in view. */
export const RIDER_ANCHOR = [128, 76] as const;
/** Share of the rider's across offset the camera follows: carving shouldn't swing the view. */
const ACROSS_FOLLOW = 0.5;
const FOLLOW_RATE = 6;

export function cameraTarget(c: number, d: number): Camera {
  const mid = SLOPE.width / 2;
  const [px, py] = slopePx(ORIGIN, mid + (c - mid) * ACROSS_FOLLOW, d);
  return { x: px - RIDER_ANCHOR[0], y: py - RIDER_ANCHOR[1] };
}

export function followCamera(cam: Camera, target: Camera, dt: number, rate = FOLLOW_RATE): Camera {
  const k = 1 - Math.exp(-rate * Math.max(0, dt));
  return { x: cam.x + (target.x - cam.x) * k, y: cam.y + (target.y - cam.y) * k };
}

export const snapCamera = (cam: Camera): Camera => ({ x: Math.round(cam.x), y: Math.round(cam.y) });

export const viewOf = (cam: Camera): View => ({ ox: -cam.x, oy: -cam.y });
```

- [ ] **Step 6: Run the tests and check they pass**

Run: the same command as Step 3, plus `npx tsc --noEmit`. Expected: PASS, and tsc is clean.

The `assets.test.ts` copied from Paper Route only uses `loadSprites` and `parseManifest`, so it passes
unchanged.

- [ ] **Step 7: Commit**

```bash
git add games/bluebird-run/src/render games/bluebird-run/tests/unit/slope-bake.test.ts games/bluebird-run/tests/unit/camera.test.ts games/bluebird-run/tests/unit/chunks.test.ts games/bluebird-run/tests/unit/assets.test.ts
git commit -m "feat: Bluebird Run snow ground bake, chunk cache and camera"
```

---

### Task 13: Carve tracks and snow particles

**Files:**
- Create: `G/src/render/tracks.ts`, `G/src/render/particles.ts`
- Test: `G/tests/unit/tracks.test.ts`, `G/tests/unit/particles.test.ts`

- [ ] **Step 1: Write the failing tests**

`G/tests/unit/tracks.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { carveDepth, pushTrack, TRACK_MAX, trackPoint, trackSegments } from '../../src/render/tracks';
import { crash, newBoard } from '../../src/sim/board';
import { ollie } from '../../src/sim/air';

describe('carve tracks', () => {
  it('deepens with the carve', () => {
    expect(carveDepth(10)).toBe(0);
    expect(carveDepth(-75)).toBe(1);
    expect(carveDepth(47.5)).toBeCloseTo(0.5);
  });
  it('records a point on the snow and a gap in the air or a tumble', () => {
    const b = { ...newBoard(8, 10), heading: 75 };
    expect(trackPoint(b)).toEqual([8, 10, 1]);
    expect(trackPoint(ollie(b))).toBeNull();
    expect(trackPoint(crash(b))).toBeNull();
  });
  it('keeps the newest points and never stacks gaps', () => {
    let t = pushTrack([], [1, 1, 0]);
    t = pushTrack(t, null);
    t = pushTrack(t, null);
    expect(t).toEqual([[1, 1, 0], null]);
    const long = Array.from({ length: TRACK_MAX + 5 }, (_, i) => [8, i, 0] as const).reduce(pushTrack, [] as ReturnType<typeof pushTrack>);
    expect(long).toHaveLength(TRACK_MAX);
    expect(long[0]).toEqual([8, 5, 0]);
  });
  it('joins neighbouring points into segments across no gaps', () => {
    expect(trackSegments([[1, 1, 0], [1, 2, 0.5], null, [1, 4, 0], [1, 5, 1]])).toEqual([
      [[1, 1, 0], [1, 2, 0.5]],
      [[1, 4, 0], [1, 5, 1]],
    ]);
  });
});
```

`G/tests/unit/particles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_PARTICLES, puff, spawnFor, spray, stepParticles } from '../../src/render/particles';
import { newBoard } from '../../src/sim/board';

describe('particles', () => {
  it('throws spray to the outside of a hard carve at speed only', () => {
    const fast = { ...newBoard(8, 10), heading: 60, speed: 6 };
    const ps = spray(fast, 3);
    expect(ps).toHaveLength(3);
    expect(ps.every((p) => p.vc < 0)).toBe(true); // carving toward +c throws snow to −c
    expect(spray({ ...fast, heading: 20 }, 3)).toEqual([]);
    expect(spray({ ...fast, speed: 2 }, 3)).toEqual([]);
  });
  it('puffs ten particles from a burst', () => {
    expect(puff(6, 50, 1)).toHaveLength(10);
  });
  it('falls, settles on the snow and fades out', () => {
    let ps = puff(6, 50, 1);
    ps = stepParticles(ps, 0.1);
    expect(ps.every((p) => p.life < p.max)).toBe(true);
    for (let i = 0; i < 30; i++) ps = stepParticles(ps, 0.1);
    expect(ps).toEqual([]);
  });
  it('spawns from events and the board, capped', () => {
    const b = { ...newBoard(8, 10), heading: 70, speed: 7 };
    const out = spawnFor([], b, [{ type: 'burst', at: [6, 50] }, { type: 'crash', what: 'pine' }], 0);
    expect(out.length).toBe(10 + 10 + 3);
    expect(spawnFor([], b, [], 0, false)).toEqual([]);
    const full = Array.from({ length: MAX_PARTICLES }, () => out[0]);
    expect(spawnFor(full, b, [], 0)).toHaveLength(MAX_PARTICLES);
  });
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npx vitest run games/bluebird-run/tests/unit/tracks.test.ts games/bluebird-run/tests/unit/particles.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement them**

`G/src/render/tracks.ts`:

```ts
import type { Board } from '../sim/board';

/** [c, d, depth 0..1], or null for a gap (airborne or tumbling). */
export type TrackPoint = readonly [number, number, number] | null;

/** About 1.5 s of track at 60 points a second. */
export const TRACK_MAX = 90;

export const carveDepth = (heading: number): number => Math.max(0, Math.min(1, (Math.abs(heading) - 20) / 55));

export const trackPoint = (b: Board): TrackPoint => (b.air || b.tumble > 0 ? null : [b.c, b.d, carveDepth(b.heading)]);

export function pushTrack(track: readonly TrackPoint[], p: TrackPoint): TrackPoint[] {
  if (p === null && (track.length === 0 || track[track.length - 1] === null)) return [...track];
  return [...track, p].slice(-TRACK_MAX);
}

export function trackSegments(track: readonly TrackPoint[]): [NonNullable<TrackPoint>, NonNullable<TrackPoint>][] {
  return track.slice(1).flatMap((b, i) => {
    const a = track[i];
    return a && b ? [[a, b] as [NonNullable<TrackPoint>, NonNullable<TrackPoint>]] : [];
  });
}
```

`G/src/render/particles.ts`:

```ts
import { hash2 } from '../core/hash';
import type { GameEvent } from '../game/events';
import { toRad, type Board } from '../sim/board';
import { BOARD } from '../sim/constants';

export interface Particle {
  readonly c: number;
  readonly d: number;
  readonly z: number;
  readonly vc: number;
  readonly vd: number;
  readonly vz: number;
  readonly life: number;
  readonly max: number;
}

export const MAX_PARTICLES = 120;
const GRAVITY = 6;

const rnd = (seed: number, i: number, k: number): number => hash2(seed, i, k);

/** Snow thrown off the board's outside edge on a hard carve at speed. */
export function spray(b: Board, seed: number): Particle[] {
  if (Math.abs(b.heading) < BOARD.sprayFrom || b.speed < BOARD.spraySpeed) return [];
  const out = -Math.sign(b.heading);
  const r = toRad(b.heading);
  return [0, 1, 2].map((i) => ({
    c: b.c, d: b.d, z: 0.1,
    vc: out * (1.5 + rnd(seed, i, 1) * 1.5),
    vd: Math.cos(r) * b.speed * 0.6 + (rnd(seed, i, 2) - 0.5),
    vz: 1.5 + rnd(seed, i, 3) * 1.5,
    life: 0.5, max: 0.5,
  }));
}

/** A ring of snow from a burst snowman or a crash. */
export function puff(c: number, d: number, seed: number): Particle[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + rnd(seed, i, 4);
    const v = 1 + rnd(seed, i, 5) * 1.5;
    return { c, d, z: 0.3, vc: Math.cos(a) * v, vd: Math.sin(a) * v, vz: 2 + rnd(seed, i, 6) * 2, life: 0.8, max: 0.8 };
  });
}

export function stepParticles(ps: readonly Particle[], dt: number): Particle[] {
  return ps.flatMap((p) => {
    const life = p.life - dt;
    if (life <= 0) return [];
    const z = Math.max(0, p.z + p.vz * dt);
    const grounded = z === 0;
    return [{
      ...p, life, z,
      c: p.c + (grounded ? 0 : p.vc * dt), d: p.d + (grounded ? 0 : p.vd * dt),
      vz: grounded ? 0 : p.vz - GRAVITY * dt,
    }];
  });
}

/**
 * New particles: puffs for burst/crash events, plus carve spray from the board unless `withSpray` is false
 * (the frame loop sprays every third sim step and adds event puffs once a frame). Capped at MAX_PARTICLES.
 */
export function spawnFor(ps: readonly Particle[], b: Board, events: readonly GameEvent[], seed: number, withSpray = true): Particle[] {
  const puffs = events.flatMap((e, i) => {
    if (e.type === 'burst') return puff(e.at[0], e.at[1], seed + i);
    if (e.type === 'crash' || e.type === 'wipeout') return puff(b.c, b.d, seed + i + 50);
    return [];
  });
  const fresh = [...puffs, ...(!withSpray || b.air || b.tumble > 0 ? [] : spray(b, seed))];
  return [...ps, ...fresh].slice(-MAX_PARTICLES);
}
```

Note: in the spawn test, the cap keeps the newest particles, so a full list plus fresh ones is
still `MAX_PARTICLES` long.

- [ ] **Step 4: Run the tests and check they pass**

Run: the same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/bluebird-run/src/render/tracks.ts games/bluebird-run/src/render/particles.ts games/bluebird-run/tests/unit/tracks.test.ts games/bluebird-run/tests/unit/particles.test.ts
git commit -m "feat: Bluebird Run carve tracks and snow particles"
```

---

### Task 14: Rider sprite layout and the renderer

**Files:**
- Create: `G/src/world/rider.ts`, `G/src/render/renderer.ts`, `G/src/content.ts` (type and loader; Task 17 wires it into main)
- Test: `G/tests/unit/rider.test.ts`, `G/tests/unit/renderer.test.ts`

- [ ] **Step 1: Write the failing tests**

`G/tests/unit/rider.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ollie } from '../../src/sim/air';
import { crash, newBoard } from '../../src/sim/board';
import { animFor, dirFor, DIRS, parseRider, RiderError, rowsFor } from '../../src/world/rider';

const rows = Object.fromEntries(DIRS.map((d, i) => [d, i]));
const raw = { src: 'rider.png', cell: [48, 48], anchor: [24, 44], fps: 10, anims: { ride: { frames: 4, rows }, grab: { frames: 1, rows } } };

describe('parseRider', () => {
  it('parses a layout and falls back to ride for missing animations', () => {
    const l = parseRider(raw);
    expect(l.cell).toEqual([48, 48]);
    expect(rowsFor(l, 'grab').frames).toBe(1);
    expect(rowsFor(l, 'tumble')).toBe(l.anims.ride);
  });
  it.each([
    ['no src', { ...raw, src: 'x.gif' }, /src/],
    ['no ride', { ...raw, anims: {} }, /anims\.ride/],
    ['a missing row', { ...raw, anims: { ride: { frames: 1, rows: { south: 0 } } } }, /rows\.south-west/],
    ['a bad cell', { ...raw, cell: [0, 4] }, /cell/],
  ])('rejects %s', (_l, bad, msg) => {
    expect(() => parseRider(bad)).toThrow(RiderError);
    expect(() => parseRider(bad)).toThrow(msg);
  });
});

describe('dirFor', () => {
  it.each([[0, 'south-east'], [45, 'east'], [75, 'north-east'], [-45, 'south'], [-75, 'south-west'], [180, 'north-west'], [-180, 'north-west'], [360, 'south-east']])(
    'facing %s° → %s', (deg, dir) => {
      expect(dirFor(deg)).toBe(dir);
    },
  );
});

describe('animFor', () => {
  it('picks ride, air, grab or tumble', () => {
    const b = { ...newBoard(8, 10), speed: 5 };
    expect(animFor(b)).toBe('ride');
    const up = ollie(b);
    expect(animFor(up)).toBe('air');
    expect(animFor({ ...up, air: { ...up.air!, grabbing: true } })).toBe('grab');
    expect(animFor(crash(b))).toBe('tumble');
  });
});
```

`G/tests/unit/renderer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/content';
import { newRun } from '../../src/game/state';
import { cameraTarget, snapCamera } from '../../src/render/camera';
import { createPalette } from '../../src/render/palette';
import { renderFrame } from '../../src/render/renderer';
import { parseManifest } from '../../src/world/manifest';
import manifestJson from '../../assets/manifest.json';
import paletteJson from '../../assets/palette.json';
import { makeSlope } from '../helpers/make-slope';

/** A 2D context that records the methods called (all no-ops). */
function recorder(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = []; // test recorder: mutated on purpose
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (t, k) => (typeof k === 'string' && k in t ? t[k] : (..._a: unknown[]) => void calls.push(String(k))),
    set: (t, k, v) => { t[k as string] = v; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('renderFrame', () => {
  it('draws chunks, sprites (as placeholders) and the rider without throwing', () => {
    const slope = makeSlope({
      gates: [{ d: 12, c: [6, 10], color: 'red' }], ramps: [{ d: 20, c: 8 }], hazards: [{ kind: 'snowman', at: [7, 15] }],
      riders: [{ look: 'skier-green', speed: 3, path: [[8, 14], [8, 40]] }], flakes: [[8, 9]],
    });
    const content: Content = { slope, manifest: parseManifest(manifestJson), palette: createPalette(paletteJson), sprites: new Map(), rider: null };
    const state = { ...newRun(slope), phase: 'riding' as const, riders: [0] };
    const { ctx, calls } = recorder();
    renderFrame(ctx, {
      content, state, cam: snapCamera(cameraTarget(8, 4)), visible: [0, 1], chunk: () => ({}) as CanvasImageSource,
      time: 0.5, width: 360, height: 270, track: [[8, 3, 0], [8, 3.5, 1]], particles: [{ c: 8, d: 5, z: 0.2, vc: 0, vd: 0, vz: 0, life: 0.4, max: 0.5 }],
    });
    expect(calls.filter((c) => c === 'drawImage')).toHaveLength(2);
    expect(calls.filter((c) => c === 'fillRect').length).toBeGreaterThan(10);
    expect(calls).toContain('stroke');
  });
});
```

- [ ] **Step 2: Run the tests and check they fail**

Run: `npx vitest run games/bluebird-run/tests/unit/rider.test.ts games/bluebird-run/tests/unit/renderer.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the rider layout**

`G/src/world/rider.ts`:

```ts
import type { Board } from '../sim/board';

/** PixelLab's direction names (also the ingest's folder names). */
export const DIRS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'] as const;
export type Dir = (typeof DIRS)[number];
export const ANIMS = ['ride', 'air', 'grab', 'tumble'] as const;
export type Anim = (typeof ANIMS)[number];

export interface AnimRows {
  readonly frames: number;
  /** Sheet row for each facing direction. */
  readonly rows: Readonly<Record<Dir, number>>;
}

export interface RiderLayout {
  /** File name inside assets/sprites/. */
  readonly src: string;
  readonly cell: readonly [number, number];
  readonly anchor: readonly [number, number];
  readonly fps: number;
  /** ride is required; missing animations fall back to it. */
  readonly anims: Readonly<Partial<Record<Anim, AnimRows>>> & { readonly ride: AnimRows };
}

export class RiderError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isNatural = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function pair(v: unknown, field: string, ok: (n: unknown) => boolean): readonly [number, number] {
  if (Array.isArray(v) && v.length === 2 && v.every(ok)) return [v[0] as number, v[1] as number];
  throw new RiderError(`rider: ${field} must be a pair of valid numbers`);
}

function parseAnim(raw: unknown, name: string): AnimRows {
  if (!isObj(raw) || !isPosInt(raw.frames)) throw new RiderError(`rider: anims.${name} needs frames`);
  const rows = isObj(raw.rows) ? raw.rows : {};
  return {
    frames: raw.frames,
    rows: Object.fromEntries(DIRS.map((d) => {
      if (!isNatural(rows[d])) throw new RiderError(`rider: anims.${name}.rows.${d} must be a row number`);
      return [d, rows[d] as number];
    })) as Record<Dir, number>,
  };
}

export function parseRider(raw: unknown): RiderLayout {
  if (!isObj(raw)) throw new RiderError('rider: must be an object');
  if (typeof raw.src !== 'string' || !/^[a-z0-9-]+\.png$/.test(raw.src)) throw new RiderError('rider: src must be a .png file name');
  if (!isPosInt(raw.fps)) throw new RiderError('rider: fps must be a positive whole number');
  const anims = isObj(raw.anims) ? raw.anims : {};
  if (anims.ride === undefined) throw new RiderError('rider: anims.ride is required');
  const parsed = Object.fromEntries(ANIMS.flatMap((a) => (anims[a] === undefined ? [] : [[a, parseAnim(anims[a], a)]])));
  return {
    src: raw.src,
    cell: pair(raw.cell, 'cell', isPosInt),
    anchor: pair(raw.anchor, 'anchor', isNatural),
    fps: raw.fps,
    anims: parsed as RiderLayout['anims'],
  };
}

export const rowsFor = (l: RiderLayout, anim: Anim): AnimRows => l.anims[anim] ?? l.anims.ride;

/** Directions in screen-angle order: 0° = east, clockwise (screen y points down). */
const SCREEN_ORDER: readonly Dir[] = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

/** The sprite direction for a facing (degrees from downhill): screen angle = 45° − facing (spec §5). */
export function dirFor(facingDeg: number): Dir {
  const i = Math.round((45 - facingDeg) / 45);
  return SCREEN_ORDER[((i % 8) + 8) % 8];
}

export function animFor(b: Board): Anim {
  if (b.tumble > 0) return 'tumble';
  if (b.air) return b.air.grabbing ? 'grab' : 'air';
  return 'ride';
}
```

- [ ] **Step 4: Write the content module** (Task 17 uses it at boot; the renderer needs its type now)

`G/src/content.ts`:

```ts
import manifestJson from '../assets/manifest.json';
import paletteJson from '../assets/palette.json';
import { loadImageOrNull, loadSprites, spriteUrl } from './render/assets';
import { createPalette, type Palette } from './render/palette';
import { parseManifest, type Manifest } from './world/manifest';
import { parseRider, type RiderLayout } from './world/rider';
import { parseSlope, type Slope } from './world/slope';
import slopeJson from './world/slopes/pinecone-bowl.json';

export const BUF_W = 360;
export const BUF_H = 270;

/** Written by the ingest script; while it is missing, the renderer draws a placeholder rider. */
const RIDER_JSON = import.meta.glob('../assets/rider.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export interface Rider {
  readonly layout: RiderLayout;
  readonly image: HTMLImageElement;
}

export interface Content {
  readonly slope: Slope;
  readonly manifest: Manifest;
  readonly palette: Palette;
  readonly sprites: ReadonlyMap<string, HTMLImageElement>;
  /** null → the renderer draws a placeholder rider. */
  readonly rider: Rider | null;
}

async function loadRider(): Promise<Rider | null> {
  const raw = RIDER_JSON['../assets/rider.json'];
  if (raw === undefined) return null;
  const layout = parseRider(raw);
  const url = spriteUrl(layout.src);
  if (!url) {
    console.warn(`rider: assets/sprites/${layout.src} is missing; drawing the placeholder rider`);
    return null;
  }
  const image = await loadImageOrNull(url, 'rider');
  return image ? { layout, image } : null;
}

export async function loadContent(): Promise<Content> {
  const manifest = parseManifest(manifestJson);
  const [sprites, rider] = await Promise.all([loadSprites(manifest), loadRider()]);
  return { slope: parseSlope(slopeJson), manifest, palette: createPalette(paletteJson), sprites, rider };
}
```

`content.ts` imports `pinecone-bowl.json`, which Task 17 writes. To keep tsc and the renderer test
importing cleanly now, write a minimal placeholder `G/src/world/slopes/pinecone-bowl.json`:

```json
{ "name": "Pinecone Bowl", "length": 360, "finish": 350, "par": 75, "surfaces": [], "gates": [], "ramps": [], "hazards": [], "riders": [], "flakes": [] }
```

- [ ] **Step 5: Implement the renderer**

`G/src/render/renderer.ts`:

```ts
import type { Content } from '../content';
import type { GameState } from '../game/state';
import { groundZ } from '../sim/air';
import { facing } from '../sim/board';
import { AIR, SLOPE } from '../sim/constants';
import { riderPos } from '../sim/hazards';
import { animFor, dirFor, rowsFor } from '../world/rider';
import { viewOf, type Camera } from './camera';
import { depthOf, slopePx, sortByDepth, type View } from './iso';
import type { Particle } from './particles';
import { chunkBounds } from './slope-bake';
import { trackSegments, type TrackPoint } from './tracks';

/** The sky behind the floating slope. The page is painted the same colour after the post pass. */
export const BACKGROUND = '#9fd8ee';
const OUTLINE = '#14141c';
const SHADOW = 'rgba(77, 95, 154, 0.4)';
const TRACK_LIGHT = '#a9c2e2';
const TRACK_DEEP = '#8aa6d4';
const FINISH_RED = '#c8463c';
const SNOW = '#ffffff';
const JACKET = '#c8463c';
const MISSING = { color: '#ff00ff', w: 6, h: 6 };
/** Where the start hut stands, [c, d]: off to the screen-left of the start line. */
export const HUT_AT = [4, 2] as const;
/** Sprite names already warned about. An intentional mutable cache: each unknown name warns once, not every frame. */
const warnedMissing = new Set<string>();

export interface Scene {
  readonly content: Content;
  readonly state: GameState;
  /** Snapped (whole-pixel) camera. */
  readonly cam: Camera;
  /** Visible chunk indices, far first. */
  readonly visible: readonly number[];
  readonly chunk: (index: number) => CanvasImageSource;
  readonly time: number;
  readonly width: number;
  readonly height: number;
  readonly track: readonly TrackPoint[];
  readonly particles: readonly Particle[];
}

interface Drawable {
  readonly depth: number;
  readonly draw: () => void;
}

function screen(view: View, c: number, d: number, z = 0): [number, number] {
  const [x, y] = slopePx(view, c, d, z);
  return [Math.round(x), Math.round(y)];
}

function drawSprite(ctx: CanvasRenderingContext2D, scene: Scene, view: View, name: string, c: number, d: number, z = 0): void {
  const def = scene.content.manifest[name];
  const img = scene.content.sprites.get(name);
  const [px, py] = screen(view, c, d, z);
  if (def?.image && img) {
    const { anchor, frames, fps } = def.image;
    const cw = Math.floor(img.width / frames);
    const f = Math.floor(scene.time * fps) % frames;
    ctx.drawImage(img, f * cw, 0, cw, img.height, px - anchor[0], py - anchor[1], cw, img.height);
    return;
  }
  if (!def && !warnedMissing.has(name)) {
    warnedMissing.add(name);
    console.warn(`renderer: no manifest entry for sprite "${name}"; drawing the MISSING box`);
  }
  const ph = def?.placeholder ?? MISSING;
  const x = Math.round(px - ph.w / 2);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 1, py - ph.h - 1, ph.w + 2, ph.h + 2);
  ctx.fillStyle = ph.color;
  ctx.fillRect(x, py - ph.h, ph.w, ph.h);
}

function shadow(ctx: CanvasRenderingContext2D, view: View, c: number, d: number, z: number, rx: number): void {
  const [px, py] = screen(view, c, d, z);
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(px, py, rx, rx / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTracks(ctx: CanvasRenderingContext2D, view: View, track: readonly TrackPoint[]): void {
  ctx.lineWidth = 1;
  for (const [a, b] of trackSegments(track)) {
    const [x0, y0] = screen(view, a[0], a[1]);
    const [x1, y1] = screen(view, b[0], b[1]);
    ctx.strokeStyle = b[2] > 0.5 ? TRACK_DEEP : TRACK_LIGHT;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.5, y0 + 0.5);
    ctx.lineTo(x1 + 0.5, y1 + 0.5);
    ctx.stroke();
  }
}

/** A red-and-white dashed line across the piste at d. */
function drawFinishLine(ctx: CanvasRenderingContext2D, view: View, d: number): void {
  ctx.lineWidth = 2;
  for (let c = SLOPE.powder, i = 0; c < SLOPE.width - SLOPE.powder; c += 1, i++) {
    const [x0, y0] = screen(view, c, d);
    const [x1, y1] = screen(view, c + 1, d);
    ctx.strokeStyle = i % 2 === 0 ? FINISH_RED : SNOW;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, scene: Scene, view: View): void {
  const b = scene.state.board;
  if (b.tumble <= 0 && b.invuln > 0 && Math.floor(scene.time * 10) % 2 === 1) return; // blink while invulnerable
  shadow(ctx, view, b.c, b.d, groundZ(scene.content.slope.ramps, b.c, b.d), 6);
  const [px, py] = screen(view, b.c, b.d, b.z);
  const rider = scene.content.rider;
  if (!rider) {
    const [w, h] = b.tumble > 0 ? [16, 8] : [10, 22];
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(px - w / 2 - 1, py - h - 1, w + 2, h + 2);
    ctx.fillStyle = JACKET;
    ctx.fillRect(px - w / 2, py - h, w, h);
    return;
  }
  const { layout, image } = rider;
  const anim = rowsFor(layout, animFor(b));
  const row = anim.rows[dirFor(facing(b))];
  const f = Math.floor(scene.time * layout.fps) % anim.frames;
  const [cw, ch] = layout.cell;
  ctx.drawImage(image, f * cw, row * ch, cw, ch, px - layout.anchor[0], py - layout.anchor[1], cw, ch);
}

/** Low, flat things drawn under every standing sprite: kicker ramps and the finish line. */
function drawDecals(ctx: CanvasRenderingContext2D, scene: Scene, view: View): void {
  for (const r of scene.content.slope.ramps) drawSprite(ctx, scene, view, 'ramp', r.c, r.d + AIR.rampLen / 2);
  drawFinishLine(ctx, view, scene.content.slope.finish);
}

function standing(ctx: CanvasRenderingContext2D, scene: Scene, view: View): Drawable[] {
  const { slope } = scene.content;
  const st = scene.state;
  const at = (name: string, c: number, d: number, z = 0): Drawable => ({ depth: depthOf(c, d), draw: () => drawSprite(ctx, scene, view, name, c, d, z) });
  const hazards = slope.hazards.flatMap((h, i) => (st.burst.includes(i) ? [] : [at(h.kind, h.at[0], h.at[1])]));
  const flags = slope.gates.flatMap((g) => [at(`flag-${g.color}`, g.c[0], g.d), at(`flag-${g.color}`, g.c[1], g.d)]);
  const flakes = slope.flakes.flatMap((f, i) => (st.flakes.includes(i) ? [] : [at('flake', f[0], f[1], 0.3)]));
  const riders = slope.riders.flatMap((r, i) => {
    const p = riderPos(r, st.riders[i] ?? null, st.time);
    return p ? [at(r.look, p.c, p.d)] : [];
  });
  const player: Drawable = { depth: depthOf(st.board.c, st.board.d), draw: () => drawPlayer(ctx, scene, view) };
  return [...hazards, ...flags, ...flakes, ...riders, at('hut', HUT_AT[0], HUT_AT[1]), at('banner', SLOPE.width / 2, slope.finish), player];
}

function drawParticles(ctx: CanvasRenderingContext2D, view: View, ps: readonly Particle[]): void {
  ctx.fillStyle = SNOW;
  for (const p of ps) {
    const [x, y] = screen(view, p.c, p.d, p.z);
    const size = p.life > p.max / 2 ? 2 : 1;
    ctx.fillRect(x, y, size, size);
  }
}

export function renderFrame(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const view = viewOf(scene.cam);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, scene.width, scene.height);
  for (const i of scene.visible) {
    const b = chunkBounds(scene.content.slope.length, i);
    ctx.drawImage(scene.chunk(i), b.x - scene.cam.x, b.y - scene.cam.y);
  }
  drawTracks(ctx, view, scene.track);
  drawDecals(ctx, scene, view);
  for (const d of sortByDepth(standing(ctx, scene, view))) d.draw();
  drawParticles(ctx, view, scene.particles);
}
```

- [ ] **Step 6: Run the tests and check they pass, plus the typecheck**

Run: `npx vitest run games/bluebird-run/tests/unit/rider.test.ts games/bluebird-run/tests/unit/renderer.test.ts && npx tsc --noEmit`
Expected: PASS, and tsc is clean. (In the renderer test, the 2 `drawImage` calls are the two chunks.
Every sprite is a placeholder, so those are `fillRect` calls.)

- [ ] **Step 7: Commit**

```bash
git add games/bluebird-run/src/world/rider.ts games/bluebird-run/src/render/renderer.ts games/bluebird-run/src/content.ts games/bluebird-run/src/world/slopes/pinecone-bowl.json games/bluebird-run/tests/unit/rider.test.ts games/bluebird-run/tests/unit/renderer.test.ts
git commit -m "feat: Bluebird Run renderer, 8-direction rider layout and content loader"
```

---

### Task 15: HUD, text formatters and the phone layout

**Files:**
- Create: `G/src/ui/hud-text.ts`, `G/src/ui/hud.ts`
- Modify: `G/src/style.css` (replace it entirely)
- Test: `G/tests/unit/hud-text.test.ts`

- [ ] **Step 1: Write the failing test**

`G/tests/unit/hud-text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newRun } from '../../src/game/state';
import { clockText, countdownText, endRows, popupText, streakText } from '../../src/ui/hud-text';
import { makeSlope } from '../helpers/make-slope';

describe('hud text', () => {
  it('formats the run clock in tenths, rounding down', () => {
    expect(clockText(0)).toBe('0:00.0');
    expect(clockText(5.29)).toBe('0:05.2');
    expect(clockText(59.96)).toBe('0:59.9');
    expect(clockText(62)).toBe('1:02.0');
  });
  it('shows the countdown number, then Go!', () => {
    expect(countdownText(2.4)).toBe('3');
    expect(countdownText(0.2)).toBe('1');
    expect(countdownText(0)).toBe('Go!');
  });
  it('shows a streak from two gates up', () => {
    expect(streakText(1)).toBe('');
    expect(streakText(4)).toBe('×4');
  });
  it('flashes the latest notable event', () => {
    const trick = { halves: 2, grabbed: true, points: 525, name: '360 Grab' };
    expect(popupText([{ type: 'flake' }, { type: 'land', trick }])).toBe('360 Grab! +525');
    expect(popupText([{ type: 'land', trick: null }])).toBeNull();
    expect(popupText([{ type: 'wipeout' }])).toBe('Wipeout!');
    expect(popupText([{ type: 'crash', what: 'pine' }])).toBe('Ouch!');
    expect(popupText([{ type: 'gate', points: 200, streak: 3 }])).toBe('Gate streak ×3');
    expect(popupText([{ type: 'gate', points: 100, streak: 1 }])).toBeNull();
    expect(popupText([{ type: 'finish', time: 60, bonus: 600 }])).toBe('Finish! +600');
  });
  it('lists the end-card rows', () => {
    const slope = makeSlope({ gates: [{ d: 30, c: [6, 10], color: 'blue' }], flakes: [[8, 20], [8, 22]] });
    const s = { ...newRun(slope), score: 1450, finishTime: 64.32, gates: { next: 1, streak: 1, passed: 1 }, flakes: [1],
      bestTrick: { halves: 1, grabbed: false, points: 150, name: '180' } };
    expect(endRows(s, slope, 2000)).toEqual([
      ['Score', '1450'], ['Time', '1:04.3'], ['Gates', '1/1'], ['Best trick', '180 +150'], ['Snowflakes', '1/2'], ['Best', '2000'],
    ]);
    expect(endRows({ ...s, bestTrick: null }, slope, 0)[3]).toEqual(['Best trick', '—']);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run games/bluebird-run/tests/unit/hud-text.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the formatters**

`G/src/ui/hud-text.ts`:

```ts
import type { GameEvent, GameState } from '../game/state';
import type { Slope } from '../world/slope';

/** m:ss.t, rounding down to the tenth so the clock never shows time not yet ridden. */
export function clockText(t: number): string {
  const tenths = Math.floor(Math.max(0, t) * 10 + 1e-6);
  const m = Math.floor(tenths / 600);
  const s = (tenths % 600) / 10;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export const countdownText = (clock: number): string => (clock > 0 ? String(Math.ceil(clock)) : 'Go!');

export const streakText = (streak: number): string => (streak >= 2 ? `×${streak}` : '');

function eventText(e: GameEvent): string | null {
  switch (e.type) {
    case 'land': return e.trick ? `${e.trick.name}! +${e.trick.points}` : null;
    case 'wipeout': return 'Wipeout!';
    case 'crash': return 'Ouch!';
    case 'gate': return e.streak >= 3 ? `Gate streak ×${e.streak}` : null;
    case 'finish': return `Finish! +${e.bonus}`;
    default: return null;
  }
}

/** The text to flash for the latest notable event this frame, if any. */
export function popupText(events: readonly GameEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const text = eventText(events[i]);
    if (text) return text;
  }
  return null;
}

export function endRows(s: GameState, slope: Slope, best: number): [string, string][] {
  return [
    ['Score', String(s.score)],
    ['Time', clockText(s.finishTime ?? s.time)],
    ['Gates', `${s.gates.passed}/${slope.gates.length}`],
    ['Best trick', s.bestTrick ? `${s.bestTrick.name} +${s.bestTrick.points}` : '—'],
    ['Snowflakes', `${s.flakes.length}/${slope.flakes.length}`],
    ['Best', String(best)],
  ];
}
```

- [ ] **Step 4: Run the test and check it passes**

Run: `npx vitest run games/bluebird-run/tests/unit/hud-text.test.ts`. Expected: PASS.

- [ ] **Step 5: Implement the HUD (DOM only; checked by the e2e tests in Tasks 17 and 19)**

`G/src/ui/hud.ts`:

```ts
import type { GameState } from '../game/state';
import type { Slope } from '../world/slope';
import { clockText, countdownText, endRows, popupText, streakText } from './hud-text';

export interface HudCallbacks {
  onPause(): void;
  onRetry(): void;
  onMute(): void;
}

export interface Hud {
  update(state: GameState, slope: Slope, best: number, time: number, muted: boolean): void;
  showError(message: string): void;
}

const POPUP_SECONDS = 0.9;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = text;
  parent.append(e);
  return e;
}

function stat(bar: HTMLElement, label: string): HTMLElement {
  const box = el('div', 'stat', bar);
  const value = el('b', '', box);
  value.dataset.stat = label;
  el('span', '', box, label);
  return value;
}

function overlay(root: HTMLElement, name: string): [HTMLElement, HTMLElement] {
  const o = el('div', `overlay ${name}`, root);
  return [o, el('div', 'card', o)];
}

function button(parent: HTMLElement, label: string, text: string, onTap: () => void): HTMLButtonElement {
  const b = el('button', '', parent, text);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onTap();
  });
  return b;
}

const setText = (e: HTMLElement, text: string) => {
  if (e.textContent !== text) e.textContent = text;
};

const KEYS_DESKTOP = '←/→ or A/D carve · Space jump, hold in the air to grab · Esc pause';
const KEYS_TOUCH = 'Drag left/right to carve · tap to jump · keep a finger down in the air to grab';

export function createHud(root: HTMLElement, touch: boolean, cb: HudCallbacks): Hud {
  const bar = el('div', 'bar', root);
  const stats = { score: stat(bar, 'score'), time: stat(bar, 'time'), streak: stat(bar, 'streak') };
  const popup = el('div', 'popup', root);
  const count = el('div', 'count', root);
  if (!touch) el('div', 'hint', root, KEYS_DESKTOP);

  const buttons = el('div', 'buttons', root);
  const pauseBtn = button(buttons, 'Pause', 'Pause', cb.onPause);
  const retryBtn = button(buttons, 'Retry', 'Retry', cb.onRetry);
  const muteBtn = button(buttons, 'Mute', 'Sound', cb.onMute);
  pauseBtn.hidden = !touch;
  retryBtn.hidden = !touch;

  const [title, titleCard] = overlay(root, 'title');
  el('h1', '', titleCard, 'Bluebird Run');
  el('p', '', titleCard, 'Carve Pinecone Bowl on a bluebird day. Gates, kickers and a clean landing.');
  el('p', 'keys', titleCard, touch ? KEYS_TOUCH : KEYS_DESKTOP);
  const titleBest = el('p', 'best', titleCard);
  el('p', 'cta', titleCard, touch ? 'Tap to ride' : 'Press Enter to ride');

  const [pause, pauseCard] = overlay(root, 'pause');
  el('h1', '', pauseCard, 'Paused');
  el('p', '', pauseCard, touch ? 'Tap Pause to keep riding · Retry to restart' : 'Esc to keep riding · R to restart');

  const [end, endCard] = overlay(root, 'end');
  el('h1', '', endCard, 'Run complete!');
  const table = el('table', '', endCard);
  el('p', 'cta', endCard, touch ? 'Tap to ride again' : 'Press Enter or R to ride again');

  const [error, errorCard] = overlay(root, 'error');
  const errorText = el('p', '', errorCard);
  let popupUntil = -1;
  let endKey = '';

  return {
    update(s, slope, best, time, muted) {
      setText(stats.score, String(s.score));
      setText(stats.time, clockText(s.time));
      setText(stats.streak, streakText(s.gates.streak) || '–');
      const msg = popupText(s.events);
      if (msg) {
        popup.textContent = msg;
        popupUntil = time + POPUP_SECONDS;
      }
      popup.classList.toggle('on', (s.phase === 'riding' || s.phase === 'runout') && time < popupUntil);
      count.classList.toggle('on', s.phase === 'countdown' || (s.phase === 'riding' && s.time < 0.6));
      setText(count, countdownText(s.phase === 'countdown' ? s.clock : 0));
      bar.classList.toggle('on', s.phase !== 'title');
      buttons.classList.toggle('on', s.phase !== 'title');
      setText(muteBtn, muted ? 'Muted' : 'Sound');
      muteBtn.setAttribute('aria-pressed', String(muted));
      title.classList.toggle('on', s.phase === 'title');
      setText(titleBest, `Best: ${best}`);
      pause.classList.toggle('on', s.paused);
      end.classList.toggle('on', s.phase === 'over');
      if (s.phase === 'over') {
        const rows = endRows(s, slope, best);
        const key = rows.flat().join('|');
        if (key !== endKey) {
          endKey = key;
          table.replaceChildren(...rows.map(([k, v]) => {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            const td = document.createElement('td');
            th.textContent = k;
            td.textContent = v;
            tr.append(th, td);
            return tr;
          }));
        }
      }
    },
    showError(message) {
      for (const o of [title, pause, end]) o.classList.remove('on');
      errorText.textContent = message;
      error.classList.add('on');
    },
  };
}
```

- [ ] **Step 6: Replace the stylesheet**

`G/src/style.css`:

```css
:root { --bg: #9fd8ee; --ink: #14141c; --muted: #4d5f9a; --accent: #c8463c; --panel: rgba(244, 248, 255, 0.92); }
* { box-sizing: border-box; }
html, body {
  margin: 0; height: 100%; overflow: hidden;
  background: var(--page, var(--bg)); color: var(--ink);
  font: 14px/1.4 ui-monospace, Menlo, Consolas, monospace;
  /* The whole page is the steering surface on a phone: no scroll, zoom, selection or callouts. */
  touch-action: none; overscroll-behavior: none;
  -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
}
#stage { position: fixed; inset: 0; display: grid; place-items: center; }
#game { display: block; image-rendering: pixelated; }
#hud { position: fixed; inset: 0; pointer-events: none; }
.bar {
  position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
  display: none; gap: 24px; padding: 6px 16px; background: var(--panel); border-radius: 10px;
}
.bar.on { display: flex; }
.stat { min-width: 56px; text-align: center; }
.stat b { display: block; font-size: 18px; color: var(--accent); font-variant-numeric: tabular-nums; }
.stat span { font-size: 10px; letter-spacing: .12em; color: var(--muted); text-transform: uppercase; }
.popup, .count {
  position: absolute; left: 50%; transform: translateX(-50%); visibility: hidden;
  font-weight: bold; color: #ffffff; text-shadow: 0 2px 0 var(--ink), 0 0 6px rgba(20, 20, 28, .35); white-space: nowrap;
}
.popup { top: 24%; font-size: 24px; }
.count { top: 34%; font-size: 56px; }
.popup.on, .count.on { visibility: visible; }
.hint { position: absolute; bottom: 8px; left: 16px; font-size: 11px; color: var(--muted); }
.buttons {
  position: absolute; display: none; gap: 12px; pointer-events: auto;
  bottom: max(16px, env(safe-area-inset-bottom)); right: max(16px, env(safe-area-inset-right));
}
.buttons.on { display: flex; }
.buttons button {
  font: inherit; font-size: 14px; min-width: 72px; min-height: 44px; padding: 8px 14px;
  border: 2px solid var(--ink); border-radius: 10px; background: var(--panel); color: var(--ink);
  touch-action: manipulation;
}
.buttons button[hidden] { display: none; }
.overlay { position: absolute; inset: 0; display: none; place-items: center; }
.overlay.on { display: grid; }
.card { background: var(--panel); padding: 22px 28px; border-radius: 12px; text-align: center; min-width: min(300px, 86vw); max-width: 90vw; }
.card h1 { margin: 0 0 8px; color: var(--accent); font-size: 24px; }
.card .keys, .card .best { color: var(--muted); font-size: 12px; }
.card .cta { font-weight: bold; }
table { border-collapse: collapse; margin: 12px auto; }
th, td { padding: 3px 12px; text-align: left; }

/* Phone held upright: game near the top, buttons centred in the thumb zone below it. */
@media (pointer: coarse) and (orientation: portrait) {
  #stage { place-items: start center; padding-top: calc(max(10px, env(safe-area-inset-top)) + 96px); }
  .bar { top: calc(max(10px, env(safe-area-inset-top)) + 40px); }
  .buttons { right: auto; left: 50%; transform: translateX(-50%); bottom: max(24px, env(safe-area-inset-bottom)); }
}
/* Phone on its side: the canvas fills the height, buttons stack at the right edge. */
@media (pointer: coarse) and (orientation: landscape) {
  .bar { top: max(6px, env(safe-area-inset-top)); padding: 4px 12px; gap: 14px; }
  .buttons { flex-direction: column; top: 50%; bottom: auto; transform: translateY(-50%); }
  .popup { top: 20%; }
  .count { top: 28%; }
}

/* Pocket Arcade back link: a small chip in the top-left corner, clear of the centred HUD bar. */
.arcade-back {
  position: fixed; z-index: 10;
  top: max(10px, env(safe-area-inset-top)); left: max(10px, env(safe-area-inset-left));
  padding: 5px 10px; border-radius: 8px;
  background: var(--panel); color: var(--ink); opacity: .85;
  font-size: 12px; line-height: 1.2; text-decoration: none;
  touch-action: manipulation; -webkit-tap-highlight-color: transparent;
}
.arcade-back:hover, .arcade-back:focus-visible { opacity: 1; }
.arcade-back:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (max-width: 820px) and (pointer: fine) {
  .bar { top: calc(max(10px, env(safe-area-inset-top)) + 34px); }
}
```

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit`. Expected: clean.

```bash
git add games/bluebird-run/src/ui games/bluebird-run/src/style.css games/bluebird-run/tests/unit/hud-text.test.ts
git commit -m "feat: Bluebird Run HUD, end card, touch buttons and phone layout"
```

---

### Task 16: Sound effects (no music, no ambience)

**Files:**
- Create: `G/src/audio/sfx-math.ts`, `G/src/audio/sfx.ts`
- Test: `G/tests/unit/sfx-math.test.ts`

- [ ] **Step 1: Write the failing test**

`G/tests/unit/sfx-math.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chimePitch, cuesFor, swishFor } from '../../src/audio/sfx-math';
import { newRun } from '../../src/game/state';
import { ollie } from '../../src/sim/air';
import { makeSlope } from '../helpers/make-slope';

describe('cues', () => {
  it('maps events to sounds, once each per frame', () => {
    expect(cuesFor([{ type: 'flake' }, { type: 'flake' }, { type: 'ollie' }])).toEqual([{ sound: 'tick' }, { sound: 'pop' }]);
    expect(cuesFor([{ type: 'land', trick: { halves: 1, grabbed: false, points: 150, name: '180' } }])).toEqual([{ sound: 'thud' }, { sound: 'sparkle' }]);
    expect(cuesFor([{ type: 'crash', what: 'pine' }, { type: 'wipeout' }])).toEqual([{ sound: 'crunch' }]);
    expect(cuesFor([{ type: 'miss' }, { type: 'burst', at: [1, 1] }])).toEqual([]);
    expect(cuesFor([{ type: 'beep', n: 2 }, { type: 'go' }, { type: 'finish', time: 1, bonus: 0 }])).toEqual([{ sound: 'beep' }, { sound: 'go' }, { sound: 'sting' }]);
  });
  it('steps the gate chime up a semitone per streak, capped at an octave', () => {
    expect(chimePitch(1)).toBeCloseTo(660);
    expect(chimePitch(2)).toBeCloseTo(660 * 2 ** (1 / 12));
    expect(chimePitch(40)).toBeCloseTo(1320);
    expect(cuesFor([{ type: 'gate', points: 100, streak: 1 }])).toEqual([{ sound: 'chime', pitch: 660 }]);
  });
});

describe('swish', () => {
  const slope = makeSlope();
  const riding = { ...newRun(slope), phase: 'riding' as const };
  it('is silent off the snow or outside a run', () => {
    expect(swishFor({ ...riding, board: ollie({ ...riding.board, speed: 6 }) }).level).toBe(0);
    expect(swishFor({ ...riding, phase: 'title' }).level).toBe(0);
    expect(swishFor({ ...riding, paused: true, board: { ...riding.board, speed: 8, heading: 60 } }).level).toBe(0);
  });
  it('grows with speed and lean, and brightens with lean', () => {
    const slow = swishFor({ ...riding, board: { ...riding.board, speed: 2, heading: 10 } });
    const hard = swishFor({ ...riding, board: { ...riding.board, speed: 8, heading: 70 } });
    expect(hard.level).toBeGreaterThan(slow.level);
    expect(hard.cutoff).toBeGreaterThan(slow.cutoff);
    expect(hard.level).toBeLessThanOrEqual(0.35);
  });
});
```

- [ ] **Step 2: Run the test and check it fails**

Run: `npx vitest run games/bluebird-run/tests/unit/sfx-math.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the sound maths**

`G/src/audio/sfx-math.ts`:

```ts
import type { GameEvent, GameState } from '../game/state';
import { BOARD } from '../sim/constants';

export type Sound = 'beep' | 'go' | 'pop' | 'thud' | 'sparkle' | 'crunch' | 'chime' | 'tick' | 'sting';

export interface Cue {
  readonly sound: Sound;
  /** Hz, for pitched sounds (the gate chime). */
  readonly pitch?: number;
}

/** 660 Hz, up a semitone per gate in the streak, capped at an octave. */
export const chimePitch = (streak: number): number => 660 * 2 ** (Math.min(Math.max(streak, 1) - 1, 12) / 12);

function cuesOf(e: GameEvent): Cue[] {
  switch (e.type) {
    case 'beep': return [{ sound: 'beep' }];
    case 'go': return [{ sound: 'go' }];
    case 'ollie': case 'launch': return [{ sound: 'pop' }];
    case 'land': return e.trick ? [{ sound: 'thud' }, { sound: 'sparkle' }] : [{ sound: 'thud' }];
    case 'wipeout': case 'crash': return [{ sound: 'crunch' }];
    case 'gate': return [{ sound: 'chime', pitch: chimePitch(e.streak) }];
    case 'flake': return [{ sound: 'tick' }];
    case 'finish': return [{ sound: 'sting' }];
    default: return []; // miss and burst are silent (the crash already sounds)
  }
}

/** The sounds a frame's events trigger, each sound at most once, in first-seen order. */
export function cuesFor(events: readonly GameEvent[]): Cue[] {
  const seen = new Set<Sound>(); // local de-duplication
  return events.flatMap(cuesOf).filter((c) => (seen.has(c.sound) ? false : (seen.add(c.sound), true)));
}

export interface Swish {
  /** 0..0.35 gain. */
  readonly level: number;
  /** Band-pass centre, Hz. */
  readonly cutoff: number;
}

const QUIET: Swish = { level: 0, cutoff: 500 };

/** The continuous carve swish for the current state: louder with speed and lean, brighter with lean. */
export function swishFor(s: GameState): Swish {
  const b = s.board;
  if (s.paused || (s.phase !== 'riding' && s.phase !== 'runout') || b.air || b.tumble > 0) return QUIET;
  const lean = Math.min(1, Math.abs(b.heading) / BOARD.maxHeading);
  const speed = Math.min(1, b.speed / (BOARD.pull / BOARD.drag));
  return { level: 0.35 * speed * (0.2 + 0.8 * lean), cutoff: 500 + 2500 * lean };
}
```

- [ ] **Step 4: Implement the Web Audio player** (no unit test: it's browser-only; the e2e tests check there are no console errors)

`G/src/audio/sfx.ts`:

```ts
import type { Cue, Sound, Swish } from './sfx-math';

/** Sound effects only: there is deliberately no background music or ambience. */
export interface Sfx {
  /** Call from a user gesture: browsers only allow audio to start after one. Returns true once the context is running. */
  unlock(): boolean;
  play(cue: Cue): void;
  /** The continuous carve swish, updated every frame. */
  swish(s: Swish): void;
  setMuted(muted: boolean): void;
}

interface Graph {
  readonly ac: AudioContext;
  readonly master: GainNode;
  readonly noise: AudioBuffer;
  readonly swishGain: GainNode;
  readonly swishFilter: BiquadFilterNode;
}

const SILENT: Sfx = { unlock: () => true, play() {}, swish() {}, setMuted() {} };
const VOLUME = 0.7;

function noiseBuffer(ac: AudioContext): AudioBuffer {
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const ch = buf.getChannelData(0);
  // In-place fill of a fresh audio buffer: allowed per-frame-buffer mutation.
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  return buf;
}

function envelope(g: Graph, t: number, vol: number, dur: number): GainNode {
  const env = g.ac.createGain();
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.001, t + dur);
  env.connect(g.master);
  return env;
}

function tone(g: Graph, freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number): void {
  const t = g.ac.currentTime + at;
  const osc = g.ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  osc.connect(envelope(g, t, vol, dur));
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function hiss(g: Graph, dur: number, type: BiquadFilterType, freq: number, vol: number, at = 0): void {
  const t = g.ac.currentTime + at;
  const src = g.ac.createBufferSource();
  const filter = g.ac.createBiquadFilter();
  src.buffer = g.noise;
  filter.type = type;
  filter.frequency.value = freq;
  src.connect(filter).connect(envelope(g, t, vol, dur));
  src.start(t);
  src.stop(t + dur + 0.02);
}

const RECIPES: Readonly<Record<Sound, (g: Graph, pitch?: number) => void>> = {
  beep: (g) => tone(g, 660, 0.12, 'square', 0.12),
  go: (g) => tone(g, 990, 0.25, 'square', 0.14),
  pop: (g) => { tone(g, 320, 0.08, 'triangle', 0.25, 0, 640); hiss(g, 0.05, 'highpass', 2500, 0.1); },
  thud: (g) => { tone(g, 110, 0.14, 'sine', 0.35, 0, 60); hiss(g, 0.1, 'lowpass', 700, 0.25); },
  sparkle: (g) => [1320, 1760, 2640].forEach((f, i) => tone(g, f, 0.12, 'sine', 0.1, 0.04 + i * 0.05)),
  crunch: (g) => { hiss(g, 0.35, 'lowpass', 900, 0.55); tone(g, 90, 0.3, 'sawtooth', 0.15, 0, 45); },
  chime: (g, pitch = 660) => { tone(g, pitch, 0.4, 'sine', 0.22); tone(g, pitch * 1.5, 0.3, 'sine', 0.08, 0.02); },
  tick: (g) => tone(g, 2400, 0.05, 'square', 0.06),
  sting: (g) => [523, 659, 1047].forEach((f, i) => tone(g, f, 0.3, 'triangle', 0.2, i * 0.11)),
};

function resumeIfSuspended(g: Graph): boolean {
  if (g.ac.state === 'running') return true;
  if (g.ac.state === 'suspended') void g.ac.resume().catch(() => undefined);
  return false;
}

/** A looping noise source through a band-pass and a gain the frame loop rides. */
function startSwish(ac: AudioContext, master: GainNode, noise: AudioBuffer): Pick<Graph, 'swishGain' | 'swishFilter'> {
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const swishFilter = ac.createBiquadFilter();
  swishFilter.type = 'bandpass';
  swishFilter.Q.value = 0.8;
  const swishGain = ac.createGain();
  swishGain.gain.value = 0;
  src.connect(swishFilter).connect(swishGain).connect(master);
  src.start();
  return { swishGain, swishFilter };
}

export function createSfx(): Sfx {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return SILENT;
  let graph: Graph | null = null; // created on the first gesture
  let muted = false;
  return {
    unlock() {
      if (graph) return resumeIfSuspended(graph);
      try {
        const ac = new AC();
        const master = ac.createGain();
        master.gain.value = muted ? 0 : VOLUME;
        master.connect(ac.destination);
        const noise = noiseBuffer(ac);
        graph = { ac, master, noise, ...startSwish(ac, master, noise) };
      } catch (err) {
        console.warn('Audio is unavailable:', err);
        return true; // nothing to retry
      }
      return resumeIfSuspended(graph);
    },
    play(cue) {
      if (!graph || muted) return;
      resumeIfSuspended(graph);
      try {
        RECIPES[cue.sound](graph, cue.pitch);
      } catch (err) {
        console.warn(`Sound "${cue.sound}" failed:`, err);
      }
    },
    swish(s) {
      if (!graph) return;
      const t = graph.ac.currentTime;
      graph.swishGain.gain.setTargetAtTime(s.level, t, 0.05);
      graph.swishFilter.frequency.setTargetAtTime(s.cutoff, t, 0.05);
    },
    setMuted(m) {
      muted = m;
      if (graph) graph.master.gain.setTargetAtTime(m ? 0 : VOLUME, graph.ac.currentTime, 0.02);
    },
  };
}
```

- [ ] **Step 5: Run the test, typecheck and commit**

Run: `npx vitest run games/bluebird-run/tests/unit/sfx-math.test.ts && npx tsc --noEmit`. Expected: PASS, and tsc is clean.

```bash
git add games/bluebird-run/src/audio games/bluebird-run/tests/unit/sfx-math.test.ts
git commit -m "feat: Bluebird Run sound effects with a live carve swish"
```

---

### Task 17: Pinecone Bowl, the main loop and the desktop e2e test

**Files:**
- Modify: `G/src/world/slopes/pinecone-bowl.json` (replace the placeholder)
- Modify: `G/src/main.ts` (replace the stub)
- Create: `G/tests/e2e/hook.ts`, `G/tests/e2e/bluebird-run.spec.ts`
- Modify: `.claude/launch.json` (add a `bluebird-run` dev server on port 5175)
- Test: `G/tests/unit/pinecone-bowl.test.ts`

- [ ] **Step 1: Write the course**

`G/src/world/slopes/pinecone-bowl.json`. It's laid out in five sections: an easy opening slalom
(d 20–90), a tree glade with the first kicker (90–150), riders and snowmen (150–220), twin kickers
over rocks (220–290), and a tight finish slalom with the last kicker (290–350).

```json
{
  "name": "Pinecone Bowl",
  "length": 360,
  "finish": 350,
  "par": 75,
  "surfaces": [
    { "kind": "packed", "rect": [5, 20, 6, 70] },
    { "kind": "shade", "rect": [2, 86, 4, 16] },
    { "kind": "shade", "rect": [10, 88, 4, 14] },
    { "kind": "shade", "rect": [3, 116, 3, 12] },
    { "kind": "shade", "rect": [10, 114, 3, 14] },
    { "kind": "shade", "rect": [5, 136, 6, 10] },
    { "kind": "packed", "rect": [6, 290, 4, 60] }
  ],
  "gates": [
    { "d": 30, "c": [6, 10], "color": "blue" },
    { "d": 42, "c": [3, 7], "color": "red" },
    { "d": 54, "c": [8, 12], "color": "blue" },
    { "d": 66, "c": [5, 9], "color": "red" },
    { "d": 78, "c": [9, 13], "color": "blue" },
    { "d": 130, "c": [4, 8], "color": "red" },
    { "d": 160, "c": [8, 12], "color": "blue" },
    { "d": 172, "c": [4, 8], "color": "red" },
    { "d": 184, "c": [8, 12], "color": "blue" },
    { "d": 196, "c": [3, 7], "color": "red" },
    { "d": 240, "c": [6, 10], "color": "blue" },
    { "d": 270, "c": [9, 13], "color": "red" },
    { "d": 296, "c": [4, 8], "color": "blue" },
    { "d": 306, "c": [8, 12], "color": "red" },
    { "d": 334, "c": [4, 8], "color": "blue" },
    { "d": 344, "c": [8, 12], "color": "red" }
  ],
  "ramps": [
    { "d": 104, "c": 8 },
    { "d": 225, "c": 5 },
    { "d": 225, "c": 11 },
    { "d": 255, "c": 8 },
    { "d": 320, "c": 8 }
  ],
  "hazards": [
    { "kind": "rock-s", "at": [8, 36] },
    { "kind": "rock-l", "at": [12, 48] },
    { "kind": "rock-s", "at": [5, 60] },
    { "kind": "rock-s", "at": [11, 72] },
    { "kind": "rock-l", "at": [3, 84] },
    { "kind": "pine", "at": [4, 88] },
    { "kind": "pine", "at": [12, 92] },
    { "kind": "pine", "at": [3, 95] },
    { "kind": "pine", "at": [13, 99] },
    { "kind": "pine", "at": [11, 118] },
    { "kind": "pine", "at": [5, 120] },
    { "kind": "pine", "at": [4, 124] },
    { "kind": "pine", "at": [12, 126] },
    { "kind": "snowman", "at": [10, 135] },
    { "kind": "pine", "at": [6, 140] },
    { "kind": "pine", "at": [10, 142] },
    { "kind": "rock-l", "at": [8, 148] },
    { "kind": "pine", "at": [13, 150] },
    { "kind": "rock-s", "at": [8, 165] },
    { "kind": "snowman", "at": [5, 190] },
    { "kind": "pine", "at": [7.5, 206] },
    { "kind": "pine", "at": [13, 212] },
    { "kind": "pine", "at": [3, 214] },
    { "kind": "rock-s", "at": [10, 232] },
    { "kind": "snowman", "at": [11, 244] },
    { "kind": "rock-l", "at": [4, 250] },
    { "kind": "rock-s", "at": [6, 262] },
    { "kind": "rock-l", "at": [12, 262] },
    { "kind": "pine", "at": [2.5, 282] },
    { "kind": "pine", "at": [13.5, 286] },
    { "kind": "rock-s", "at": [8, 300] },
    { "kind": "snowman", "at": [6, 310] },
    { "kind": "rock-l", "at": [8, 328] }
  ],
  "riders": [
    { "look": "skier-red", "speed": 3.5, "path": [[9, 150], [6, 165], [10, 180], [6, 195], [9, 210]] },
    { "look": "boarder-purple", "speed": 4, "path": [[5, 200], [9, 215], [5, 230], [8, 245]] },
    { "look": "skier-green", "speed": 3, "path": [[11, 270], [7, 285], [11, 300], [8, 315]] }
  ],
  "flakes": [
    [10, 40], [10, 42], [10, 44],
    [8, 92], [8, 94], [8, 96], [8, 98], [8, 100],
    [8, 111], [8, 113], [8, 115],
    [5, 212], [5, 215], [5, 218], [5, 221],
    [11, 212], [11, 215], [11, 218], [11, 221],
    [8, 250], [8, 252],
    [8, 314], [8, 316], [8, 318]
  ]
}
```

- [ ] **Step 2: Write a test that the course loads**

`G/tests/unit/pinecone-bowl.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSlope } from '../../src/world/slope';
import slopeJson from '../../src/world/slopes/pinecone-bowl.json';

describe('Pinecone Bowl', () => {
  it('is a valid, full course', () => {
    const s = parseSlope(slopeJson);
    expect(s.name).toBe('Pinecone Bowl');
    expect(s.gates.length).toBeGreaterThanOrEqual(15);
    expect(s.ramps.length).toBeGreaterThanOrEqual(4);
    expect(s.riders.length).toBeGreaterThanOrEqual(3);
    expect(s.flakes.length).toBeGreaterThanOrEqual(20);
  });
});
```

Run: `npx vitest run games/bluebird-run/tests/unit/pinecone-bowl.test.ts`. Expected: PASS. If the
loader throws, the message names the bad field. Move that item, keeping the section's intent.

- [ ] **Step 3: Write the main loop**

`G/src/main.ts`:

```ts
import './style.css';
import { createSfx, type Sfx } from './audio/sfx';
import { cuesFor, swishFor } from './audio/sfx-math';
import { BUF_H, BUF_W, loadContent, type Content } from './content';
import { attachInput, type Input } from './core/input';
import { createStepper, startLoop } from './core/loop';
import { loadBest, loadMuted, saveBest, saveMuted, type KeyValueStore } from './game/score';
import { clearEvents, initialState, reduce, type Action, type GameState } from './game/state';
import { bakeToCanvases } from './render/assets';
import { cameraTarget, followCamera, snapCamera, type Camera } from './render/camera';
import { createChunkCache, visibleChunks, type ChunkCache } from './render/chunks';
import { parseHex } from './render/palette';
import { spawnFor, stepParticles, type Particle } from './render/particles';
import { buildTable, postColor, postProcess, SUNNY } from './render/post';
import { BACKGROUND, renderFrame } from './render/renderer';
import { bakeChunk, chunkCount } from './render/slope-bake';
import { pushTrack, trackPoint, type TrackPoint } from './render/tracks';
import { STEP } from './sim/constants';
import { createHud, type Hud } from './ui/hud';
import { canvasScale } from './ui/layout';

const LOAD_ERROR = "Couldn't load Pinecone Bowl — try refreshing";
const RUNTIME_ERROR = 'Something went wrong — try refreshing';
/** Carve spray is emitted every this many sim steps. */
const SPRAY_EVERY = 3;

const isTouchDevice = (): boolean => window.matchMedia?.('(pointer: coarse)').matches ?? false;

function safeStorage(): KeyValueStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function fitCanvas(canvas: HTMLCanvasElement): void {
  const scale = canvasScale(window.innerWidth, window.innerHeight, BUF_W, BUF_H, isTouchDevice());
  canvas.style.width = `${Math.floor(BUF_W * scale)}px`;
  canvas.style.height = `${Math.floor(BUF_H * scale)}px`;
}

/** Paints the page in the canvas backdrop's exact on-screen colour, so the game sits on one seamless background. */
function matchPageToCanvas(content: Content, table: Uint8Array): void {
  const [r, g, b] = postColor(content.palette, table, parseHex(BACKGROUND));
  document.documentElement.style.setProperty('--page', `rgb(${r},${g},${b})`);
}

function wireAudio(): Sfx {
  const sfx = createSfx();
  // Stay attached until the context is actually running: the first gesture can leave it suspended.
  const unlock = () => {
    if (!sfx.unlock()) return;
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);
  return sfx;
}

function whenIdle(task: () => void): void {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(task);
  else window.setTimeout(task, 0);
}

/** Bakes chunks ahead of need, one idle slot at a time. Visible chunks still bake on demand. */
function createPrebaker(chunks: ChunkCache<HTMLCanvasElement[]>): (index: number) => void {
  // Mutated on purpose: at most one bake is scheduled, and an index is not rescheduled once requested.
  let pending = false;
  let last = -1;
  return (index) => {
    if (pending || index === last) return;
    pending = true;
    last = index;
    whenIdle(() => {
      pending = false;
      chunks.get(index);
    });
  };
}

interface FrameDeps {
  readonly ctx: CanvasRenderingContext2D;
  readonly content: Content;
  readonly hud: Hud;
  readonly sfx: Sfx;
  readonly input: Input;
  readonly storage: KeyValueStore | null;
  readonly muted: () => boolean;
  readonly getState: () => GameState;
  readonly setState: (s: GameState) => void;
}

function createFrame(d: FrameDeps): (dt: number) => void {
  const { slope } = d.content;
  const table = buildTable(d.content.palette, SUNNY);
  matchPageToCanvas(d.content, table);
  const chunks = createChunkCache((i) => bakeToCanvases(bakeChunk(slope, i)));
  const prebake = createPrebaker(chunks);
  const count = chunkCount(slope.length);
  const steps = createStepper(STEP);
  // Frame-loop locals, replaced (never mutated) each frame.
  let best = loadBest(d.storage);
  let cam: Camera = cameraTarget(d.getState().board.c, d.getState().board.d);
  let prev = d.getState();
  let track: TrackPoint[] = [];
  let particles: Particle[] = [];
  let tickNo = 0;
  let time = 0;

  return (dt: number) => {
    time += Math.max(0, dt);
    let state = d.getState();
    for (let n = steps(dt); n > 0; n--) {
      state = reduce(state, { type: 'tick', dt: STEP, controls: d.input.controls() }, slope);
      if (state.phase === 'riding' && !state.paused) {
        track = pushTrack(track, trackPoint(state.board));
        if (tickNo % SPRAY_EVERY === 0) particles = spawnFor(particles, state.board, [], tickNo);
      }
      tickNo++;
    }
    particles = stepParticles(spawnFor(particles, state.board, state.events, tickNo, false), dt);
    if (state.phase === 'over' && prev.phase !== 'over') best = saveBest(d.storage, state.score);
    // A new run starts back at the hut: jump the camera and clear the snow trail instead of sweeping back up.
    if (state.board.d + 1 < prev.board.d) {
      cam = cameraTarget(state.board.c, state.board.d);
      track = [];
      particles = [];
    }
    prev = state;
    cam = followCamera(cam, cameraTarget(state.board.c, state.board.d), dt);
    const snapped = snapCamera(cam);
    const visible = visibleChunks(slope.length, snapped, BUF_W, BUF_H);
    renderFrame(d.ctx, {
      content: d.content, state, cam: snapped, visible, chunk: (i) => chunks.get(i)[0], time, width: BUF_W, height: BUF_H, track, particles,
    });
    postProcess(d.ctx, BUF_W, BUF_H, d.content.palette.lut, table);
    // Keep what is on screen plus the next chunk downhill, baked before it scrolls into view.
    const ahead = (visible[0] ?? 0) + 1;
    chunks.keepOnly(ahead < count ? [...visible, ahead] : visible);
    if (ahead < count) prebake(ahead);
    for (const cue of cuesFor(state.events)) d.sfx.play(cue);
    d.sfx.swish(swishFor(state));
    d.hud.update(state, slope, best, time, d.muted());
    d.setState(clearEvents(state));
  };
}

/** HUD button callbacks, bound once the game is running. Late-bound on purpose: mutated exactly once in runGame. */
interface HudBindings {
  dispatch: (a: Action) => void;
  toggleMute: () => void;
}

function runGame(ctx: CanvasRenderingContext2D, content: Content, hud: Hud, bindings: HudBindings): void {
  const storage = safeStorage();
  const sfx = wireAudio();
  let state: GameState = initialState(content.slope);
  let muted = loadMuted(storage);
  sfx.setMuted(muted);
  const dispatch = (a: Action) => {
    state = reduce(state, a, content.slope);
  };
  bindings.dispatch = dispatch;
  bindings.toggleMute = () => {
    muted = !muted;
    saveMuted(storage, muted);
    sfx.setMuted(muted);
  };
  const input = attachInput(window, dispatch);
  // Leaving the tab mid-run pauses it rather than riding on unattended.
  window.addEventListener('blur', () => {
    if ((state.phase === 'riding' || state.phase === 'countdown') && !state.paused) dispatch({ type: 'togglePause' });
  });
  const frame = createFrame({
    ctx, content, hud, sfx, input, storage, muted: () => muted, getState: () => state, setState: (s) => { state = s; },
  });
  const stop = startLoop((dt) => {
    try {
      frame(dt);
    } catch (err) {
      console.error('Game loop stopped after an error:', err);
      hud.showError(RUNTIME_ERROR);
      stop();
    }
  });
  if (import.meta.env.DEV) {
    (window as unknown as { __bluebird: unknown }).__bluebird = { getState: () => state, dispatch };
  }
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const bindings: HudBindings = { dispatch: () => undefined, toggleMute: () => undefined };
  const hud = createHud(document.getElementById('hud') as HTMLElement, isTouchDevice(), {
    onPause: () => bindings.dispatch({ type: 'togglePause' }),
    onRetry: () => bindings.dispatch({ type: 'restart' }),
    onMute: () => bindings.toggleMute(),
  });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    console.error('2D canvas is not available');
    hud.showError(LOAD_ERROR);
    return;
  }
  ctx.imageSmoothingEnabled = false;
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  try {
    runGame(ctx, await loadContent(), hud, bindings);
  } catch (err) {
    console.error('Failed to load Bluebird Run:', err);
    hud.showError(LOAD_ERROR);
  }
}

void boot();
```

- [ ] **Step 4: Add the dev-server entry for previews**

In `.claude/launch.json`, add this to `configurations`:

```json
    {
      "name": "bluebird-run",
      "runtimeExecutable": "/Users/nathanielleong/.nvm/versions/node/v22.22.3/bin/npx",
      "runtimeArgs": ["vite", "--port", "5175", "--strictPort", "--open", "/games/bluebird-run/"],
      "port": 5175
    }
```

- [ ] **Step 5: Write the desktop e2e test**

`G/tests/e2e/hook.ts`:

```ts
import type { Action, GameState } from '../../src/game/state';

declare global {
  interface Window {
    __bluebird: { getState(): GameState; dispatch(a: Action): void };
  }
}

export {};
```

`G/tests/e2e/bluebird-run.spec.ts`:

```ts
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
```

- [ ] **Step 6: Run everything for the game**

Before the e2e run, check that nothing is on port 5199: `lsof -i :5199` should print nothing.
If it prints anything, stop and report it. Don't kill another session's server.

Run: `npx tsc --noEmit && npx vitest run games/bluebird-run && npx playwright test --project=bluebird-run`
Expected: all pass. Open `test-results/bluebird-riding.png`. It should show the snow slope with
placeholder boxes and the red rider box below the HUD bar.

- [ ] **Step 7: Commit**

```bash
git add games/bluebird-run .claude/launch.json
git commit -m "feat: Bluebird Run main loop, Pinecone Bowl course and desktop e2e"
```

---

### Task 18: Headless bot, proof that the course can be ridden

**Files:**
- Create: `G/tests/helpers/bot.ts`
- Test: `G/tests/unit/bot.test.ts`
- Maybe modify: `G/src/world/slopes/pinecone-bowl.json` (tuning only)

- [ ] **Step 1: Write the bot**

`G/tests/helpers/bot.ts`:

```ts
import type { Vec2 } from '../../src/core/geometry';
import { initialState, reduce, type GameState } from '../../src/game/state';
import type { Controls } from '../../src/sim/board';
import { STEP } from '../../src/sim/constants';
import { riderPos } from '../../src/sim/hazards';
import type { Slope } from '../../src/world/slope';

export type Bot = (s: GameState, slope: Slope) => Controls;

const LANES = Array.from({ length: 21 }, (_, i) => 3 + i * 0.5); // c 3 … 13
const LOOK = 10; // tiles ahead

function obstacles(s: GameState, slope: Slope): Vec2[] {
  const { d } = s.board;
  const near = (p: Vec2) => p[1] > d - 0.5 && p[1] < d + LOOK;
  const fixed = slope.hazards.filter((h, i) => !s.burst.includes(i) && near(h.at)).map((h) => h.at);
  const moving = slope.riders.flatMap((r, i) => {
    const p = riderPos(r, s.riders[i] ?? null, s.time);
    return p && near([p.c, p.d]) ? [[p.c, p.d] as Vec2] : [];
  });
  return [...fixed, ...moving];
}

const laneCost = (lane: number, c: number, d: number, obs: readonly Vec2[]): number =>
  obs.reduce((n, o) => n + (Math.abs(o[0] - lane) < 1.3 ? 10 / (1 + Math.max(0, o[1] - d)) : 0), Math.abs(lane - c) * 0.15);

/** Picks the clearest lane within the look-ahead and steers toward it: a careful, average player. */
export const carefulBot: Bot = (s, slope) => {
  const b = s.board;
  const obs = obstacles(s, slope);
  const lane = LANES.reduce((best, l) => (laneCost(l, b.c, b.d, obs) < laneCost(best, b.c, b.d, obs) ? l : best), LANES[0]);
  const want = Math.max(-55, Math.min(55, (lane - b.c) * 14));
  const diff = want - b.heading;
  return { turn: Math.abs(diff) < 4 ? 0 : Math.sign(diff), jump: false };
};

export const straightBot: Bot = () => ({ turn: 0, jump: false });

export interface Crash {
  readonly what: string;
  readonly c: number;
  readonly d: number;
}

/** Plays a whole run headlessly at 60 Hz; returns the final state and every crash with where it happened. */
export function playRun(slope: Slope, bot: Bot, maxSeconds = 180): { final: GameState; crashes: Crash[] } {
  let s = reduce(initialState(slope), { type: 'start' }, slope);
  const crashes: Crash[] = []; // local accumulator
  for (let i = 0; i < maxSeconds / STEP && s.phase !== 'over'; i++) {
    s = reduce({ ...s, events: [] }, { type: 'tick', dt: STEP, controls: bot(s, slope) }, slope);
    for (const e of s.events) {
      if (e.type === 'crash') crashes.push({ what: e.what, c: s.board.c, d: s.board.d });
      if (e.type === 'wipeout') crashes.push({ what: 'wipeout', c: s.board.c, d: s.board.d });
    }
  }
  return { final: s, crashes };
}
```

- [ ] **Step 2: Write the test**

`G/tests/unit/bot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSlope } from '../../src/world/slope';
import slopeJson from '../../src/world/slopes/pinecone-bowl.json';
import { carefulBot, playRun, straightBot } from '../helpers/bot';

const slope = parseSlope(slopeJson);

describe('Pinecone Bowl is ridable', () => {
  it('a careful line reaches the finish with no crashes', () => {
    const { final, crashes } = playRun(slope, carefulBot);
    expect(crashes, JSON.stringify(crashes)).toEqual([]);
    expect(final.phase).toBe('over');
    expect(final.finishTime).not.toBeNull();
    expect(final.finishTime!).toBeLessThan(120);
    expect(final.gates.passed).toBeGreaterThan(0);
  });
  it('pointing straight down hits something, so the hazards matter', () => {
    const { crashes } = playRun(slope, straightBot);
    expect(crashes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run the test and tune**

Run: `npx vitest run games/bluebird-run/tests/unit/bot.test.ts`

If the careful bot crashes, the assertion message lists each crash with `what`, `c` and `d`. Fix it
in this order, re-running after each change. Stop after three rounds and report if it still fails.
1. If the crash is at a spot where a lane is plainly open but the bot turned late (for example a
   tree sat right behind a gate), move that **course item** 1–2 tiles, keeping the section's
   intent, and keep `pinecone-bowl.test.ts` passing.
2. If the bot is plainly dumb (for example it picks a lane it can't reach in time), you may change
   `LOOK` or the lane cost in the bot.
3. Never change `sim/constants.ts` to make the bot pass.

Expected in the end: both tests PASS.

- [ ] **Step 4: Commit**

```bash
git add games/bluebird-run/tests/helpers/bot.ts games/bluebird-run/tests/unit/bot.test.ts games/bluebird-run/src/world/slopes/pinecone-bowl.json
git commit -m "test: headless bot proves Pinecone Bowl is ridable and its hazards bite"
```

---

### Task 19: iPhone touch e2e (portrait and landscape)

**Files:**
- Create: `G/tests/e2e/bluebird-touch.spec.ts`

- [ ] **Step 1: Write the test**

`G/tests/e2e/bluebird-touch.spec.ts`:

```ts
import { devices, expect, test, type Page } from '@playwright/test';
import './hook';

type Point = readonly [number, number];

/** Real touch input over CDP (not synthetic DOM events), so touch-action and pointerType behave as on a phone. */
async function touches(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', [x, y]: Point) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  return {
    tap: async (p: Point) => { await send('touchStart', p); await send('touchEnd', p); },
    down: (p: Point) => send('touchStart', p),
    move: (p: Point) => send('touchMove', p),
    up: (p: Point) => send('touchEnd', p),
  };
}

const phase = (page: Page) => page.evaluate(() => window.__bluebird.getState().phase);

async function startRun(page: Page, at: Point): Promise<Awaited<ReturnType<typeof touches>>> {
  await page.goto('/games/bluebird-run/');
  await expect(page.locator('.overlay.title.on')).toBeVisible();
  await expect(page.getByText('Tap to ride')).toBeVisible();
  const t = await touches(page);
  await t.tap(at);
  await page.waitForFunction(() => window.__bluebird.getState().phase === 'riding', undefined, { timeout: 6000 });
  return t;
}

test.describe('iPhone portrait', () => {
  test.use({ ...devices['iPhone 13'], defaultBrowserType: 'chromium' });

  test('tap starts, drag carves, tap ollies', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    const t = await startRun(page, [195, 600]);
    expect(await phase(page)).toBe('riding');

    await t.down([195, 600]);
    for (let i = 1; i <= 6; i++) await t.move([195 + i * 10, 600]);
    await page.waitForFunction(() => window.__bluebird.getState().board.heading > 20);
    await t.up([255, 600]);

    await page.waitForTimeout(300);
    await t.tap([195, 600]);
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
    await page.getByRole('button', { name: 'Pause' }).tap();
    await expect(page.getByRole('heading', { name: 'Paused' })).toBeHidden();
    await page.getByRole('button', { name: 'Retry' }).tap();
    expect(await phase(page)).toBe('countdown');
  });
});

test.describe('iPhone landscape', () => {
  test.use({ ...devices['iPhone 13 landscape'], defaultBrowserType: 'chromium' });

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
```

- [ ] **Step 2: Run it**

Run: `npx playwright test --project=bluebird-run`
Expected: all 4 tests pass (1 desktop and 3 touch). Look at `test-results/bluebird-portrait.png`
and `bluebird-landscape.png` and check the layout by eye: the back link is top-left, the HUD bar
doesn't cover the canvas top badly, and the buttons are in the thumb zone or at the right edge.

If a CDP tap doesn't start the run, check that `attachInput` listens on `window` for
`pointerdown`/`pointerup`, and that the title overlay isn't stopping the events (the HUD root has
`pointer-events: none`).

- [ ] **Step 3: Commit**

```bash
git add games/bluebird-run/tests/e2e/bluebird-touch.spec.ts
git commit -m "test: Bluebird Run iPhone touch e2e in portrait and landscape"
```

---

### Task 20: PixelLab ingest script

**Files:**
- Create: `G/scripts/ingest.ts`

- [ ] **Step 1: Write the script** (adapted from `P/scripts/ingest.ts`; read it first)

`G/scripts/ingest.ts`:

```ts
// Usage (run from the repo root):
//   npm run ingest:bluebird-run -- object <name> <png | dir-of-frames> [fps]
//       → assets/sprites/<name>.png + manifest image (a dir becomes a left-to-right frame strip)
//   npm run ingest:bluebird-run -- rider <dir>
//       → assets/sprites/rider.png + assets/rider.json
//     <dir> is an extracted PixelLab character ZIP. For each animation in ride, air, grab, tumble it reads
//     <dir>/<state>/animations/<anim>/<direction>/frame_NNN.png (rename PixelLab's animation folders to these names).
//     With no ride animation, the static <dir>/<state>/rotations/<direction>.png images become a 1-frame ride.
//     Raw downloads go in games/bluebird-run/assets/raw/ (gitignored).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import paletteJson from '../assets/palette.json';
import { parsePalette } from '../src/render/palette';
import { ANIMS, DIRS } from '../src/world/rider';
import { bottomCenter, packRows, snapToPalette, trim, type Bitmap } from './lib/sprite-tools';

/** Resolved from this script's own location, so the game folder can move. */
const ASSETS = fileURLToPath(new URL('../assets', import.meta.url));
const RIDER_FPS = 10;
const colors = parsePalette(paletteJson);

function readPng(file: string): Bitmap {
  const png = PNG.sync.read(readFileSync(file));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}

function writePng(file: string, b: Bitmap): void {
  const png = new PNG({ width: b.width, height: b.height });
  png.data = Buffer.from(b.data);
  writeFileSync(file, PNG.sync.write(png));
}

const framesIn = (dir: string): string[] => readdirSync(dir).filter((f) => f.endsWith('.png')).sort().map((f) => join(dir, f));

function ingestObject(name: string, input: string, fps: number): void {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`bad sprite name "${name}"`);
  const files = statSync(input).isDirectory() ? framesIn(input) : [input];
  if (files.length === 0) throw new Error(`no frames in ${input}`);
  const frames = files.map((f) => snapToPalette(readPng(f), colors));
  const sheet = frames.length === 1
    ? (() => { const b = trim(frames[0], 1); return { bitmap: b, anchor: bottomCenter(b) }; })()
    : packRows([frames]);
  mkdirSync(`${ASSETS}/sprites`, { recursive: true });
  writePng(`${ASSETS}/sprites/${name}.png`, sheet.bitmap);
  const manifestFile = `${ASSETS}/manifest.json`;
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as Record<string, Record<string, unknown>>;
  manifest[name] = { ...(manifest[name] ?? {}), image: { src: `${name}.png`, anchor: sheet.anchor, frames: frames.length, fps } };
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`object ${name}: ${frames.length} frame(s), sheet ${sheet.bitmap.width}x${sheet.bitmap.height}, anchor ${sheet.anchor.join(',')}`);
}

function framesFor(dir: string, state: string, anim: string, d: string): string[] | null {
  const folder = join(dir, state, 'animations', anim, d);
  if (existsSync(folder)) return framesIn(folder);
  const still = join(dir, state, 'rotations', `${d}.png`);
  return anim === 'ride' && existsSync(still) ? [still] : null;
}

function ingestRider(dir: string): void {
  const state = readdirSync(dir, { withFileTypes: true }).find((e) => e.isDirectory())?.name;
  if (!state) throw new Error(`no state folder in ${dir}`);
  const rows: Bitmap[][] = []; // local accumulator for the sheet
  const anims: Record<string, { frames: number; rows: Record<string, number> }> = {};
  for (const anim of ANIMS) {
    const perDir = DIRS.map((d) => framesFor(dir, state, anim, d));
    if (perDir.every((f) => f === null)) {
      if (anim === 'ride') throw new Error(`no ride animation or rotations in ${join(dir, state)}`);
      continue;
    }
    const missing = DIRS.filter((_, i) => !perDir[i]?.length);
    if (missing.length) throw new Error(`${anim}: missing directions ${missing.join(', ')}`);
    const frames = Math.min(...perDir.map((f) => f!.length));
    anims[anim] = { frames, rows: Object.fromEntries(DIRS.map((d, i) => [d, rows.length + i])) };
    for (const files of perDir) rows.push(files!.slice(0, frames).map((f) => snapToPalette(readPng(f), colors)));
  }
  const sheet = packRows(rows);
  mkdirSync(`${ASSETS}/sprites`, { recursive: true });
  writePng(`${ASSETS}/sprites/rider.png`, sheet.bitmap);
  const layout = { src: 'rider.png', cell: sheet.cell, anchor: sheet.anchor, fps: RIDER_FPS, anims };
  writeFileSync(`${ASSETS}/rider.json`, `${JSON.stringify(layout, null, 2)}\n`);
  console.log(`rider: ${Object.keys(anims).join(', ')}; ${rows.length} rows, cell ${sheet.cell.join('x')}`);
}

const [kind, a, b] = process.argv.slice(2);
try {
  if (kind === 'object' && a && b) ingestObject(a, b, Number(process.argv[5] ?? 8));
  else if (kind === 'rider' && a) ingestRider(a);
  else {
    console.error('Usage: npm run ingest:bluebird-run -- object <name> <png|dir> [fps] | rider <dir>');
    process.exitCode = 2;
  }
} catch (err) {
  console.error(String(err));
  process.exitCode = 1;
}
```

- [ ] **Step 2: Check it**

Run: `npx tsc --noEmit && npm run ingest:bluebird-run`
Expected: tsc is clean, and the script prints the usage line and exits with code 2.

- [ ] **Step 3: Commit**

```bash
git add games/bluebird-run/scripts/ingest.ts
git commit -m "feat: Bluebird Run PixelLab ingest for objects and the multi-animation rider"
```

---

### Task 21: PixelLab style-lock (USER GATE). The controller does this itself, not a subagent

The PixelLab MCP tools and the user's approval are only available in the main session. Spend no
more than about 25 generations here.

- [ ] **Step 1: Load the tools and check the balance.** Use `ToolSearch` with
  `select:mcp__pixellab__get_balance,mcp__pixellab__create_character,mcp__pixellab__get_character,mcp__pixellab__animate_character,mcp__pixellab__create_map_object,mcp__pixellab__get_map_object,mcp__pixellab__wait_for_jobs`,
  then call `get_balance`. Read the Paper Route rider's settings (`get_character` with id
  `af446cf0-a51a-4f10-b89e-8a27a40397b4`) and match its size, view, outline and shading choices, so
  the arcade's two riders feel like siblings.
- [ ] **Step 2: Generate the snowboarder.** Call `create_character` with 8 directions, the same
  size and view as the Paper Route rider, and a description along these lines: "young snowboarder
  in a bright red puffy jacket, teal beanie, white goggles, navy snow pants and mittens, riding a
  yellow snowboard, crouched carving stance, chunky pixel art, dark outline". Check the result with
  `get_character`, and regenerate at most twice if the board isn't visible or it doesn't read at
  32 px.
- [ ] **Step 3: Generate the pine.** Use `create_map_object` (or the closest single-object tool its
  schema offers) for "snowy pine tree, dark green with white snow on its branches, chunky pixel art,
  dark outline". Keep it small: about 1.2× the rider's height. Use the rider as the style reference
  if the tool allows it, cropped to fit the canvas limit (Paper Route hit a "style image larger than
  canvas" error and fixed it with a crop).
- [ ] **Step 4: Ingest and show both in the game.** Download both into
  `games/bluebird-run/assets/raw/`, then run `npm run ingest:bluebird-run -- rider <dir>` and
  `npm run ingest:bluebird-run -- object pine <png>`. Start the `bluebird-run` preview, start a
  run, take screenshots at 360×270 ×2 on desktop and in the mobile preset, and show them to the user.
  PixelLab ZIP layouts vary. If the rider ZIP has no `<state>/` folder, or names its folders
  differently, adjust `framesFor` and the state lookup in `scripts/ingest.ts`, and commit that as a
  `fix:` before ingesting.
- [ ] **Step 5: Ask for approval** with `AskUserQuestion`: approve, regenerate the rider, or
  regenerate the pine. Don't generate any other art until both are approved. Commit the approved
  sprites, manifest and `rider.json`:

```bash
git add games/bluebird-run/assets
git commit -m "feat: Bluebird Run style-lock art (snowboarder and pine)"
```

---

### Task 22: Remaining art (controller, after approval)

- [ ] **Step 1: Rider animations.** Use `animate_character` on the approved rider to make `air`
  (a tucked jump), `grab` (a hand on the board) and `tumble` (falling or rolling). Then make `ride`
  too, but only if the static rotations look stiff in motion. Rename the animation folders to
  `ride`/`air`/`grab`/`tumble` and re-run `ingest:bluebird-run -- rider`.
- [ ] **Step 2: Props.** Generate these in the approved style, using the rider or pine as the style
  reference: `rock-s`, `rock-l`, `snowman`, `flag-blue`, `flag-red`, `ramp` (a low snow kicker,
  about 2 × 3 tiles), `flake` (golden snowflake, 4-frame spin), `hut` (a small wooden start hut
  with a snowy roof), `banner` (a red-and-white finish arch), and `skier-red`, `skier-green`,
  `boarder-purple` (single direction facing south-east; make palette variants of one generation if
  the tools allow). Ingest each one with `object <name>`.
- [ ] **Step 3: By-eye pass.** Play a full run in the preview on desktop and in the mobile preset.
  Check the sprite anchors (feet and bases on the snow), the size relative to the rider, and that
  shadows and tracks read well. Fix any bad anchor in `assets/manifest.json`. Run
  `npx vitest run games/bluebird-run` (the manifest test still passes) and commit:

```bash
git add games/bluebird-run/assets
git commit -m "feat: Bluebird Run props and rider animations"
```

---

### Task 23: Hub card, hub e2e and README

**Files:**
- Modify: `index.html` (root), `tests/e2e/hub.spec.ts`, `README.md`
- Create: `public/hub/bluebird-run.png`

- [ ] **Step 1: Capture a real 320×200 thumbnail.** With the `bluebird-run` preview running
  (port 5175), write this scratch script outside the repo, at
  `<scratchpad>/thumb.mjs`:

```js
// ES modules ignore NODE_PATH, so resolve the repo's packages from the working directory.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const req = createRequire(process.cwd() + '/');
const { chromium } = req('@playwright/test');
const { PNG } = req('pngjs');

const [url, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(url);
await page.keyboard.press('Enter');
await page.waitForFunction(() => window.__bluebird.getState().phase === 'riding');
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(500);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(2500);
// The 360×270 buffer itself, not the scaled page: exact pixels.
const dataUrl = await page.evaluate(() => document.getElementById('game').toDataURL('image/png'));
const src = PNG.sync.read(Buffer.from(dataUrl.split(',')[1], 'base64'));
const dst = new PNG({ width: 320, height: 200 });
const ox = 20, oy = 30; // centre-ish crop around the rider anchor (128, 76)
for (let y = 0; y < 200; y++) for (let x = 0; x < 320; x++) {
  const s = ((y + oy) * src.width + (x + ox)) * 4, d = (y * 320 + x) * 4;
  for (let k = 0; k < 4; k++) dst.data[d + k] = src.data[s + k];
}
writeFileSync(out, PNG.sync.write(dst));
await browser.close();
```

Run it from the worktree root, so `@playwright/test` and `pngjs` resolve from `node_modules`:
`node <scratchpad>/thumb.mjs http://localhost:5175/games/bluebird-run/ public/hub/bluebird-run.png`.
Look at the PNG. The rider, some flags and pines should be in frame. If the crop misses them,
adjust `ox`/`oy` or the wait.

- [ ] **Step 2: Add the card.** In the root `index.html`, after the Paper Route `<li>`, add:

```html
        <li class="game">
          <article>
            <img
              class="thumb"
              src="/hub/bluebird-run.png"
              width="320"
              height="200"
              alt="A pixel-art snowboarder carving down a sunny isometric ski slope past pine trees and slalom flags"
            />
            <div class="body">
              <p class="tag">1 slope · 16 gates</p>
              <h2>Bluebird Run</h2>
              <p class="blurb">Carve Pinecone Bowl on a bluebird day. Gates, kickers and a clean landing.</p>
              <a class="play" href="./games/bluebird-run/" data-testid="play-bluebird-run">
                Play<span class="sr-only"> Bluebird Run</span> <span aria-hidden="true">▸</span>
              </a>
            </div>
          </article>
        </li>
```

Set the gate count in the tag line to the real `gates.length` of the tuned course. `src/hub/hub.css`
needs no change, because the grid already wraps any number of cards. Re-read it to confirm, and only
touch it if a third card breaks the layout at 375 px or 1100 px.

- [ ] **Step 3: Extend the hub e2e test.** In `tests/e2e/hub.spec.ts`:
  - rename the first test to `'the hub shows every game card and each Play link reaches its title screen'`
  - change `toHaveCount(2)` to `toHaveCount(3)`
  - after the Paper Route heading check, add
    `await expect(page.getByRole('heading', { name: 'Bluebird Run' })).toBeVisible();`
  - after the Paper Route Play-link block (before `expect(errors)`), add:

```ts
  await page.getByRole('link', { name: '← Pocket Arcade' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Play Bluebird Run' }).click();
  await expect(page).toHaveURL(/\/games\/bluebird-run\/$/);
  await expect(page.locator('.overlay.title.on')).toBeVisible();
  await expect(page.getByRole('link', { name: '← Pocket Arcade' })).toBeVisible();
```

  (The trick-shot game is being built at the same time and will also add a card. Whoever merges
  second bumps the count. Note this in the hand-over.)

- [ ] **Step 4: README.** Under the games list, after the Paper Route bullet, add:

```markdown
- **Bluebird Run**: a sunny-day downhill snowboard score run (gates, kickers,
  spins and grabs), keyboard or iPhone touch, self-contained in `games/bluebird-run/`.
  `npm run dev:bluebird-run` opens it.
```

- [ ] **Step 5: Run the hub test and commit**

Run: `npx playwright test --project=hub`. Expected: PASS.

```bash
git add index.html public/hub/bluebird-run.png tests/e2e/hub.spec.ts README.md
git commit -m "feat: add the Bluebird Run card to the Pocket Arcade hub"
```

---

### Task 24: Final checks, spec deviations and hand-over

- [ ] **Step 1: Run every check** (make sure port 5199 is free first: `lsof -i :5199`)

```bash
npx tsc --noEmit
npm run coverage
npm run e2e
npm run build
```

Expected: tsc is clean. Coverage passes its 80% thresholds, and the bluebird-run sim, game and world
folders should each be at 90% or more (check the table). Every Playwright project passes (hub,
minigolf, paper-route, bluebird-run). The build emits `dist/games/bluebird-run/index.html`. If
anything fails, fix it in a `fix:` commit before going on.

- [ ] **Step 2: Record deviations.** Add a "§13 Slice as built" section to the spec. List anything
  that changed from the spec while building, such as course tuning, art substitutions, and the
  other riders no longer wobbling (already noted in §5). Commit it with
  `docs: record Bluebird Run slice deviations`.

- [ ] **Step 3: Hand-over note.** Write `bluebird-run-handover.md` in the shared notes folder
  (`/Users/nathanielleong/Library/Application Support/Claude/side-session-notes/local_b0705647-bf6c-4367-b3c7-dc27b184a40f/`)
  covering: the branch, the commit count, how to run it, the root touch points (vite input,
  package scripts, vitest coverage paths, the playwright project with `reuseExistingServer: false`,
  launch.json, the hub card, the hub test count and the README), PixelLab ids and how many
  generations were spent, the screenshot paths, and follow-ups (more slopes, ghost run, tilt
  steering, a hub e2e count clash with trick-shot).
