# Paper Route — Plan 1: One-Street Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable one-street slice of **Paper Route** (arcade game #2): a bike rolls up a sunny iso street, you toss papers at subscribers' porches and mailboxes, and you dodge cars, puddles, sprinklers and a dog. The slice runs from the title card to the end card, with PixelLab art behind a style-lock gate.

**Spec:** `docs/superpowers/specs/2026-11-10-paper-route-design.md`. Read it first; every number below comes from it.

**Architecture:** Everything lives under `games/paper-route/`: its own Vite entry `index.html`, `src/`, `assets/`, `scripts/` and `tests/`. Engine modules are **copied** from mini-golf's `src/`, never imported from it and never edited there.
- The simulation (`sim/`, `game/`, `world/`) is pure and immutable, and stepped by a fixed 60 Hz reducer.
- The renderer draws lazily baked 16-tile terrain chunks plus depth-sorted sprites into a 360×270 buffer. A post pass snaps the buffer to the palette and applies one fixed morning grade, then it is scaled up in whole pixels.

**Tech Stack:** TypeScript 5.9 (strict), Canvas 2D, Vite 6, Vitest 5, Playwright, Node 22, PixelLab MCP.

---

## Conventions for every task

- **Node 22:** prefix every node/npm/npx command with `export PATH=$HOME/.nvm/versions/node/v22.22.3/bin:$PATH &&`. The commands below leave the prefix out for brevity, but you must include it.
- **Working directory:** the repo (worktree) root. All paths below are relative to it.
- `PR` means `games/paper-route`. For example, `PR/src/sim/bike.ts` is `games/paper-route/src/sim/bike.ts`. Write the full path in files and commands.
- **Mini-golf is untouched:** never edit `src/`, `assets/`, `tests/` or `scripts/` at the root. The only root files this plan edits are `package.json`, `vitest.config.ts`, `tsconfig.json`, `playwright.config.ts`, `.gitignore`, and the new `vite.config.ts`.
- **Immutability:** sim and game functions return new objects. The only allowed in-place mutation is in per-frame pixel buffers and the chunk cache's `Map`, and both are commented where they happen.
- **Commits:** conventional format (`feat: …`, `test: …`, `chore: …`). End every commit message with a blank line and then `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Don't push and don't merge into `main`.**
- **After every task**, run `npx vitest run && npx tsc --noEmit`. Both must pass, including mini-golf's tests.

## File map

```
vite.config.ts                         NEW  multi-page build input (mini-golf + paper route)
package.json                           MOD  dev:paper-route, ingest:paper-route scripts
vitest.config.ts                       MOD  include games/*/tests/unit, coverage for PR sim/game/world
tsconfig.json                          MOD  include "games"
playwright.config.ts                   MOD  two projects (minigolf, paper-route)
.gitignore                             MOD  games/*/assets/raw/

games/paper-route/
  index.html                           Vite entry
  assets/palette.json                  "Maple Lane" 32 colours
  assets/manifest.json                 sprite defs (placeholders first, images after art)
  assets/rider.json                    rider sheet layout (written by ingest, Task 17)
  assets/sprites/*.png                 ingested PixelLab art
  scripts/ingest.ts                    PixelLab → palette-snapped sprites + manifest
  scripts/lib/sprite-tools.ts          copied from mini-golf
  src/main.ts                          boot + frame loop + wiring
  src/content.ts                       loads street, manifest, palette, sprites, rider
  src/style.css                        page = canvas backdrop colour; HUD styles
  src/core/geometry.ts                 copied
  src/core/loop.ts                     copied
  src/core/input.ts                    keyboard: held controls + edge actions
  src/world/street.ts                  Street types + parseStreet
  src/world/streets/maple-lane.json    the slice's street
  src/world/manifest.ts                sprite manifest parser (frames/fps, no lights)
  src/world/rider.ts                   rider sheet layout parser + facing
  src/sim/constants.ts                 every tunable number
  src/sim/bike.ts                      stepBike, slowDown, crash
  src/sim/paper.ts                     throwPaper, stepPaper, paperPos, hit tests
  src/sim/hazards.ts                   dog, sprinkler, car, puddle
  src/game/score.ts                    points, finish bonus, best score
  src/game/state.ts                    GameState, Action, reduce
  src/game/tick.ts                     one fixed sim step
  src/render/iso.ts                    projection + street mapping
  src/render/palette.ts                copied
  src/render/wind.ts                   copied (windStep only)
  src/render/dither.ts                 Bayer/noise helpers copied from terrain-bake
  src/render/post.ts                   palette snap + fixed morning grade
  src/render/street-bake.ts            per-pixel street ground, chunk bake
  src/render/camera.ts                 follow + snap
  src/render/chunks.ts                 visible chunks + cache
  src/render/assets.ts                 sprite loading, bake → canvases
  src/render/renderer.ts               draws one frame
  src/ui/hud.ts                        DOM HUD and overlays
  src/audio/sfx-math.ts                events → sounds (pure)
  src/audio/sfx.ts                     Web Audio sounds (no music, no ambience)
  tests/helpers/make-street.ts         raw street builder for tests
  tests/unit/*.test.ts
  tests/e2e/paper-route.spec.ts
```

---

### Task 1: Scaffold the game folder and root wiring

**Files:**
- Create: `games/paper-route/index.html`, `games/paper-route/src/main.ts`, `games/paper-route/src/style.css`, `vite.config.ts`
- Modify: `package.json`, `vitest.config.ts`, `tsconfig.json`, `playwright.config.ts`, `.gitignore`

- [ ] **Step 1: Create the Vite entry page**

`games/paper-route/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Paper Route</title>
  </head>
  <body>
    <div id="stage"><canvas id="game" width="360" height="270"></canvas></div>
    <div id="hud"></div>
    <script type="module" src="./src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create a stub boot and stylesheet**

`games/paper-route/src/main.ts` (replaced in Task 16):
```ts
import './style.css';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (ctx) {
  ctx.fillStyle = '#9fd8ee';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
```

`games/paper-route/src/style.css` (extended in Task 15):
```css
:root { --bg: #9fd8ee; --ink: #14141c; --muted: #4a4a5a; --accent: #c8463c; --panel: rgba(239, 230, 210, 0.9); }
* { box-sizing: border-box; }
html, body {
  margin: 0; height: 100%; overflow: hidden;
  background: var(--page, var(--bg)); color: var(--ink);
  font: 14px/1.4 ui-monospace, Menlo, Consolas, monospace;
}
#stage { position: fixed; inset: 0; display: grid; place-items: center; }
#game { display: block; image-rendering: pixelated; }
#hud { position: fixed; inset: 0; pointer-events: none; }
```

- [ ] **Step 3: Add the multi-page Vite config**

`vite.config.ts`:
```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const at = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: at('./index.html'),
        paperRoute: at('./games/paper-route/index.html'),
      },
    },
  },
});
```

- [ ] **Step 4: Wire the root configs**

`package.json` → add to `"scripts"` (keep every existing script):
```json
"dev:paper-route": "vite --open /games/paper-route/",
"ingest:paper-route": "vite-node games/paper-route/scripts/ingest.ts"
```

`vitest.config.ts` → replace the `include` and coverage `include` lines with:
```ts
    include: ['tests/unit/**/*.test.ts', 'games/*/tests/unit/**/*.test.ts'],
```
```ts
      include: ['src/physics/**', 'src/world/**', 'src/game/**', 'games/paper-route/src/sim/**', 'games/paper-route/src/game/**', 'games/paper-route/src/world/**'],
```

`tsconfig.json` → change `"include"` to:
```json
"include": ["src", "tests", "scripts", "games", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
```

`playwright.config.ts` → replace it entirely with:
```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5199' },
  projects: [
    { name: 'minigolf', testDir: 'tests/e2e' },
    { name: 'paper-route', testDir: 'games/paper-route/tests/e2e' },
  ],
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
  },
});
```

`.gitignore` → append the line `games/*/assets/raw/`.

- [ ] **Step 5: Verify that mini-golf still works and the new page builds**

Run: `npx vitest run && npx tsc --noEmit && npx vite build`
Expected:
- all of mini-golf's tests PASS
- no type errors
- the build output lists both `dist/index.html` and `dist/games/paper-route/index.html`

Run: `ls dist/games/paper-route/index.html`
Expected: the file exists.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts package.json vitest.config.ts tsconfig.json playwright.config.ts .gitignore games/paper-route
git commit -m "chore: scaffold the Paper Route game folder and multi-page build"
```

---

### Task 2: Copy the base engine modules

**Files:**
- Create (copies): `PR/src/core/geometry.ts`, `PR/src/core/loop.ts`, `PR/src/render/palette.ts`, `PR/scripts/lib/sprite-tools.ts`
- Create: `PR/src/render/wind.ts`, `PR/assets/palette.json`
- Test (copies): `PR/tests/unit/geometry.test.ts`, `PR/tests/unit/loop.test.ts`, `PR/tests/unit/palette.test.ts`, `PR/tests/unit/sprite-tools.test.ts`
- Test: `PR/tests/unit/wind.test.ts`

- [ ] **Step 1: Copy the modules and their tests verbatim**

```bash
P=games/paper-route
mkdir -p $P/src/core $P/src/render $P/scripts/lib $P/tests/unit $P/assets
cp src/core/geometry.ts src/core/loop.ts $P/src/core/
cp src/render/palette.ts $P/src/render/
cp scripts/lib/sprite-tools.ts $P/scripts/lib/
cp tests/unit/geometry.test.ts tests/unit/loop.test.ts tests/unit/palette.test.ts tests/unit/sprite-tools.test.ts $P/tests/unit/
```
The relative imports in these files (`../../src/...`, `../../assets/palette.json`, `../../scripts/lib/...`) resolve to the same layout inside `games/paper-route/`, so they need no edits.

- [ ] **Step 2: Create the Maple Lane palette**

This is Backyard's 32 colours with its two night purples swapped for concrete greys.

`games/paper-route/assets/palette.json`:
```json
{
  "name": "Maple Lane",
  "colors": [
    "#14141c", "#2c2c3a", "#4a4a5a", "#8a8a96", "#b8b8c4",
    "#1f3a2c", "#2f5530", "#3f6b3a", "#5e8c45", "#8db35a", "#b9cf6e",
    "#4f8a4c", "#6fae5c", "#8fca6c", "#b5e08a",
    "#2e2420", "#4a3b2e", "#6b4f3a", "#8a6a4a", "#b08a62", "#d9c08c", "#efe6d2", "#fffaf0",
    "#1d3b5c", "#2f6f9a", "#5aa7d0", "#9fd8ee",
    "#7a2e2e", "#c8463c", "#e98a52", "#f2c25b", "#e7b98f"
  ]
}
```

In `PR/tests/unit/palette.test.ts`, change the test title `'loads the 32-colour Backyard palette'` to `'loads the 32-colour Maple Lane palette'`. Leave the assertions as they are.

- [ ] **Step 3: Write the wind test**

`games/paper-route/tests/unit/wind.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { WIND_FPS, windStep } from '../../src/render/wind';

describe('windStep', () => {
  it('alternates 0 and 1 at WIND_FPS', () => {
    expect(windStep(0)).toBe(0);
    expect(windStep(1 / WIND_FPS)).toBe(1);
    expect(windStep(2 / WIND_FPS)).toBe(0);
  });
  it('never goes negative', () => {
    expect(windStep(-0.01)).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 4: Run the wind test to see it fail**

Run: `npx vitest run games/paper-route/tests/unit/wind.test.ts`
Expected: FAIL, because `../../src/render/wind` can't be resolved.

- [ ] **Step 5: Create the wind module**

This is mini-golf's `windStep` without `swayOffset`, which the slice doesn't use.

`games/paper-route/src/render/wind.ts`:
```ts
/** The wind ticks at 8 steps a second on purpose: it should feel hand-animated, not simulated. */
export const WIND_FPS = 8;

export function windStep(time: number): number {
  return ((Math.floor(time * WIND_FPS) % 2) + 2) % 2;
}
```

- [ ] **Step 6: Run all tests**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. The copied geometry, loop, palette and sprite-tools tests now also run under `games/paper-route`.

- [ ] **Step 7: Commit**

```bash
git add games/paper-route
git commit -m "feat: copy base engine modules and the Maple Lane palette into Paper Route"
```

---

### Task 3: Iso projection with street coordinates

**Files:**
- Create: `PR/src/render/iso.ts`
- Test: `PR/tests/unit/iso.test.ts`

- [ ] **Step 1: Write the failing test**

`games/paper-route/tests/unit/iso.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { depthOf, fromGrid, ORIGIN, project, sortByDepth, streetPx, toGrid, unproject } from '../../src/render/iso';

describe('projection', () => {
  it('round-trips through unproject', () => {
    const v = { ox: 40, oy: -12 };
    const [sx, sy] = project(v, 3.25, 7.5, 0.5);
    const [x, y] = unproject(v, sx, sy, 0.5);
    expect(x).toBeCloseTo(3.25);
    expect(y).toBeCloseTo(7.5);
  });
});

describe('street mapping', () => {
  it('maps [c, s] to grid [c, length - s] and back', () => {
    expect(toGrid(100, 7, 10)).toEqual([7, 90]);
    expect(fromGrid(100, 7, 90)).toEqual([7, 10]);
  });
  it('riding forward (s up) moves up-right on screen', () => {
    const a = streetPx(ORIGIN, 100, 7, 10);
    const b = streetPx(ORIGIN, 100, 7, 11);
    expect([b[0] - a[0], b[1] - a[1]]).toEqual([16, -8]);
  });
  it('moving right (c up) moves down-right on screen', () => {
    const a = streetPx(ORIGIN, 100, 7, 10);
    const b = streetPx(ORIGIN, 100, 8, 10);
    expect([b[0] - a[0], b[1] - a[1]]).toEqual([16, 8]);
  });
  it('lifts by 16 px per tile of height', () => {
    expect(streetPx(ORIGIN, 100, 7, 10, 1)[1]).toBe(streetPx(ORIGIN, 100, 7, 10)[1] - 16);
  });
});

describe('depth', () => {
  it('is larger (nearer the viewer) for smaller s and larger c', () => {
    expect(depthOf(100, 7, 10)).toBeGreaterThan(depthOf(100, 7, 20));
    expect(depthOf(100, 9, 10)).toBeGreaterThan(depthOf(100, 7, 10));
  });
  it('sorts far to near without mutating the input', () => {
    const items = [{ depth: 3 }, { depth: 1 }, { depth: 2 }];
    expect(sortByDepth(items).map((i) => i.depth)).toEqual([1, 2, 3]);
    expect(items.map((i) => i.depth)).toEqual([3, 1, 2]);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run games/paper-route/tests/unit/iso.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`games/paper-route/src/render/iso.ts`:
```ts
import type { Vec2 } from '../core/geometry';

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

/**
 * Street point [c, s] → grid [x, y]: c (across) is grid x, s (along, from the start) runs against
 * grid y, so riding forward moves up-right on screen.
 */
export const toGrid = (length: number, c: number, s: number): Vec2 => [c, length - s];
export const fromGrid = (length: number, x: number, y: number): Vec2 => [x, length - y];

export function streetPx(v: View, length: number, c: number, s: number, z = 0): Vec2 {
  return project(v, c, length - s, z);
}

/** Larger depth = closer to the viewer = drawn later. */
export function depthOf(length: number, c: number, s: number): number {
  return c + (length - s);
}

export function sortByDepth<T extends { readonly depth: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.depth - b.depth);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run games/paper-route/tests/unit/iso.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/paper-route/src/render/iso.ts games/paper-route/tests/unit/iso.test.ts
git commit -m "feat: add Paper Route iso projection with street coordinates"
```

---

### Task 4: Street data, loader and Maple Lane

**Files:**
- Create: `PR/src/world/street.ts`, `PR/src/world/streets/maple-lane.json`
- Test: `PR/tests/helpers/make-street.ts`, `PR/tests/unit/street.test.ts`

- [ ] **Step 1: Write the test helper**

`games/paper-route/tests/helpers/make-street.ts`:
```ts
/** A small valid raw street (one lot per side, one dog); override any top-level field. */
export function rawStreet(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Test Lane',
    length: 40,
    lots: [
      { side: 'L', s: 5, house: 'house-a', subscriber: true, porch: [1.5, 3, 2, 4], mailbox: [3.6, 5] },
      { side: 'R', s: 5, house: 'house-b', subscriber: false, porch: [0.5, 3, 2, 4], mailbox: [0.4, 5] },
    ],
    props: [{ kind: 'tree', at: [0.6, 20] }],
    hazards: [{ kind: 'dog', home: [12, 30] }],
    bundles: [[7, 25]],
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing tests**

`games/paper-route/tests/unit/street.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import mapleLane from '../../src/world/streets/maple-lane.json';
import { inRect, lotOriginC, parseStreet, StreetError } from '../../src/world/street';
import { rawStreet } from '../helpers/make-street';

const lot = (o: Record<string, unknown>) => ({ side: 'L', s: 5, house: 'house-a', subscriber: true, porch: [1.5, 3, 2, 4], mailbox: [3.6, 5], ...o });

describe('parseStreet', () => {
  it('parses a valid street and makes lot geometry absolute', () => {
    const st = parseStreet(rawStreet());
    expect(st.name).toBe('Test Lane');
    expect(st.length).toBe(40);
    expect(st.lots[0]).toMatchObject({ index: 0, side: 'L', porch: { c0: 1.5, s0: 8, c1: 3.5, s1: 12 }, mailbox: [3.6, 10] });
    expect(st.lots[1]).toMatchObject({ index: 1, side: 'R', porch: { c0: 10.5, s0: 8, c1: 12.5, s1: 12 }, mailbox: [10.4, 10] });
    expect(st.dogHome).toEqual([12, 30]);
    expect(st.hazards).toEqual([]);
    expect(st.bundles).toEqual([[7, 25]]);
    expect(st.props).toEqual([{ kind: 'tree', at: [0.6, 20] }]);
  });
  it('parses cars, puddles and sprinklers', () => {
    const st = parseStreet(rawStreet({
      hazards: [
        { kind: 'car', at: [5.6, 20] },
        { kind: 'puddle', at: [7, 22] },
        { kind: 'sprinkler', at: [2, 30], spray: [3.5, 28, 5.5, 33] },
        { kind: 'dog', home: [12, 30] },
      ],
    }));
    expect(st.hazards).toEqual([
      { kind: 'car', at: [5.6, 20] },
      { kind: 'puddle', at: [7, 22] },
      { kind: 'sprinkler', at: [2, 30], spray: { c0: 3.5, s0: 28, c1: 5.5, s1: 33 } },
    ]);
  });
  it.each([
    ['not an object', 42, /must be an object/],
    ['no name', rawStreet({ name: '' }), /name/],
    ['too short', rawStreet({ length: 5 }), /length/],
    ['bad side', rawStreet({ lots: [lot({ side: 'X' })] }), /lots\[0\]\.side/],
    ['lot past the end', rawStreet({ lots: [lot({ s: 35 })] }), /lots\[0\]\.s/],
    ['bad house name', rawStreet({ lots: [lot({ house: 'House A' })] }), /lots\[0\]\.house/],
    ['porch outside the lot', rawStreet({ lots: [lot({ porch: [3, 3, 2, 4] })] }), /lots\[0\]\.porch/],
    ['mailbox outside the lot', rawStreet({ lots: [lot({ mailbox: [5, 5] })] }), /lots\[0\]\.mailbox/],
    ['overlapping lots', rawStreet({ lots: [lot({}), lot({ s: 10 })] }), /lots 0 and 1 overlap/],
    ['unknown hazard', rawStreet({ hazards: [{ kind: 'ufo', at: [1, 1] }, { kind: 'dog', home: [12, 30] }] }), /hazards\[0\]\.kind/],
    ['no dog', rawStreet({ hazards: [] }), /exactly one dog \(found 0\)/],
    ['two dogs', rawStreet({ hazards: [{ kind: 'dog', home: [12, 30] }, { kind: 'dog', home: [12, 20] }] }), /exactly one dog \(found 2\)/],
    ['bundle off the street', rawStreet({ bundles: [[20, 5]] }), /bundles\[0\].*outside the street/],
  ])('rejects %s', (_label, raw, message) => {
    expect(() => parseStreet(raw)).toThrow(StreetError);
    expect(() => parseStreet(raw)).toThrow(message);
  });
});

describe('helpers', () => {
  it('puts lot origins at the outer lawn edges', () => {
    expect(lotOriginC('L')).toBe(0);
    expect(lotOriginC('R')).toBe(10);
  });
  it('tests rectangles inclusively', () => {
    const r = { c0: 1, s0: 2, c1: 3, s1: 4 };
    expect(inRect(r, 1, 2)).toBe(true);
    expect(inRect(r, 3, 4)).toBe(true);
    expect(inRect(r, 3.1, 3)).toBe(false);
  });
});

describe('Maple Lane', () => {
  it('is a valid 140-tile street with 24 houses, 16 of them subscribers', () => {
    const st = parseStreet(mapleLane);
    expect(st.length).toBe(140);
    expect(st.lots).toHaveLength(24);
    expect(st.lots.filter((l) => l.subscriber)).toHaveLength(16);
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run games/paper-route/tests/unit/street.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement the street module**

`games/paper-route/src/world/street.ts`:
```ts
import type { Vec2 } from '../core/geometry';

export const STREET_WIDTH = 14;
export const LAWN_WIDTH = 4;
export const LOT_LENGTH = 10;
/** Across-street layout in tiles of c (see spec §4). */
export const STRIPS = { lawnL: [0, 4], walkL: [4, 5], road: [5, 9], walkR: [9, 10], lawnR: [10, 14] } as const;

export type Side = 'L' | 'R';

/** Inclusive axis-aligned rectangle in street coordinates. */
export interface Rect {
  readonly c0: number;
  readonly s0: number;
  readonly c1: number;
  readonly s1: number;
}

export interface Lot {
  readonly index: number;
  readonly side: Side;
  readonly s: number;
  readonly house: string;
  readonly subscriber: boolean;
  /** Absolute. */
  readonly porch: Rect;
  /** Absolute [c, s]. */
  readonly mailbox: Vec2;
}

export interface Prop {
  readonly kind: string;
  readonly at: Vec2;
}

export type Hazard =
  | { readonly kind: 'car'; readonly at: Vec2 }
  | { readonly kind: 'puddle'; readonly at: Vec2 }
  | { readonly kind: 'sprinkler'; readonly at: Vec2; readonly spray: Rect };

export interface Street {
  readonly name: string;
  readonly length: number;
  readonly lots: readonly Lot[];
  readonly props: readonly Prop[];
  /** Cars, puddles and sprinklers. The dog is separate. */
  readonly hazards: readonly Hazard[];
  readonly dogHome: Vec2;
  readonly bundles: readonly Vec2[];
}

export class StreetError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const NAME = /^[a-z0-9-]+$/;
const MIN_LENGTH = 20;

export const lotOriginC = (side: Side): number => (side === 'L' ? 0 : STREET_WIDTH - LAWN_WIDTH);

export const inRect = (r: Rect, c: number, s: number): boolean => c >= r.c0 && c <= r.c1 && s >= r.s0 && s <= r.s1;

function nums(v: unknown, n: number, field: string): number[] {
  if (!Array.isArray(v) || v.length !== n || !v.every(isNum)) throw new StreetError(`street: ${field} must be ${n} numbers`);
  return v as number[];
}

function point(v: unknown, field: string, length: number): Vec2 {
  const [c, s] = nums(v, 2, field);
  if (c < 0 || c > STREET_WIDTH || s < 0 || s > length) throw new StreetError(`street: ${field} [${c}, ${s}] is outside the street`);
  return [c, s];
}

function rect(v: unknown, field: string): Rect {
  const [c0, s0, c1, s1] = nums(v, 4, field);
  if (c1 <= c0 || s1 <= s0) throw new StreetError(`street: ${field} must have c1 > c0 and s1 > s0`);
  return { c0, s0, c1, s1 };
}

function parseLot(raw: unknown, index: number, length: number): Lot {
  const f = `lots[${index}]`;
  if (!isObj(raw)) throw new StreetError(`street: ${f} must be an object`);
  if (raw.side !== 'L' && raw.side !== 'R') throw new StreetError(`street: ${f}.side must be "L" or "R"`);
  if (!isNum(raw.s) || raw.s < 0 || raw.s + LOT_LENGTH > length) throw new StreetError(`street: ${f}.s must leave a whole lot inside the street`);
  if (typeof raw.house !== 'string' || !NAME.test(raw.house)) throw new StreetError(`street: ${f}.house must be a sprite name`);
  if (typeof raw.subscriber !== 'boolean') throw new StreetError(`street: ${f}.subscriber must be true or false`);
  const oc = lotOriginC(raw.side);
  const lawn: Rect = { c0: oc, s0: raw.s, c1: oc + LAWN_WIDTH, s1: raw.s + LOT_LENGTH };
  const [pc, ps, pw, ph] = nums(raw.porch, 4, `${f}.porch`);
  const porch: Rect = { c0: oc + pc, s0: raw.s + ps, c1: oc + pc + pw, s1: raw.s + ps + ph };
  if (pw <= 0 || ph <= 0 || !inRect(lawn, porch.c0, porch.s0) || !inRect(lawn, porch.c1, porch.s1)) {
    throw new StreetError(`street: ${f}.porch must be a positive rectangle inside the lot`);
  }
  const [mc, ms] = nums(raw.mailbox, 2, `${f}.mailbox`);
  const mailbox: Vec2 = [oc + mc, raw.s + ms];
  if (!inRect(lawn, mailbox[0], mailbox[1])) throw new StreetError(`street: ${f}.mailbox must be inside the lot`);
  return { index, side: raw.side, s: raw.s, house: raw.house, subscriber: raw.subscriber, porch, mailbox };
}

function checkOverlaps(lots: readonly Lot[]): void {
  for (const side of ['L', 'R'] as const) {
    const row = lots.filter((l) => l.side === side).sort((a, b) => a.s - b.s);
    for (let i = 1; i < row.length; i++) {
      if (row[i].s - row[i - 1].s < LOT_LENGTH) throw new StreetError(`street: lots ${row[i - 1].index} and ${row[i].index} overlap`);
    }
  }
}

function parseHazards(raw: unknown, length: number): { hazards: Hazard[]; dogHome: Vec2 } {
  if (!Array.isArray(raw)) throw new StreetError('street: hazards must be an array');
  const hazards: Hazard[] = [];
  const dogs: Vec2[] = [];
  raw.forEach((h, i) => {
    const f = `hazards[${i}]`;
    if (!isObj(h)) throw new StreetError(`street: ${f} must be an object`);
    if (h.kind === 'dog') dogs.push(point(h.home, `${f}.home`, length));
    else if (h.kind === 'car' || h.kind === 'puddle') hazards.push({ kind: h.kind, at: point(h.at, `${f}.at`, length) });
    else if (h.kind === 'sprinkler') hazards.push({ kind: 'sprinkler', at: point(h.at, `${f}.at`, length), spray: rect(h.spray, `${f}.spray`) });
    else throw new StreetError(`street: ${f}.kind must be car, puddle, sprinkler or dog`);
  });
  if (dogs.length !== 1) throw new StreetError(`street: needs exactly one dog (found ${dogs.length})`);
  return { hazards, dogHome: dogs[0] };
}

function parseProps(raw: unknown, length: number): Prop[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new StreetError('street: props must be an array');
  return raw.map((p, i) => {
    if (!isObj(p) || typeof p.kind !== 'string' || !NAME.test(p.kind)) throw new StreetError(`street: props[${i}].kind must be a sprite name`);
    return { kind: p.kind, at: point(p.at, `props[${i}].at`, length) };
  });
}

function parseBundles(raw: unknown, length: number): Vec2[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new StreetError('street: bundles must be an array');
  return raw.map((b, i) => point(b, `bundles[${i}]`, length));
}

/** Validates raw street JSON. Throws a StreetError naming the bad field. */
export function parseStreet(raw: unknown): Street {
  if (!isObj(raw)) throw new StreetError('street: must be an object');
  if (typeof raw.name !== 'string' || raw.name.length === 0) throw new StreetError('street: name must be a non-empty string');
  if (!isNum(raw.length) || raw.length < MIN_LENGTH) throw new StreetError(`street: length must be a number of at least ${MIN_LENGTH}`);
  const length = raw.length;
  if (!Array.isArray(raw.lots)) throw new StreetError('street: lots must be an array');
  const lots = raw.lots.map((l, i) => parseLot(l, i, length));
  checkOverlaps(lots);
  const { hazards, dogHome } = parseHazards(raw.hazards, length);
  return Object.freeze({
    name: raw.name, length, lots, props: parseProps(raw.props, length), hazards, dogHome, bundles: parseBundles(raw.bundles, length),
  });
}
```

- [ ] **Step 5: Create Maple Lane**

The street has 12 lots per side at `s = 12, 22, …, 122`. Houses cycle through a/b/c. Subscribers: L = T T F T T T F T T F T T (9), R = T F T T F T T F T F T F (7), 16 in total.

`games/paper-route/src/world/streets/maple-lane.json`:
```json
{
  "name": "Maple Lane",
  "length": 140,
  "lots": [
    { "side": "L", "s": 12,  "house": "house-a", "subscriber": true,  "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 22,  "house": "house-b", "subscriber": true,  "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 32,  "house": "house-c", "subscriber": false, "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 42,  "house": "house-a", "subscriber": true,  "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 52,  "house": "house-b", "subscriber": true,  "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 62,  "house": "house-c", "subscriber": true,  "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 72,  "house": "house-a", "subscriber": false, "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 82,  "house": "house-b", "subscriber": true,  "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 92,  "house": "house-c", "subscriber": true,  "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 102, "house": "house-a", "subscriber": false, "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 112, "house": "house-b", "subscriber": true,  "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "L", "s": 122, "house": "house-c", "subscriber": true,  "porch": [1.5, 3, 2, 4], "mailbox": [3.6, 5] },
    { "side": "R", "s": 12,  "house": "house-b", "subscriber": true,  "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 22,  "house": "house-c", "subscriber": false, "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 32,  "house": "house-a", "subscriber": true,  "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 42,  "house": "house-b", "subscriber": true,  "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 52,  "house": "house-c", "subscriber": false, "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 62,  "house": "house-a", "subscriber": true,  "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 72,  "house": "house-b", "subscriber": true,  "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 82,  "house": "house-c", "subscriber": false, "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 92,  "house": "house-a", "subscriber": true,  "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 102, "house": "house-b", "subscriber": false, "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 112, "house": "house-c", "subscriber": true,  "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] },
    { "side": "R", "s": 122, "house": "house-a", "subscriber": false, "porch": [0.5, 3, 2, 4], "mailbox": [0.4, 5] }
  ],
  "props": [
    { "kind": "tree",  "at": [0.6, 21.5] },
    { "kind": "hedge", "at": [13.4, 31.5] },
    { "kind": "tree",  "at": [0.6, 51.5] },
    { "kind": "tree",  "at": [13.4, 61.5] },
    { "kind": "hedge", "at": [0.6, 81.5] },
    { "kind": "tree",  "at": [13.4, 91.5] },
    { "kind": "tree",  "at": [0.6, 111.5] },
    { "kind": "hedge", "at": [13.4, 121.5] }
  ],
  "hazards": [
    { "kind": "car", "at": [5.6, 30] },
    { "kind": "puddle", "at": [7, 45] },
    { "kind": "car", "at": [8.4, 58] },
    { "kind": "sprinkler", "at": [2, 66], "spray": [3.5, 64, 5.5, 69] },
    { "kind": "puddle", "at": [6, 80] },
    { "kind": "dog", "home": [12, 88] },
    { "kind": "car", "at": [5.6, 96] },
    { "kind": "sprinkler", "at": [12, 104], "spray": [8.5, 102, 10.5, 107] },
    { "kind": "puddle", "at": [8, 112] },
    { "kind": "car", "at": [8.4, 120] }
  ],
  "bundles": [[7, 40], [6.5, 75], [7.5, 108]]
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run games/paper-route/tests/unit/street.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add games/paper-route/src/world games/paper-route/tests
git commit -m "feat: add the street loader and the Maple Lane street"
```

---

### Task 5: Sprite manifest and rider layout

**Files:**
- Create: `PR/src/world/manifest.ts`, `PR/src/world/rider.ts`, `PR/assets/manifest.json`
- Test: `PR/tests/unit/manifest.test.ts`, `PR/tests/unit/rider.test.ts`

- [ ] **Step 1: Write the failing tests**

`games/paper-route/tests/unit/manifest.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/manifest.json';
import { ManifestError, parseManifest } from '../../src/world/manifest';

describe('parseManifest', () => {
  it('parses placeholders and images, defaulting frames to 1 and fps to 8', () => {
    const m = parseManifest({
      a: { placeholder: { color: '#ff0000', w: 4, h: 6 } },
      b: { image: { src: 'b.png', anchor: [3, 7] } },
      c: { image: { src: 'c.png', anchor: [2, 3], frames: 4, fps: 12 } },
    });
    expect(m.a.placeholder).toEqual({ color: '#ff0000', w: 4, h: 6 });
    expect(m.b.image).toEqual({ src: 'b.png', anchor: [3, 7], frames: 1, fps: 8 });
    expect(m.c.image).toEqual({ src: 'c.png', anchor: [2, 3], frames: 4, fps: 12 });
  });
  it.each([
    ['a non-object', 3, /must be an object/],
    ['an empty def', { a: {} }, /a needs an image or a placeholder/],
    ['a bad placeholder', { a: { placeholder: { color: '#f00' } } }, /a\.placeholder/],
    ['a path in src', { a: { image: { src: '../x.png', anchor: [0, 0] } } }, /a\.image/],
    ['zero frames', { a: { image: { src: 'a.png', anchor: [0, 0], frames: 0 } } }, /a\.image\.frames/],
  ])('rejects %s', (_l, raw, msg) => {
    expect(() => parseManifest(raw)).toThrow(ManifestError);
    expect(() => parseManifest(raw)).toThrow(msg);
  });
  it('parses the game manifest, which has every sprite the street and renderer use', () => {
    const m = parseManifest(manifestJson);
    for (const name of ['house-a-l', 'house-a-r', 'house-b-l', 'house-b-r', 'house-c-l', 'house-c-r', 'mailbox-sub', 'mailbox-plain', 'tree', 'hedge', 'car', 'puddle',
      'sprinkler', 'spray', 'bundle', 'dog-run', 'dog-sit', 'paper']) {
      expect(m[name], name).toBeDefined();
    }
  });
});
```

`games/paper-route/tests/unit/rider.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DIRS, parseRider, RiderError, riderDir } from '../../src/world/rider';

const rows = Object.fromEntries(DIRS.map((d, i) => [d, i]));

describe('parseRider', () => {
  it('parses a layout', () => {
    expect(parseRider({ src: 'rider.png', cell: [34, 36], anchor: [17, 35], frames: 6, fps: 10, rows })).toEqual({
      src: 'rider.png', cell: [34, 36], anchor: [17, 35], frames: 6, fps: 10, rows,
    });
  });
  it.each([
    ['a bad src', { src: 'x.gif', cell: [1, 1], anchor: [0, 0], frames: 1, fps: 1, rows }, /src/],
    ['a bad cell', { src: 'r.png', cell: [0, 1], anchor: [0, 0], frames: 1, fps: 1, rows }, /cell/],
    ['a missing row', { src: 'r.png', cell: [1, 1], anchor: [0, 0], frames: 1, fps: 1, rows: { south: 0 } }, /rows\./],
  ])('rejects %s', (_l, raw, msg) => {
    expect(() => parseRider(raw)).toThrow(RiderError);
    expect(() => parseRider(raw)).toThrow(msg);
  });
});

describe('riderDir', () => {
  it('faces up-right when riding straight and leans with the steering', () => {
    expect(riderDir(0)).toBe('north-east');
    expect(riderDir(-1)).toBe('north');
    expect(riderDir(1)).toBe('east');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run games/paper-route/tests/unit/manifest.test.ts games/paper-route/tests/unit/rider.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the manifest**

`games/paper-route/src/world/manifest.ts`:
```ts
export interface Placeholder {
  readonly color: string;
  readonly w: number;
  readonly h: number;
}

export interface SpriteImage {
  /** File name inside assets/sprites/. */
  readonly src: string;
  /** Pixel inside one frame that sits on the sprite's ground point. */
  readonly anchor: readonly [number, number];
  /** Frames laid out left to right in equal-width cells. */
  readonly frames: number;
  readonly fps: number;
}

export interface SpriteDef {
  readonly placeholder?: Placeholder;
  readonly image?: SpriteImage;
}

export type Manifest = Readonly<Record<string, SpriteDef>>;

export class ManifestError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPosNum = (v: unknown): v is number => isNum(v) && v > 0;
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const FILE = /^[a-z0-9-]+\.png$/;

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
  const frames = raw.frames ?? 1;
  const fps = raw.fps ?? 8;
  if (!isPosInt(frames)) throw new ManifestError(`manifest: ${name}.image.frames must be a positive whole number`);
  if (!isPosNum(fps)) throw new ManifestError(`manifest: ${name}.image.fps must be positive`);
  return { src: raw.src, anchor: [a[0], a[1]], frames, fps };
}

function parseDef(name: string, raw: unknown): SpriteDef {
  const d = isObj(raw) ? raw : {};
  const def: SpriteDef = { placeholder: parsePlaceholder(name, d.placeholder), image: parseImage(name, d.image) };
  if (!def.image && !def.placeholder) throw new ManifestError(`manifest: ${name} needs an image or a placeholder`);
  return def;
}

export function parseManifest(raw: unknown): Manifest {
  if (!isObj(raw)) throw new ManifestError('manifest: must be an object of sprite definitions');
  return Object.freeze(Object.fromEntries(Object.entries(raw).map(([name, def]) => [name, parseDef(name, def)])));
}
```

- [ ] **Step 4: Implement the rider layout**

`games/paper-route/src/world/rider.ts`:
```ts
export const DIRS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'] as const;
export type Dir = (typeof DIRS)[number];

export interface RiderLayout {
  /** File name inside assets/sprites/. */
  readonly src: string;
  readonly cell: readonly [number, number];
  readonly anchor: readonly [number, number];
  readonly frames: number;
  readonly fps: number;
  /** Sheet row for each facing direction. */
  readonly rows: Readonly<Record<Dir, number>>;
}

export class RiderError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isNatural = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function pair(v: unknown, field: string, ok: (n: unknown) => boolean): readonly [number, number] {
  if (Array.isArray(v) && v.length === 2 && v.every(ok)) return [v[0] as number, v[1] as number];
  throw new RiderError(`rider: ${field} must be a pair of valid numbers`);
}

export function parseRider(raw: unknown): RiderLayout {
  if (!isObj(raw)) throw new RiderError('rider: must be an object');
  if (typeof raw.src !== 'string' || !/^[a-z0-9-]+\.png$/.test(raw.src)) throw new RiderError('rider: src must be a .png file name');
  if (!isPosInt(raw.frames) || !isPosInt(raw.fps)) throw new RiderError('rider: frames and fps must be positive whole numbers');
  const rows = isObj(raw.rows) ? raw.rows : {};
  return {
    src: raw.src,
    cell: pair(raw.cell, 'cell', isPosInt),
    anchor: pair(raw.anchor, 'anchor', isNatural),
    frames: raw.frames,
    fps: raw.fps,
    rows: Object.fromEntries(DIRS.map((d) => {
      if (!isNatural(rows[d])) throw new RiderError(`rider: rows.${d} must be a row number`);
      return [d, rows[d] as number];
    })) as Record<Dir, number>,
  };
}

/** Riding straight faces up-right (north-east); steering leans toward north (left) or east (right). */
export function riderDir(lean: -1 | 0 | 1): Dir {
  if (lean < 0) return 'north';
  if (lean > 0) return 'east';
  return 'north-east';
}
```

- [ ] **Step 5: Create the placeholder manifest**

Each house has two sprites. `-l` is used on the left side, with its front facing down-right toward the street. `-r` is used on the right side, with its front facing up-left toward the street, so the viewer sees its back. The renderer picks `${lot.house}-l` or `${lot.house}-r` by side.

`games/paper-route/assets/manifest.json`:
```json
{
  "house-a-l": { "placeholder": { "color": "#e98a52", "w": 40, "h": 36 } },
  "house-a-r": { "placeholder": { "color": "#e98a52", "w": 40, "h": 36 } },
  "house-b-l": { "placeholder": { "color": "#5aa7d0", "w": 40, "h": 36 } },
  "house-b-r": { "placeholder": { "color": "#5aa7d0", "w": 40, "h": 36 } },
  "house-c-l": { "placeholder": { "color": "#f2c25b", "w": 40, "h": 36 } },
  "house-c-r": { "placeholder": { "color": "#f2c25b", "w": 40, "h": 36 } },
  "mailbox-sub": { "placeholder": { "color": "#c8463c", "w": 4, "h": 9 } },
  "mailbox-plain": { "placeholder": { "color": "#8a8a96", "w": 4, "h": 9 } },
  "tree": { "placeholder": { "color": "#2f5530", "w": 16, "h": 30 } },
  "hedge": { "placeholder": { "color": "#3f6b3a", "w": 18, "h": 10 } },
  "car": { "placeholder": { "color": "#2f6f9a", "w": 28, "h": 18 } },
  "puddle": { "placeholder": { "color": "#5aa7d0", "w": 16, "h": 5 } },
  "sprinkler": { "placeholder": { "color": "#4a4a5a", "w": 3, "h": 4 } },
  "spray": { "placeholder": { "color": "#9fd8ee", "w": 22, "h": 12 } },
  "bundle": { "placeholder": { "color": "#efe6d2", "w": 8, "h": 6 } },
  "dog-run": { "placeholder": { "color": "#8a6a4a", "w": 12, "h": 9 } },
  "dog-sit": { "placeholder": { "color": "#8a6a4a", "w": 9, "h": 10 } },
  "paper": { "placeholder": { "color": "#fffaf0", "w": 5, "h": 3 } }
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx vitest run games/paper-route/tests/unit/manifest.test.ts games/paper-route/tests/unit/rider.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add games/paper-route
git commit -m "feat: add the sprite manifest, the rider layout and placeholder sprites"
```

---
### Task 6: Constants and the bike

**Files:**
- Create: `PR/src/sim/constants.ts`, `PR/src/sim/bike.ts`
- Test: `PR/tests/unit/bike.test.ts`

- [ ] **Step 1: Create the constants**

There is no test of its own for this file; the bike and paper tests exercise it.

`games/paper-route/src/sim/constants.ts`:
```ts
/** Every tunable number for the slice (spec §5). Distances in tiles, times in seconds. */

/** Fixed simulation step. */
export const STEP = 1 / 60;

export const SPEED = { min: 2, cruise: 3, max: 4.5 } as const;
/** Tiles/s² toward the target speed. */
export const ACCEL = 3;
/** Sideways drift speed. */
export const DRIFT = 4;
/** The bike stays on the sidewalks and road. */
export const RIDE_C: readonly [number, number] = [4.3, 9.7];
export const START = { c: 7, s: 2 } as const;
export const BIKE_R = 0.3;

export const PAPERS = { start: 10, max: 15, bundle: 5 } as const;
export const BUNDLE_R = 0.5;

/** Flight lands `reach` tiles to the side after `flight` s; h(t) = h0 + vz·t − gravity·t²/2 hits 0 at t = flight. */
export const TOSS = { cooldown: 0.35, reach: 3.5, flight: 0.6, h0: 0.9, vz: 3.737, gravity: 17.46 } as const;
export const MAILBOX = { r: 0.35, top: 1 } as const;

export const PUDDLE = { r: 0.6, slowTime: 1 } as const;
export const SLOW_SPEED = 2;
export const SPRINKLER = { on: 1.5, off: 1.5, slowTime: 0.5 } as const;
/** Parked cars lie along the street: half-size across (c) and along (s). */
export const CAR_HALF: readonly [number, number] = [0.6, 1.1];
export const DOG = { trigger: 6, speed: 3.8, chaseTime: 4, homeSpeed: 2, r: 0.35, treatR: 0.6 } as const;
export const CRASH = { helmets: 3, wobble: 1.2, invuln: 1.5, wobbleSpeed: 1.5 } as const;

export const POINTS = { porch: 250, mailbox: 500, wrong: -100, dog: 50, perfect: 2000, paperLeft: 25 } as const;
/** The run finishes this far before the end of the street. */
export const FINISH_MARGIN = 4;
```

- [ ] **Step 2: Write the failing bike test**

`games/paper-route/tests/unit/bike.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { canCrash, crash, newBike, NO_CONTROLS, slowDown, stepBike, type Bike, type Controls } from '../../src/sim/bike';
import { CRASH, RIDE_C, SPEED, START, STEP } from '../../src/sim/constants';

function ride(b: Bike, ctl: Controls, seconds: number): Bike {
  let out = b;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = stepBike(out, ctl, STEP);
  return out;
}

describe('bike', () => {
  it('starts at the start line at cruise speed', () => {
    expect(newBike()).toEqual({ c: START.c, s: START.s, speed: SPEED.cruise, lean: 0, slow: 0, wobble: 0, invuln: 0 });
  });
  it('rolls forward on its own at cruise speed', () => {
    const b = ride(newBike(), NO_CONTROLS, 1);
    expect(b.s).toBeCloseTo(START.s + SPEED.cruise, 5);
    expect(b.c).toBe(START.c);
  });
  it('speeds up and brakes smoothly', () => {
    expect(ride(newBike(), { steer: 0, pedal: 1 }, 0.25).speed).toBeCloseTo(3.75, 5);
    expect(ride(newBike(), { steer: 0, pedal: 1 }, 2).speed).toBe(SPEED.max);
    expect(ride(newBike(), { steer: 0, pedal: -1 }, 2).speed).toBe(SPEED.min);
  });
  it('drifts across, leans, and stays on the sidewalks and road', () => {
    const b = ride(newBike(), { steer: 1, pedal: 0 }, 0.5);
    expect(b.c).toBeCloseTo(START.c + 2, 5);
    expect(b.lean).toBe(1);
    expect(ride(newBike(), { steer: 1, pedal: 0 }, 5).c).toBe(RIDE_C[1]);
    expect(ride(newBike(), { steer: -1, pedal: 0 }, 5).c).toBe(RIDE_C[0]);
  });
  it('is held to the slow speed while slowed, even when pedalling', () => {
    const b = ride(slowDown(newBike(), 1), { steer: 0, pedal: 1 }, 0.5);
    expect(b.speed).toBe(2);
    expect(b.slow).toBeCloseTo(0.5, 5);
  });
  it('crashes into a wobble with no steering, then blinks', () => {
    const c = crash(newBike());
    expect(c.wobble).toBe(CRASH.wobble);
    expect(c.invuln).toBe(CRASH.wobble + CRASH.invuln);
    expect(canCrash(c)).toBe(false);
    const w = ride(c, { steer: 1, pedal: 1 }, 0.5);
    expect(w.c).toBe(START.c);
    expect(w.lean).toBe(0);
    expect(w.speed).toBeLessThan(SPEED.cruise);
    expect(canCrash(ride(c, NO_CONTROLS, 3))).toBe(true);
  });
  it('never mutates its input', () => {
    const b = newBike();
    stepBike(b, { steer: 1, pedal: 1 }, STEP);
    crash(b);
    slowDown(b, 1);
    expect(b).toEqual(newBike());
  });
});
```

- [ ] **Step 3: Run the test to see it fail**

Run: `npx vitest run games/paper-route/tests/unit/bike.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement the bike**

`games/paper-route/src/sim/bike.ts`:
```ts
import { ACCEL, CRASH, DRIFT, RIDE_C, SLOW_SPEED, SPEED, START } from './constants';

export type Axis = -1 | 0 | 1;

export interface Controls {
  /** −1 drift left (c down), +1 drift right. */
  readonly steer: Axis;
  /** −1 brake, +1 pedal faster. */
  readonly pedal: Axis;
}

export const NO_CONTROLS: Controls = { steer: 0, pedal: 0 };

export interface Bike {
  readonly c: number;
  readonly s: number;
  readonly speed: number;
  /** The steering actually applied this step (drives the rider's facing). */
  readonly lean: Axis;
  /** Seconds left held to SLOW_SPEED (puddle, sprinkler). */
  readonly slow: number;
  /** Seconds left of crash wobble: no steering, no throws. */
  readonly wobble: number;
  /** Seconds left that a crash can't happen. */
  readonly invuln: number;
}

export const newBike = (): Bike => ({ c: START.c, s: START.s, speed: SPEED.cruise, lean: 0, slow: 0, wobble: 0, invuln: 0 });

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const tickDown = (v: number, dt: number) => Math.max(0, v - dt);

export function targetSpeed(b: Bike, pedal: Axis): number {
  if (b.wobble > 0) return CRASH.wobbleSpeed;
  const wanted = pedal > 0 ? SPEED.max : pedal < 0 ? SPEED.min : SPEED.cruise;
  return b.slow > 0 ? Math.min(wanted, SLOW_SPEED) : wanted;
}

export function stepBike(b: Bike, ctl: Controls, dt: number): Bike {
  const speed = approach(b.speed, targetSpeed(b, ctl.pedal), ACCEL * dt);
  const lean: Axis = b.wobble > 0 ? 0 : ctl.steer;
  return {
    c: clamp(b.c + lean * DRIFT * dt, RIDE_C[0], RIDE_C[1]),
    s: b.s + speed * dt,
    speed,
    lean,
    slow: tickDown(b.slow, dt),
    wobble: tickDown(b.wobble, dt),
    invuln: tickDown(b.invuln, dt),
  };
}

export const slowDown = (b: Bike, seconds: number): Bike => ({ ...b, slow: Math.max(b.slow, seconds) });
export const canCrash = (b: Bike): boolean => b.invuln <= 0;
export const crash = (b: Bike): Bike => ({ ...b, wobble: CRASH.wobble, invuln: CRASH.wobble + CRASH.invuln });
```

The slowed test reaches speed 2 because the approach from 3 at 3 tiles/s² takes 0.33 s.

- [ ] **Step 5: Run the test to see it pass**

Run: `npx vitest run games/paper-route/tests/unit/bike.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add games/paper-route/src/sim games/paper-route/tests/unit/bike.test.ts
git commit -m "feat: add Paper Route constants and the bike step"
```

---

### Task 7: Paper flight and hit tests

**Files:**
- Create: `PR/src/sim/paper.ts`
- Test: `PR/tests/unit/paper.test.ts`

- [ ] **Step 1: Write the failing test**

`games/paper-route/tests/unit/paper.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { newBike } from '../../src/sim/bike';
import { STEP, TOSS } from '../../src/sim/constants';
import { hasLanded, heightAt, mailboxHit, paperPos, porchHit, stepPaper, throwPaper, type Paper } from '../../src/sim/paper';
import { parseStreet } from '../../src/world/street';
import { rawStreet } from '../helpers/make-street';

const street = parseStreet(rawStreet());
const bikeAt = (c: number, s: number) => ({ ...newBike(), c, s });

function fly(p: Paper, seconds: number): Paper {
  let out = p;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = stepPaper(out, STEP);
  return out;
}

describe('flight', () => {
  it('has self-consistent toss constants (lands at height 0 after `flight` seconds)', () => {
    const t = TOSS.flight;
    expect(Math.abs(TOSS.h0 + TOSS.vz * t - (TOSS.gravity * t * t) / 2)).toBeLessThan(0.01);
    expect(heightAt(0)).toBeCloseTo(TOSS.h0);
    expect(heightAt(t / 2)).toBeGreaterThan(1.2);
  });
  it('lands `reach` tiles to the left, carried forward at the bike speed', () => {
    const p = fly(throwPaper(bikeAt(6, 10), 'L'), TOSS.flight);
    expect(hasLanded(p)).toBe(true);
    const pos = paperPos(p);
    expect(pos.c).toBeCloseTo(2.5, 5);
    expect(pos.s).toBeCloseTo(10 + 3 * TOSS.flight, 5);
    expect(pos.z).toBe(0);
  });
  it('lands to the right for a right toss', () => {
    expect(paperPos(fly(throwPaper(bikeAt(8, 10), 'R'), 1)).c).toBeCloseTo(11.5, 5);
  });
  it('is still flying halfway', () => {
    const p = fly(throwPaper(bikeAt(6, 10), 'L'), 0.3);
    expect(hasLanded(p)).toBe(false);
    expect(paperPos(p).z).toBeGreaterThan(1);
  });
});

describe('hits', () => {
  it('hits a mailbox only below the mailbox top', () => {
    expect(mailboxHit(street.lots, { c: 3.6, s: 10, z: 0.5 })?.index).toBe(0);
    expect(mailboxHit(street.lots, { c: 3.6, s: 10, z: 1.2 })).toBeUndefined();
    expect(mailboxHit(street.lots, { c: 3.0, s: 10, z: 0.5 })).toBeUndefined();
  });
  it('hits a porch rectangle', () => {
    expect(porchHit(street.lots, { c: 2.5, s: 11.8, z: 0 })?.index).toBe(0);
    expect(porchHit(street.lots, { c: 11.5, s: 9, z: 0 })?.index).toBe(1);
    expect(porchHit(street.lots, { c: 2.5, s: 14, z: 0 })).toBeUndefined();
  });
  it('a toss timed for the mailbox drops into it mid-flight', () => {
    // From c 6 the paper reaches the mailbox's c (3.6) after 0.41 s, about 1.23 tiles further along.
    let p = throwPaper(bikeAt(6, 10 - 1.23), 'L');
    let hit: number | undefined;
    while (!hasLanded(p) && hit === undefined) {
      p = stepPaper(p, STEP);
      hit = mailboxHit(street.lots, paperPos(p))?.index;
    }
    expect(hit).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run games/paper-route/tests/unit/paper.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`games/paper-route/src/sim/paper.ts`:
```ts
import { distance } from '../core/geometry';
import { inRect, type Lot, type Side } from '../world/street';
import type { Bike } from './bike';
import { MAILBOX, TOSS } from './constants';

/** A paper in flight, described by its launch so its position is exact at any time. */
export interface Paper {
  readonly c0: number;
  readonly s0: number;
  /** Tiles/s across (negative = left). */
  readonly dc: number;
  /** Tiles/s along: the bike's speed when thrown. */
  readonly ds: number;
  /** Seconds since the throw, capped at TOSS.flight. */
  readonly t: number;
}

export interface PaperPos {
  readonly c: number;
  readonly s: number;
  readonly z: number;
}

const EPS = 1e-9;

export function throwPaper(bike: Bike, side: Side): Paper {
  const dir = side === 'L' ? -1 : 1;
  return { c0: bike.c, s0: bike.s, dc: (dir * TOSS.reach) / TOSS.flight, ds: bike.speed, t: 0 };
}

export function stepPaper(p: Paper, dt: number): Paper {
  const t = p.t + dt;
  return { ...p, t: t >= TOSS.flight - EPS ? TOSS.flight : t };
}

export const heightAt = (t: number): number => Math.max(0, TOSS.h0 + TOSS.vz * t - (TOSS.gravity * t * t) / 2);

export const hasLanded = (p: Paper): boolean => p.t >= TOSS.flight;

export function paperPos(p: Paper): PaperPos {
  return { c: p.c0 + p.dc * p.t, s: p.s0 + p.ds * p.t, z: hasLanded(p) ? 0 : heightAt(p.t) };
}

/** The lot whose mailbox the paper is passing through, if it is low enough. */
export function mailboxHit(lots: readonly Lot[], pos: PaperPos): Lot | undefined {
  if (pos.z >= MAILBOX.top) return undefined;
  return lots.find((l) => distance(l.mailbox, [pos.c, pos.s]) <= MAILBOX.r);
}

export const porchHit = (lots: readonly Lot[], pos: PaperPos): Lot | undefined => lots.find((l) => inRect(l.porch, pos.c, pos.s));
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run games/paper-route/tests/unit/paper.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/paper-route/src/sim/paper.ts games/paper-route/tests/unit/paper.test.ts
git commit -m "feat: add paper flight and porch/mailbox hit tests"
```

---

### Task 8: Hazards (dog, sprinkler, car, puddle)

**Files:**
- Create: `PR/src/sim/hazards.ts`
- Test: `PR/tests/unit/hazards.test.ts`

- [ ] **Step 1: Write the failing test**

`games/paper-route/tests/unit/hazards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../src/core/geometry';
import { newBike } from '../../src/sim/bike';
import { DOG, STEP } from '../../src/sim/constants';
import { carHits, dogBites, dogTakesTreat, inPuddle, inSpray, newDog, sitDog, sprinklerOn, stepDog, type Dog } from '../../src/sim/hazards';

const home: Vec2 = [12, 50];
const bikeAt = (c: number, s: number) => ({ ...newBike(), c, s });

function run(dog: Dog, bike: ReturnType<typeof bikeAt>, seconds: number): Dog {
  let d = dog;
  for (let i = 0; i < Math.round(seconds / STEP); i++) d = stepDog(d, home, bike, STEP);
  return d;
}

describe('dog', () => {
  it('waits at home until the bike is within the trigger distance', () => {
    expect(stepDog(newDog(home), home, bikeAt(7, 40), STEP).mode).toBe('home');
    expect(stepDog(newDog(home), home, bikeAt(7, 50 - DOG.trigger + 0.5), STEP).mode).toBe('chase');
  });
  it('chases toward the bike at its run speed', () => {
    const d = run({ ...newDog(home), mode: 'chase' }, bikeAt(12, 40), 1);
    expect(d.mode).toBe('chase');
    expect(d.c).toBeCloseTo(12);
    expect(d.s).toBeCloseTo(50 - DOG.speed, 1);
  });
  it('gives up after the chase time, trots home, and never chases again', () => {
    const tired = run({ ...newDog(home), mode: 'chase' }, bikeAt(12, 20), DOG.chaseTime + STEP);
    expect(tired.mode).toBe('return');
    const back = run(tired, bikeAt(12, 49), 20);
    expect(back).toMatchObject({ c: 12, s: 50, mode: 'done' });
    expect(stepDog(back, home, bikeAt(12, 49), STEP).mode).toBe('done');
  });
  it('sits for good after a treat', () => {
    const d = sitDog({ ...newDog(home), mode: 'chase' });
    expect(run(d, bikeAt(12, 49), 1)).toEqual(d);
  });
  it('bites only while chasing and touching the bike', () => {
    const chasing: Dog = { c: 7.2, s: 20, mode: 'chase', timer: 0 };
    expect(dogBites(chasing, bikeAt(7, 20))).toBe(true);
    expect(dogBites({ ...chasing, mode: 'return' }, bikeAt(7, 20))).toBe(false);
    expect(dogBites(chasing, bikeAt(7, 22))).toBe(false);
  });
  it('takes a treat that lands close, unless it is already done or sitting', () => {
    const d = newDog(home);
    expect(dogTakesTreat(d, { c: 12.3, s: 50.2, z: 0 })).toBe(true);
    expect(dogTakesTreat(d, { c: 13, s: 51, z: 0 })).toBe(false);
    expect(dogTakesTreat({ ...d, mode: 'done' }, { c: 12, s: 50, z: 0 })).toBe(false);
  });
});

describe('other hazards', () => {
  it('runs sprinklers 1.5 s on, 1.5 s off', () => {
    expect(sprinklerOn(0)).toBe(true);
    expect(sprinklerOn(1.4)).toBe(true);
    expect(sprinklerOn(1.6)).toBe(false);
    expect(sprinklerOn(3.1)).toBe(true);
  });
  it('sprays the bike only inside the spray box while on', () => {
    const spray = { c0: 3.5, s0: 64, c1: 5.5, s1: 69 };
    expect(inSpray(spray, bikeAt(4.5, 66), 0.5)).toBe(true);
    expect(inSpray(spray, bikeAt(4.5, 66), 2)).toBe(false);
    expect(inSpray(spray, bikeAt(7, 66), 0.5)).toBe(false);
  });
  it('hits a parked car by its box plus the bike radius', () => {
    expect(carHits([5.6, 30], bikeAt(6.3, 30))).toBe(true);
    expect(carHits([5.6, 30], bikeAt(6.6, 30))).toBe(false);
    expect(carHits([5.6, 30], bikeAt(5.6, 31.3))).toBe(true);
    expect(carHits([5.6, 30], bikeAt(5.6, 31.5))).toBe(false);
  });
  it('detects a puddle under the bike', () => {
    expect(inPuddle([7, 45], bikeAt(7.3, 45.2))).toBe(true);
    expect(inPuddle([7, 45], bikeAt(8, 45))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run games/paper-route/tests/unit/hazards.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`games/paper-route/src/sim/hazards.ts`:
```ts
import { distance, type Vec2 } from '../core/geometry';
import { inRect, type Rect } from '../world/street';
import type { Bike } from './bike';
import { BIKE_R, CAR_HALF, DOG, PUDDLE, SPRINKLER } from './constants';
import type { PaperPos } from './paper';

/** home → chase → return → done; a treat at any point before done → sit. */
export type DogMode = 'home' | 'chase' | 'return' | 'sit' | 'done';

export interface Dog {
  readonly c: number;
  readonly s: number;
  readonly mode: DogMode;
  /** Seconds spent chasing. */
  readonly timer: number;
}

export const newDog = (home: Vec2): Dog => ({ c: home[0], s: home[1], mode: 'home', timer: 0 });

function moveToward(from: Vec2, to: Vec2, step: number): Vec2 {
  const d = distance(from, to);
  if (d <= step) return to;
  return [from[0] + ((to[0] - from[0]) * step) / d, from[1] + ((to[1] - from[1]) * step) / d];
}

export function stepDog(dog: Dog, home: Vec2, bike: Bike, dt: number): Dog {
  switch (dog.mode) {
    case 'home':
      return Math.abs(bike.s - home[1]) < DOG.trigger ? { ...dog, mode: 'chase', timer: 0 } : dog;
    case 'chase': {
      const timer = dog.timer + dt;
      if (timer >= DOG.chaseTime) return { ...dog, mode: 'return', timer };
      const [c, s] = moveToward([dog.c, dog.s], [bike.c, bike.s], DOG.speed * dt);
      return { c, s, mode: 'chase', timer };
    }
    case 'return': {
      const [c, s] = moveToward([dog.c, dog.s], home, DOG.homeSpeed * dt);
      return { ...dog, c, s, mode: c === home[0] && s === home[1] ? 'done' : 'return' };
    }
    default:
      return dog;
  }
}

export const sitDog = (dog: Dog): Dog => ({ ...dog, mode: 'sit' });

export const dogBites = (dog: Dog, bike: Bike): boolean =>
  dog.mode === 'chase' && distance([dog.c, dog.s], [bike.c, bike.s]) < DOG.r + BIKE_R;

export const dogTakesTreat = (dog: Dog, pos: PaperPos): boolean =>
  (dog.mode === 'home' || dog.mode === 'chase' || dog.mode === 'return') && distance([dog.c, dog.s], [pos.c, pos.s]) <= DOG.treatR;

const PERIOD = SPRINKLER.on + SPRINKLER.off;
export const sprinklerOn = (time: number): boolean => ((time % PERIOD) + PERIOD) % PERIOD < SPRINKLER.on;

export const inSpray = (spray: Rect, bike: Bike, time: number): boolean => sprinklerOn(time) && inRect(spray, bike.c, bike.s);

export const carHits = (at: Vec2, bike: Bike): boolean =>
  Math.abs(bike.c - at[0]) < CAR_HALF[0] + BIKE_R && Math.abs(bike.s - at[1]) < CAR_HALF[1] + BIKE_R;

export const inPuddle = (at: Vec2, bike: Bike): boolean => distance(at, [bike.c, bike.s]) < PUDDLE.r;
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run games/paper-route/tests/unit/hazards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/paper-route/src/sim/hazards.ts games/paper-route/tests/unit/hazards.test.ts
git commit -m "feat: add the dog, sprinkler, car and puddle hazards"
```

---

### Task 9: Scoring and best score

**Files:**
- Create: `PR/src/game/score.ts`
- Test: `PR/tests/unit/score.test.ts`

- [ ] **Step 1: Write the failing test**

`games/paper-route/tests/unit/score.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { accuracy, BEST_KEY, deliveryPoints, finishBonus, loadBest, saveBest, type KeyValueStore } from '../../src/game/score';
import { parseStreet } from '../../src/world/street';
import { rawStreet } from '../helpers/make-street';

const [sub, plain] = parseStreet(rawStreet()).lots;

function memoryStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

describe('points', () => {
  it('pays subscribers by hit kind and charges for non-subscribers', () => {
    expect(deliveryPoints(sub, 'porch')).toBe(250);
    expect(deliveryPoints(sub, 'mailbox')).toBe(500);
    expect(deliveryPoints(plain, 'porch')).toBe(-100);
    expect(deliveryPoints(plain, 'mailbox')).toBe(-100);
  });
  it('adds a perfect bonus only when every subscriber was served, plus 25 per paper left', () => {
    expect(finishBonus(16, 16, 3)).toBe(2075);
    expect(finishBonus(15, 16, 3)).toBe(75);
    expect(finishBonus(0, 0, 0)).toBe(0);
  });
  it('computes accuracy as deliveries per throw', () => {
    expect(accuracy(3, 4)).toBe(0.75);
    expect(accuracy(0, 0)).toBe(0);
  });
});

describe('best score', () => {
  it('loads 0 when missing, garbage, or storage is unavailable', () => {
    expect(loadBest(null)).toBe(0);
    expect(loadBest(memoryStore())).toBe(0);
    expect(loadBest(memoryStore({ [BEST_KEY]: 'abc' }))).toBe(0);
    expect(loadBest({ getItem: () => { throw new Error('denied'); }, setItem: () => {} })).toBe(0);
  });
  it('saves only a higher score and returns the best', () => {
    const store = memoryStore({ [BEST_KEY]: '1200' });
    expect(saveBest(store, 900)).toBe(1200);
    expect(store.data[BEST_KEY]).toBe('1200');
    expect(saveBest(store, 3000)).toBe(3000);
    expect(store.data[BEST_KEY]).toBe('3000');
  });
  it('still reports the new best when saving fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('full'); } };
    expect(saveBest(store, 500)).toBe(500);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run games/paper-route/tests/unit/score.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`games/paper-route/src/game/score.ts`:
```ts
import { POINTS } from '../sim/constants';
import type { Lot } from '../world/street';

export type Delivery = 'porch' | 'mailbox';

export const deliveryPoints = (lot: Lot, hit: Delivery): number => (lot.subscriber ? POINTS[hit] : POINTS.wrong);

export function finishBonus(delivered: number, subscribers: number, papersLeft: number): number {
  const perfect = subscribers > 0 && delivered >= subscribers ? POINTS.perfect : 0;
  return perfect + papersLeft * POINTS.paperLeft;
}

export const accuracy = (delivered: number, throws: number): number => (throws === 0 ? 0 : delivered / throws);

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const BEST_KEY = 'paper-route.best';

export function loadBest(store: KeyValueStore | null): number {
  if (!store) return 0;
  try {
    const n = Number(store.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Stores `score` if it beats the saved best; returns the best either way. */
export function saveBest(store: KeyValueStore | null, score: number): number {
  const prev = loadBest(store);
  if (score <= prev) return prev;
  try {
    store?.setItem(BEST_KEY, String(score));
  } catch (err) {
    console.warn('Could not save the best score:', err);
  }
  return score;
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run games/paper-route/tests/unit/score.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/paper-route/src/game/score.ts games/paper-route/tests/unit/score.test.ts
git commit -m "feat: add Paper Route scoring and best-score storage"
```

---

### Task 10: Game state reducer and the sim tick

**Files:**
- Create: `PR/src/game/state.ts`, `PR/src/game/tick.ts`
- Test: `PR/tests/unit/state.test.ts`

- [ ] **Step 1: Write the failing test**

`games/paper-route/tests/unit/state.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { NO_CONTROLS, type Controls } from '../../src/sim/bike';
import { STEP } from '../../src/sim/constants';
import { initialState, newRun, reduce, type GameEvent, type GameState } from '../../src/game/state';
import { parseStreet, type Street } from '../../src/world/street';
import { rawStreet } from '../helpers/make-street';

const plain = parseStreet(rawStreet());
const withHazards = (hazards: unknown[]) => parseStreet(rawStreet({ hazards: [...hazards, { kind: 'dog', home: [12, 30] }] }));

function ride(s: GameState, street: Street, seconds: number, controls: Controls = NO_CONTROLS): GameState {
  let out = s;
  for (let i = 0; i < Math.round(seconds / STEP); i++) out = reduce(out, { type: 'tick', dt: STEP, controls }, street);
  return out;
}
const at = (s: GameState, c: number, pos: number): GameState => ({ ...s, bike: { ...s.bike, c, s: pos } });
const count = (s: GameState, type: GameEvent['type']) => s.events.filter((e) => e.type === type).length;

describe('flow', () => {
  it('starts on the title and begins a run on start', () => {
    const t = initialState(plain);
    expect(t.phase).toBe('title');
    const r = reduce(t, { type: 'start' }, plain);
    expect(r.phase).toBe('riding');
    expect(reduce(r, { type: 'start' }, plain)).toBe(r);
    expect(reduce(t, { type: 'restart' }, plain)).toBe(t);
  });
  it('does nothing while on the title or paused', () => {
    const t = initialState(plain);
    expect(ride(t, plain, 0.5)).toBe(t);
    const p = reduce(newRun(plain), { type: 'togglePause' }, plain);
    expect(p.paused).toBe(true);
    expect(ride(p, plain, 0.5)).toBe(p);
    expect(reduce(p, { type: 'toss', side: 'L' }, plain)).toBe(p);
    expect(reduce(p, { type: 'togglePause' }, plain).paused).toBe(false);
  });
  it('restarts a finished or running game fresh', () => {
    const r = ride(newRun(plain), plain, 1);
    const fresh = reduce({ ...r, score: 999 }, { type: 'restart' }, plain);
    expect(fresh.phase).toBe('riding');
    expect(fresh.score).toBe(0);
    expect(fresh.bike.s).toBe(2);
  });
});

describe('tossing', () => {
  it('throws a paper with a cooldown', () => {
    const r = reduce(newRun(plain), { type: 'toss', side: 'L' }, plain);
    expect(r.papers).toBe(9);
    expect(r.throws).toBe(1);
    expect(r.flying).toHaveLength(1);
    expect(count(r, 'toss')).toBe(1);
    expect(reduce(r, { type: 'toss', side: 'R' }, plain)).toBe(r);
    const later = ride(r, plain, 0.4);
    expect(reduce(later, { type: 'toss', side: 'R' }, plain).papers).toBe(8);
  });
  it('makes a dry sound with no papers left', () => {
    const r = reduce({ ...newRun(plain), papers: 0 }, { type: 'toss', side: 'L' }, plain);
    expect(r.flying).toHaveLength(0);
    expect(count(r, 'dry')).toBe(1);
  });
  it('delivers to a subscriber porch', () => {
    const r = ride(reduce(at(newRun(plain), 6, 10), { type: 'toss', side: 'L' }, plain), plain, 0.7);
    expect(r.score).toBe(250);
    expect(r.delivered).toBe(1);
    expect(r.hitLots).toEqual([0]);
    expect(r.landed).toHaveLength(1);
    expect(r.events).toContainEqual({ type: 'deliver', hit: 'porch', lot: 0, points: 250 });
  });
  it('delivers into a subscriber mailbox mid-flight', () => {
    const r = ride(reduce(at(newRun(plain), 6, 10 - 1.23), { type: 'toss', side: 'L' }, plain), plain, 0.7);
    expect(r.score).toBe(500);
    expect(r.landed).toHaveLength(0);
    expect(r.events).toContainEqual({ type: 'deliver', hit: 'mailbox', lot: 0, points: 500 });
  });
  it('charges for a non-subscriber and counts each house once', () => {
    const r = ride(reduce(at(newRun(plain), 8, 10), { type: 'toss', side: 'R' }, plain), plain, 0.7);
    expect(r.score).toBe(-100);
    expect(r.delivered).toBe(0);
    expect(count(r, 'wrong')).toBe(1);
    const again = ride(reduce(at({ ...newRun(plain), hitLots: [0], score: 250 }, 6, 10), { type: 'toss', side: 'L' }, plain), plain, 0.7);
    expect(again.score).toBe(250);
    expect(count(again, 'thunk')).toBe(1);
  });
  it('gives the dog a treat', () => {
    const s = { ...at(newRun(plain), 8, 20), dog: { c: 11.5, s: 21.8, mode: 'home' as const, timer: 0 } };
    const r = ride(reduce(s, { type: 'toss', side: 'R' }, plain), plain, 0.7);
    expect(r.dog.mode).toBe('sit');
    expect(r.score).toBe(50);
    expect(count(r, 'treat')).toBe(1);
  });
});

describe('hazards and pickups', () => {
  it('picks up a bundle once, capped at 15 papers', () => {
    const r = ride({ ...at(newRun(plain), 7, 24.5), papers: 12 }, plain, 0.5);
    expect(r.papers).toBe(15);
    expect(r.bundlesTaken).toEqual([0]);
    expect(count(r, 'pickup')).toBe(1);
  });
  it('crashes into a car once, then is briefly invulnerable', () => {
    const street = withHazards([{ kind: 'car', at: [7, 15] }]);
    const r = ride(at(newRun(street), 7, 13), street, 2);
    expect(r.helmets).toBe(2);
    expect(count(r, 'crash')).toBe(1);
  });
  it('wipes out on the last helmet', () => {
    const street = withHazards([{ kind: 'car', at: [7, 15] }]);
    const r = ride({ ...at(newRun(street), 7, 13), helmets: 1 }, street, 1);
    expect(r.phase).toBe('over');
    expect(r.outcome).toBe('wiped');
    expect(count(r, 'wiped')).toBe(1);
  });
  it('splashes through a puddle once and slows down', () => {
    const street = withHazards([{ kind: 'puddle', at: [7, 15] }]);
    const r = ride(at(newRun(street), 7, 14), street, 0.4);
    expect(count(r, 'splash')).toBe(1);
    expect(r.bike.slow).toBeGreaterThan(0);
  });
  it('gets sprayed by a running sprinkler', () => {
    const street = withHazards([{ kind: 'sprinkler', at: [2, 15], spray: [4, 14, 6, 18] }]);
    const r = ride(at(newRun(street), 5, 14), street, 0.4);
    expect(count(r, 'spray')).toBe(1);
    expect(r.inSpray).toBe(true);
  });
  it('barks when the dog starts a chase and crashes when it bites', () => {
    const near = ride(at(newRun(plain), 7, 25), plain, STEP);
    expect(near.dog.mode).toBe('chase');
    expect(count(near, 'bark')).toBe(1);
    const bitten = ride({ ...at(newRun(plain), 7, 25), dog: { c: 7.2, s: 25.2, mode: 'chase', timer: 0 } }, plain, STEP);
    expect(bitten.helmets).toBe(2);
  });
});

describe('finish', () => {
  it('ends the run near the end of the street with the finish bonus', () => {
    const s = { ...at(newRun(plain), 7, plain.length - 4.1), delivered: 1, hitLots: [0], score: 250 };
    const r = ride(s, plain, 0.2);
    expect(r.phase).toBe('over');
    expect(r.outcome).toBe('finished');
    expect(r.score).toBe(250 + 2000 + 10 * 25);
    expect(r.events).toContainEqual({ type: 'finish', bonus: 2250 });
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run games/paper-route/tests/unit/state.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the state and reducer**

`games/paper-route/src/game/state.ts`:
```ts
import type { Vec2 } from '../core/geometry';
import { newBike, type Bike, type Controls } from '../sim/bike';
import { CRASH, PAPERS, TOSS } from '../sim/constants';
import { newDog, type Dog } from '../sim/hazards';
import { throwPaper, type Paper } from '../sim/paper';
import type { Side, Street } from '../world/street';
import type { Delivery } from './score';
import { tick } from './tick';

export type Phase = 'title' | 'riding' | 'over';
export type Outcome = 'finished' | 'wiped';

export type GameEvent =
  | { readonly type: 'toss' }
  | { readonly type: 'dry' }
  | { readonly type: 'deliver'; readonly hit: Delivery; readonly lot: number; readonly points: number }
  | { readonly type: 'wrong'; readonly lot: number; readonly points: number }
  | { readonly type: 'thunk' }
  | { readonly type: 'land' }
  | { readonly type: 'treat'; readonly points: number }
  | { readonly type: 'pickup' }
  | { readonly type: 'splash' }
  | { readonly type: 'spray' }
  | { readonly type: 'bark' }
  | { readonly type: 'crash' }
  | { readonly type: 'finish'; readonly bonus: number }
  | { readonly type: 'wiped' };

export interface GameState {
  readonly phase: Phase;
  readonly paused: boolean;
  readonly outcome: Outcome | null;
  /** Seconds of riding this run (drives sprinklers). */
  readonly time: number;
  readonly bike: Bike;
  readonly helmets: number;
  readonly papers: number;
  readonly cooldown: number;
  readonly flying: readonly Paper[];
  /** Papers lying where they landed (porch or lawn). */
  readonly landed: readonly Vec2[];
  /** Lots already hit once (served or complained). */
  readonly hitLots: readonly number[];
  /** Subscriber deliveries. */
  readonly delivered: number;
  readonly throws: number;
  readonly dog: Dog;
  readonly bundlesTaken: readonly number[];
  readonly inPuddle: boolean;
  readonly inSpray: boolean;
  readonly score: number;
  /** Events since the last clearEvents (read by audio and HUD each frame). */
  readonly events: readonly GameEvent[];
}

export type Action =
  | { readonly type: 'start' }
  | { readonly type: 'restart' }
  | { readonly type: 'togglePause' }
  | { readonly type: 'toss'; readonly side: Side }
  | { readonly type: 'tick'; readonly dt: number; readonly controls: Controls };

export function newRun(street: Street, phase: Phase = 'riding'): GameState {
  return {
    phase, paused: false, outcome: null, time: 0, bike: newBike(), helmets: CRASH.helmets, papers: PAPERS.start,
    cooldown: 0, flying: [], landed: [], hitLots: [], delivered: 0, throws: 0, dog: newDog(street.dogHome),
    bundlesTaken: [], inPuddle: false, inSpray: false, score: 0, events: [],
  };
}

export const initialState = (street: Street): GameState => newRun(street, 'title');
export const isActive = (s: GameState): boolean => s.phase === 'riding' && !s.paused;
export const clearEvents = (s: GameState): GameState => (s.events.length === 0 ? s : { ...s, events: [] });
export const emit = (s: GameState, ...events: GameEvent[]): GameState => ({ ...s, events: [...s.events, ...events] });

function toss(s: GameState, side: Side): GameState {
  if (!isActive(s) || s.bike.wobble > 0 || s.cooldown > 0) return s;
  if (s.papers <= 0) return emit({ ...s, cooldown: TOSS.cooldown }, { type: 'dry' });
  return emit({
    ...s, papers: s.papers - 1, throws: s.throws + 1, cooldown: TOSS.cooldown, flying: [...s.flying, throwPaper(s.bike, side)],
  }, { type: 'toss' });
}

export function reduce(s: GameState, a: Action, street: Street): GameState {
  switch (a.type) {
    case 'start': return s.phase === 'riding' ? s : newRun(street);
    case 'restart': return s.phase === 'title' ? s : newRun(street);
    case 'togglePause': return s.phase === 'riding' ? { ...s, paused: !s.paused } : s;
    case 'toss': return toss(s, a.side);
    case 'tick': return isActive(s) ? tick(s, street, a.dt, a.controls) : s;
  }
}
```

`emit` is exported for `tick.ts`. The import between `state.ts` and `tick.ts` runs both ways, but each side only uses the other's functions at call time, never at module load, so ES modules resolve it safely.

- [ ] **Step 4: Implement the tick**

`games/paper-route/src/game/tick.ts`:
```ts
import { distance } from '../core/geometry';
import { canCrash, crash, slowDown, stepBike, type Controls } from '../sim/bike';
import { BIKE_R, BUNDLE_R, FINISH_MARGIN, PAPERS, POINTS, PUDDLE, SPRINKLER } from '../sim/constants';
import { carHits, dogBites, dogTakesTreat, inPuddle, inSpray, sitDog, stepDog } from '../sim/hazards';
import { hasLanded, mailboxHit, paperPos, porchHit, stepPaper, type PaperPos } from '../sim/paper';
import type { Lot, Street } from '../world/street';
import { deliveryPoints, finishBonus, type Delivery } from './score';
import { emit, type GameState } from './state';

type Step = (s: GameState, street: Street, dt: number) => GameState;

function deliver(s: GameState, lot: Lot, hit: Delivery): GameState {
  if (s.hitLots.includes(lot.index)) return emit(s, { type: 'thunk' });
  const points = deliveryPoints(lot, hit);
  const base = { ...s, hitLots: [...s.hitLots, lot.index], score: s.score + points };
  return lot.subscriber
    ? emit({ ...base, delivered: s.delivered + 1 }, { type: 'deliver', hit, lot: lot.index, points })
    : emit(base, { type: 'wrong', lot: lot.index, points });
}

function landPaper(s: GameState, street: Street, pos: PaperPos): GameState {
  const landed = { ...s, landed: [...s.landed, [pos.c, pos.s] as const] };
  const porch = porchHit(street.lots, pos);
  if (porch) return deliver(landed, porch, 'porch');
  if (dogTakesTreat(s.dog, pos)) return emit({ ...landed, dog: sitDog(s.dog), score: s.score + POINTS.dog }, { type: 'treat', points: POINTS.dog });
  return emit(landed, { type: 'land' });
}

const stepPapers: Step = (s, street, dt) =>
  s.flying.reduce<GameState>((acc, p0) => {
    const p = stepPaper(p0, dt);
    const pos = paperPos(p);
    const box = mailboxHit(street.lots, pos);
    if (box) return deliver(acc, box, 'mailbox');
    return hasLanded(p) ? landPaper(acc, street, pos) : { ...acc, flying: [...acc.flying, p] };
  }, { ...s, flying: [] });

const stepPickups: Step = (s, street) =>
  street.bundles.reduce<GameState>((acc, at, i) => {
    if (acc.bundlesTaken.includes(i) || distance(at, [acc.bike.c, acc.bike.s]) > BUNDLE_R + BIKE_R) return acc;
    return emit({ ...acc, bundlesTaken: [...acc.bundlesTaken, i], papers: Math.min(PAPERS.max, acc.papers + PAPERS.bundle) }, { type: 'pickup' });
  }, s);

const stepPuddles: Step = (s, street) => {
  const wet = street.hazards.some((h) => h.kind === 'puddle' && inPuddle(h.at, s.bike));
  if (!wet) return s.inPuddle ? { ...s, inPuddle: false } : s;
  const next = { ...s, inPuddle: true, bike: slowDown(s.bike, PUDDLE.slowTime) };
  return s.inPuddle ? next : emit(next, { type: 'splash' });
};

const stepSprinklers: Step = (s, street) => {
  const sprayed = street.hazards.some((h) => h.kind === 'sprinkler' && inSpray(h.spray, s.bike, s.time));
  if (!sprayed) return s.inSpray ? { ...s, inSpray: false } : s;
  const next = { ...s, inSpray: true, bike: slowDown(s.bike, SPRINKLER.slowTime) };
  return s.inSpray ? next : emit(next, { type: 'spray' });
};

function crashed(s: GameState): GameState {
  const helmets = s.helmets - 1;
  const hurt = emit({ ...s, helmets, bike: crash(s.bike) }, { type: 'crash' });
  return helmets > 0 ? hurt : emit({ ...hurt, phase: 'over', outcome: 'wiped' }, { type: 'wiped' });
}

const stepDogStep: Step = (s, street, dt) => {
  const dog = stepDog(s.dog, street.dogHome, s.bike, dt);
  const next = s.dog.mode === 'home' && dog.mode === 'chase' ? emit({ ...s, dog }, { type: 'bark' }) : { ...s, dog };
  return dogBites(dog, next.bike) && canCrash(next.bike) ? crashed(next) : next;
};

const stepCars: Step = (s, street) =>
  canCrash(s.bike) && street.hazards.some((h) => h.kind === 'car' && carHits(h.at, s.bike)) ? crashed(s) : s;

const checkFinish: Step = (s, street) => {
  if (s.bike.s < street.length - FINISH_MARGIN) return s;
  const bonus = finishBonus(s.delivered, street.lots.filter((l) => l.subscriber).length, s.papers);
  return emit({ ...s, phase: 'over', outcome: 'finished', score: s.score + bonus }, { type: 'finish', bonus });
};

const STEPS: readonly Step[] = [stepPapers, stepPickups, stepPuddles, stepSprinklers, stepDogStep, stepCars, checkFinish];

/** One fixed sim step of a running game. Later steps are skipped once the run is over. */
export function tick(s: GameState, street: Street, dt: number, controls: Controls): GameState {
  const moved = { ...s, time: s.time + dt, cooldown: Math.max(0, s.cooldown - dt), bike: stepBike(s.bike, controls, dt) };
  return STEPS.reduce((acc, step) => (acc.phase === 'riding' ? step(acc, street, dt) : acc), moved);
}
```

`landed` holds `Vec2` values, and `[pos.c, pos.s] as const` is a readonly tuple, which matches `Vec2`.

- [ ] **Step 5: Run the test to see it pass**

Run: `npx vitest run games/paper-route/tests/unit/state.test.ts`
Expected: PASS. If the bundle test picks the bundle up twice, check that `stepPickups` reads `acc.bundlesTaken` and not `s.bundlesTaken`.

- [ ] **Step 6: Check coverage**

Run: `npx vitest run --coverage`
Expected: the thresholds pass. The `games/paper-route/src/{sim,game,world}` files are each at least 80% covered.

- [ ] **Step 7: Commit**

```bash
git add games/paper-route/src/game games/paper-route/tests/unit/state.test.ts
git commit -m "feat: add the Paper Route game reducer and sim tick"
```

---

### Task 11: Keyboard input

**Files:**
- Create: `PR/src/core/input.ts`
- Test: `PR/tests/unit/input.test.ts`

- [ ] **Step 1: Write the failing test**

`games/paper-route/tests/unit/input.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { attachKeyboard, controlsFrom, edgeFor, isGameKey } from '../../src/core/input';

const key = (type: string, code: string, repeat = false) => Object.assign(new Event(type, { cancelable: true }), { code, repeat });

describe('key mapping', () => {
  it('maps toss, start, restart and pause keys', () => {
    expect(edgeFor('KeyJ')).toEqual({ type: 'toss', side: 'L' });
    expect(edgeFor('KeyQ')).toEqual({ type: 'toss', side: 'L' });
    expect(edgeFor('KeyK')).toEqual({ type: 'toss', side: 'R' });
    expect(edgeFor('KeyE')).toEqual({ type: 'toss', side: 'R' });
    expect(edgeFor('Enter')).toEqual({ type: 'start' });
    expect(edgeFor('Space')).toEqual({ type: 'start' });
    expect(edgeFor('KeyR')).toEqual({ type: 'restart' });
    expect(edgeFor('Escape')).toEqual({ type: 'togglePause' });
    expect(edgeFor('KeyZ')).toBeNull();
  });
  it('turns held keys into steer and pedal axes', () => {
    expect(controlsFrom(new Set())).toEqual({ steer: 0, pedal: 0 });
    expect(controlsFrom(new Set(['KeyA']))).toEqual({ steer: -1, pedal: 0 });
    expect(controlsFrom(new Set(['ArrowRight', 'ArrowUp']))).toEqual({ steer: 1, pedal: 1 });
    expect(controlsFrom(new Set(['KeyA', 'KeyD', 'KeyS']))).toEqual({ steer: 0, pedal: -1 });
  });
  it('knows which keys belong to the game', () => {
    expect(isGameKey('KeyW')).toBe(true);
    expect(isGameKey('KeyJ')).toBe(true);
    expect(isGameKey('Tab')).toBe(false);
  });
});

describe('attachKeyboard', () => {
  it('tracks held keys, fires edges once per press, clears on blur, and detaches', () => {
    const target = new EventTarget();
    const onEdge = vi.fn();
    const kb = attachKeyboard(target, onEdge);
    target.dispatchEvent(key('keydown', 'KeyD'));
    expect(kb.controls().steer).toBe(1);
    target.dispatchEvent(key('keyup', 'KeyD'));
    expect(kb.controls().steer).toBe(0);
    target.dispatchEvent(key('keydown', 'KeyJ'));
    target.dispatchEvent(key('keydown', 'KeyJ', true));
    expect(onEdge).toHaveBeenCalledTimes(1);
    expect(onEdge).toHaveBeenCalledWith({ type: 'toss', side: 'L' });
    target.dispatchEvent(key('keydown', 'KeyW'));
    target.dispatchEvent(new Event('blur'));
    expect(kb.controls().pedal).toBe(0);
    kb.detach();
    target.dispatchEvent(key('keydown', 'KeyK'));
    expect(onEdge).toHaveBeenCalledTimes(1);
  });
  it('prevents the browser default for game keys only', () => {
    const target = new EventTarget();
    attachKeyboard(target, () => {});
    const space = key('keydown', 'Space');
    const tab = key('keydown', 'Tab');
    target.dispatchEvent(space);
    target.dispatchEvent(tab);
    expect(space.defaultPrevented).toBe(true);
    expect(tab.defaultPrevented).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run games/paper-route/tests/unit/input.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`games/paper-route/src/core/input.ts`:
```ts
import type { Axis, Controls } from '../sim/bike';

/** One-shot key actions. Each is also a game Action. */
export type Edge =
  | { readonly type: 'toss'; readonly side: 'L' | 'R' }
  | { readonly type: 'start' }
  | { readonly type: 'restart' }
  | { readonly type: 'togglePause' };

const EDGES: Readonly<Record<string, Edge>> = {
  KeyJ: { type: 'toss', side: 'L' },
  KeyQ: { type: 'toss', side: 'L' },
  KeyK: { type: 'toss', side: 'R' },
  KeyE: { type: 'toss', side: 'R' },
  Enter: { type: 'start' },
  Space: { type: 'start' },
  KeyR: { type: 'restart' },
  Escape: { type: 'togglePause' },
};
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const HELD = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

export const edgeFor = (code: string): Edge | null => EDGES[code] ?? null;
export const isGameKey = (code: string): boolean => code in EDGES || HELD.has(code);

const anyHeld = (held: ReadonlySet<string>, codes: readonly string[]) => codes.some((c) => held.has(c));
const axis = (neg: boolean, pos: boolean): Axis => (neg === pos ? 0 : pos ? 1 : -1);

export function controlsFrom(held: ReadonlySet<string>): Controls {
  return { steer: axis(anyHeld(held, LEFT), anyHeld(held, RIGHT)), pedal: axis(anyHeld(held, DOWN), anyHeld(held, UP)) };
}

export interface Keyboard {
  controls(): Controls;
  detach(): void;
}

type KeyLike = Event & { readonly code?: string; readonly repeat?: boolean };

/** Listens on `target` (the window in the game). Held keys feed controls(); presses fire onEdge once. */
export function attachKeyboard(target: EventTarget, onEdge: (e: Edge) => void): Keyboard {
  const held = new Set<string>(); // live key state: mutated on purpose
  const down = (e: Event) => {
    const { code = '', repeat = false } = e as KeyLike;
    if (!isGameKey(code)) return;
    e.preventDefault();
    held.add(code);
    const edge = edgeFor(code);
    if (edge && !repeat) onEdge(edge);
  };
  const up = (e: Event) => held.delete((e as KeyLike).code ?? '');
  const blur = () => held.clear();
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', blur);
  return {
    controls: () => controlsFrom(held),
    detach() {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', blur);
    },
  };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx vitest run games/paper-route/tests/unit/input.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add games/paper-route/src/core/input.ts games/paper-route/tests/unit/input.test.ts
git commit -m "feat: add Paper Route keyboard input"
```

---
### Task 12: Post pass and the chunked street bake

**Files:**
- Create: `PR/src/render/post.ts`, `PR/src/render/dither.ts`, `PR/src/render/street-bake.ts`
- Test: `PR/tests/unit/post.test.ts`, `PR/tests/unit/street-bake.test.ts`

The street is flat, so this module doesn't fill polygons the way mini-golf's `terrain-bake.ts` does. Instead it classifies **every pixel** by unprojecting it onto the street, which is simpler and exact. It reuses mini-golf's dither, noise, ramp and fringe ideas.

**Seamless chunks:** every world pixel has exactly one owner chunk, chosen by the `s` its centre unprojects to at height 0. A chunk bakes a padded buffer, so fringe and earth sides see their full neighbourhood, but it keeps only the pixels it owns. Noise and dither use **world** pixel coordinates, so neighbouring chunks agree.

- [ ] **Step 1: Write the failing post test**

`games/paper-route/tests/unit/post.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import paletteJson from '../../assets/palette.json';
import { createPalette } from '../../src/render/palette';
import { applyPost, buildTable, gradeColor, MORNING, postColor } from '../../src/render/post';

const palette = createPalette(paletteJson);
const table = buildTable(palette, MORNING);
const SKY = [0x9f, 0xd8, 0xee] as const;

describe('post pass', () => {
  it('grades a colour with clamping', () => {
    expect(gradeColor([250, 100, 0], { mul: [1.1, 1, 1], add: [10, 0, -5] })).toEqual([255, 100, 0]);
  });
  it('has one graded colour per palette entry', () => {
    expect(table).toHaveLength(palette.colors.length * 3);
  });
  it('turns a colour into its nearest palette entry, graded', () => {
    expect(postColor(palette, table, SKY)).toEqual(gradeColor(SKY, MORNING));
  });
  it('snaps a buffer in place and makes it opaque', () => {
    const px = new Uint8ClampedArray([0x9f, 0xd9, 0xef, 10]);
    applyPost(px, palette.lut, table);
    expect([...px]).toEqual([...gradeColor(SKY, MORNING), 255]);
  });
});
```

- [ ] **Step 2: Run the test to see it fail, then implement post**

Run: `npx vitest run games/paper-route/tests/unit/post.test.ts`
Expected: FAIL (module not found).

`games/paper-route/src/render/post.ts`:
```ts
import { lutIndex, type Palette, type RGB } from './palette';

export interface Grade {
  readonly mul: RGB;
  readonly add: RGB;
}

/** The one daylight look: a touch warm, like early sun. Daytime only, so there are no phases or lamps. */
export const MORNING: Grade = { mul: [1, 0.97, 0.93], add: [10, 6, 2] };

export function gradeColor(c: RGB, g: Grade): RGB {
  const ch = (i: 0 | 1 | 2) => Math.max(0, Math.min(255, Math.round(c[i] * g.mul[i] + g.add[i])));
  return [ch(0), ch(1), ch(2)];
}

/** table[i * 3 .. i * 3 + 2] = output RGB for palette index i. */
export function buildTable(palette: Palette, grade: Grade): Uint8Array {
  return Uint8Array.from(palette.colors.flatMap((c) => gradeColor(c, grade)));
}

/** The colour the post pass turns `c` into, e.g. so the page background can match the canvas. */
export function postColor(palette: Palette, table: Uint8Array, c: RGB): RGB {
  const i = lutIndex(palette.lut, c[0], c[1], c[2]) * 3;
  return [table[i], table[i + 1], table[i + 2]];
}

/** Snaps every pixel to the palette and grades it, IN PLACE (per-frame buffer: documented exception to immutability). */
export function applyPost(px: Uint8ClampedArray, lut: Uint8Array, table: Uint8Array): void {
  for (let i = 0; i < px.length; i += 4) {
    const idx = lutIndex(lut, px[i], px[i + 1], px[i + 2]) * 3;
    px[i] = table[idx];
    px[i + 1] = table[idx + 1];
    px[i + 2] = table[idx + 2];
    px[i + 3] = 255;
  }
}

export function postProcess(ctx: CanvasRenderingContext2D, width: number, height: number, lut: Uint8Array, table: Uint8Array): void {
  const img = ctx.getImageData(0, 0, width, height);
  applyPost(img.data, lut, table);
  ctx.putImageData(img, 0, 0);
}
```

Run: `npx vitest run games/paper-route/tests/unit/post.test.ts`
Expected: PASS.

- [ ] **Step 3: Copy the dither helpers**

`games/paper-route/src/render/dither.ts` holds `BAYER4`, `bayer`, `hash2`, `valueNoise` (with its private `smooth`) and `rampLevel`, copied **verbatim** from mini-golf's `src/render/terrain-bake.ts` (find each definition by name; `smooth` stays private), each of the other five with an `export`. Nothing else from that file is needed. Begin the file with:
```ts
/** Ordered-dither and value-noise helpers, copied from mini-golf's terrain bake. */
```

- [ ] **Step 4: Write the failing street-bake test**

`games/paper-route/tests/unit/street-bake.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ORIGIN, streetPx } from '../../src/render/iso';
import { bakeChunk, chunkBounds, chunkCount, chunkRange, groundAt, ownerChunk, pixelKind, type ChunkBake } from '../../src/render/street-bake';

const px = (length: number, c: number, s: number, z = 0) => streetPx(ORIGIN, length, c, s, z);
const painted = (b: ChunkBake, wx: number, wy: number): number => {
  const x = wx - b.x, y = wy - b.y;
  if (x < 0 || y < 0 || x >= b.width || y >= b.height) return 0;
  return b.frames[0][(y * b.width + x) * 4 + 3] === 255 ? 1 : 0;
};

describe('groundAt', () => {
  it.each([
    [2, 10, 'lawn'], [4.5, 10, 'walk'], [5, 10, 'kerb'], [6, 10, 'road'], [7, 10.5, 'dash'], [7, 11.5, 'road'],
    [9, 10, 'kerb'], [9.5, 10, 'walk'], [12, 10, 'lawn'],
  ])('c %s, s %s is %s', (c, s, kind) => {
    expect(groundAt(100, c, s)).toBe(kind);
  });
  it('is null off the street', () => {
    expect(groundAt(100, -1, 10)).toBeNull();
    expect(groundAt(100, 14, 10)).toBeNull();
    expect(groundAt(100, 7, 100)).toBeNull();
    expect(groundAt(100, 7, -0.1)).toBeNull();
  });
});

describe('pixelKind', () => {
  it('reads the top surface under a pixel', () => {
    const [x, y] = px(100, 6, 10);
    expect(pixelKind(100, x, y)?.kind).toBe('road');
  });
  it('finds the right-hand earth side below the c = 14 edge', () => {
    const [x, y] = px(100, 14, 50, -0.25);
    expect(pixelKind(100, x, y)?.kind).toBe('sideR');
  });
  it('finds the near-end earth side below s = 0', () => {
    const [x, y] = px(100, 7, 0, -0.25);
    expect(pixelKind(100, x, y)?.kind).toBe('sideL');
  });
  it('is empty sky off the street', () => {
    const [x, y] = px(100, -3, 50);
    expect(pixelKind(100, x, y)).toBeNull();
  });
});

describe('chunks', () => {
  it('splits the street into 16-tile chunks', () => {
    expect(chunkCount(140)).toBe(9);
    expect(chunkRange(140, 0)).toEqual([0, 16]);
    expect(chunkRange(140, 8)).toEqual([128, 140]);
  });
  it('owns each pixel by its s, clamped to the street', () => {
    expect(ownerChunk(100, ...px(100, 7, 17))).toBe(1);
    expect(ownerChunk(100, ...px(100, 7, -3))).toBe(0);
    expect(ownerChunk(100, ...px(100, 7, 120))).toBe(6);
  });
  it('bakes two wind frames sized to its bounds', () => {
    const b = bakeChunk(40, 1);
    const r = chunkBounds(40, 1);
    expect([b.x, b.y, b.width, b.height]).toEqual([r.x, r.y, r.width, r.height]);
    expect(b.frames).toHaveLength(2);
    expect(b.frames[0]).toHaveLength(r.width * r.height * 4);
  });
  it('paints only the pixels it owns', () => {
    const b = bakeChunk(40, 1);
    const [ix, iy] = px(40, 6, 20).map(Math.floor);
    const [ox, oy] = px(40, 6, 33).map(Math.floor);
    expect(painted(b, ix, iy)).toBe(1);
    expect(painted(b, ox, oy)).toBe(0);
  });
  it('tiles seamlessly: each street pixel near a seam is painted by exactly one chunk', () => {
    const a = bakeChunk(40, 0);
    const b = bakeChunk(40, 1);
    for (const c of [0.5, 3, 4.5, 7, 9.5, 13]) {
      for (const s of [15.6, 15.9, 16.1, 16.4]) {
        const [wx, wy] = px(40, c, s).map(Math.floor);
        expect(painted(a, wx, wy) + painted(b, wx, wy), `c ${c} s ${s}`).toBe(1);
      }
    }
  });
});
```

- [ ] **Step 5: Run the test to see it fail**

Run: `npx vitest run games/paper-route/tests/unit/street-bake.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 6: Implement the street bake**

`games/paper-route/src/render/street-bake.ts`:
```ts
import { STREET_WIDTH, STRIPS } from '../world/street';
import { hash2, rampLevel, valueNoise } from './dither';
import { ORIGIN, project, TILE_H, TILE_W, unproject, Z_PX } from './iso';
import { parseHex, type RGB } from './palette';

export const CHUNK_TILES = 16;
export const WIND_FRAMES = 2;
/** How far below the street its earth sides hang, tiles. */
const SIDE_Z = -0.5;
const FRINGE_R = 4;
/** A chunk buffer reaches this far past its own geometry, so the fringe and sides see full neighbourhoods. */
const PAD = 2 * FRINGE_R + 1;
const KERB_HALF = 0.07;
const DASH_HALF = 0.06;
const ROAD_MID = (STRIPS.road[0] + STRIPS.road[1]) / 2;

export type Kind = 'lawn' | 'walk' | 'kerb' | 'road' | 'dash' | 'sideL' | 'sideR';
const KINDS: readonly Kind[] = ['lawn', 'walk', 'kerb', 'road', 'dash', 'sideL', 'sideR'];
const LAWN = 0;

const hexes = (...h: string[]): RGB[] => h.map(parseHex);
export const RAMPS: Readonly<Record<Kind | 'fringe', readonly RGB[]>> = {
  lawn: hexes('#3f6b3a', '#4f8a4c', '#6fae5c', '#8fca6c', '#b5e08a'),
  walk: hexes('#8a8a96', '#b8b8c4', '#efe6d2'),
  kerb: hexes('#4a4a5a', '#8a8a96'),
  road: hexes('#2c2c3a', '#4a4a5a', '#8a8a96'),
  dash: hexes('#f2c25b', '#efe6d2'),
  sideL: hexes('#2e2420', '#4a3b2e', '#6b4f3a'),
  sideR: hexes('#14141c', '#2e2420', '#4a3b2e'),
  fringe: hexes('#1f3a2c', '#2f5530', '#3f6b3a', '#5e8c45'),
};
const SHADE: Readonly<Record<Kind, number>> = { lawn: 0.55, walk: 0.5, kerb: 0.4, road: 0.45, dash: 0.6, sideL: 0.5, sideR: 0.5 };

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ChunkBake extends PixelRect {
  readonly index: number;
  /** RGBA pixels, one buffer per wind frame; transparent where another chunk owns the pixel. */
  readonly frames: readonly Uint8ClampedArray[];
}

/** The ground surface at a street point, or null off the street. */
export function groundAt(length: number, c: number, s: number): Kind | null {
  if (c < 0 || c >= STREET_WIDTH || s < 0 || s >= length) return null;
  if (c < STRIPS.walkL[0] || c >= STRIPS.walkR[1]) return 'lawn';
  if (Math.abs(c - STRIPS.road[0]) < KERB_HALF || Math.abs(c - STRIPS.road[1]) < KERB_HALF) return 'kerb';
  if (c < STRIPS.road[0] || c >= STRIPS.road[1]) return 'walk';
  if (Math.abs(c - ROAD_MID) < DASH_HALF && s % 2 < 1) return 'dash';
  return 'road';
}

export interface PixelHit {
  readonly kind: Kind;
  readonly c: number;
  readonly s: number;
}

/** What the street shows at world pixel (wx, wy): top surface, a front-facing earth side, or null for sky. */
export function pixelKind(length: number, wx: number, wy: number): PixelHit | null {
  const [x, y] = unproject(ORIGIN, wx, wy, 0);
  const top = groundAt(length, x, length - y);
  if (top) return { kind: top, c: x, s: length - y };
  // The long right edge: the plane x = STREET_WIDTH, hanging down to SIDE_Z.
  const ry = STREET_WIDTH - wx / (TILE_W / 2);
  const rz = ((STREET_WIDTH + ry) * (TILE_H / 2) - wy) / Z_PX;
  if (ry >= 0 && ry <= length && rz >= SIDE_Z && rz <= 0) return { kind: 'sideR', c: STREET_WIDTH, s: length - ry };
  // The near end: the plane y = length (s = 0).
  const fx = wx / (TILE_W / 2) + length;
  const fz = ((fx + length) * (TILE_H / 2) - wy) / Z_PX;
  if (fx >= 0 && fx <= STREET_WIDTH && fz >= SIDE_Z && fz <= 0) return { kind: 'sideL', c: fx, s: 0 };
  return null;
}

export const chunkCount = (length: number): number => Math.ceil(length / CHUNK_TILES);

export const chunkRange = (length: number, index: number): [number, number] =>
  [index * CHUNK_TILES, Math.min(length, (index + 1) * CHUNK_TILES)];

/** Which chunk draws world pixel (wx, wy): decided by the s its centre unprojects to at height 0. */
export function ownerChunk(length: number, wx: number, wy: number): number {
  const s = length - unproject(ORIGIN, wx, wy, 0)[1];
  return Math.max(0, Math.min(chunkCount(length) - 1, Math.floor(s / CHUNK_TILES)));
}

export function chunkBounds(length: number, index: number): PixelRect {
  const [s0, s1] = chunkRange(length, index);
  const pts = [0, STREET_WIDTH].flatMap((c) => [s0, s1].flatMap((s) => [0, SIDE_Z].map((z) => project(ORIGIN, c, length - s, z))));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.floor(Math.min(...xs)) - PAD;
  const y = Math.floor(Math.min(...ys)) - PAD;
  return { x, y, width: Math.ceil(Math.max(...xs)) + PAD - x, height: Math.ceil(Math.max(...ys)) + PAD - y };
}

function shadeOf(p: PixelHit): number {
  if (p.kind !== 'lawn') return SHADE[p.kind];
  return SHADE.lawn + ((Math.floor(p.c) + Math.floor(p.s)) % 2 === 0 ? 0.06 : -0.04); // mowing stripes
}

/** Distance (px) from each empty pixel to the nearest lawn pixel, 0 if farther than the fringe radius. */
function fringeDistances(kind: Int8Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (kind[y * w + x] >= 0) continue;
      let best = Infinity;
      for (let dy = -FRINGE_R; dy <= FRINGE_R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -FRINGE_R; dx <= FRINGE_R; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < w && kind[yy * w + xx] === LAWN) best = Math.min(best, Math.hypot(dx, dy));
        }
      }
      out[y * w + x] = best <= FRINGE_R ? best : 0;
    }
  }
  return out;
}

function put(out: Uint8ClampedArray, i: number, c: RGB): void {
  out[i * 4] = c[0];
  out[i * 4 + 1] = c[1];
  out[i * 4 + 2] = c[2];
  out[i * 4 + 3] = 255;
}

interface Classified {
  readonly kind: Int8Array;
  readonly shade: Float32Array;
  readonly own: Uint8Array;
  readonly fringe: Float32Array;
}

function classify(length: number, index: number, b: PixelRect): Classified {
  const n = b.width * b.height;
  const kind = new Int8Array(n).fill(-1);
  const shade = new Float32Array(n);
  const own = new Uint8Array(n);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const i = y * b.width + x;
      const wx = b.x + x + 0.5;
      const wy = b.y + y + 0.5;
      own[i] = ownerChunk(length, wx, wy) === index ? 1 : 0;
      const p = pixelKind(length, wx, wy);
      if (p) {
        kind[i] = KINDS.indexOf(p.kind);
        shade[i] = shadeOf(p);
      }
    }
  }
  return { kind, shade, own, fringe: fringeDistances(kind, b.width, b.height) };
}

function colorize(b: PixelRect, k: Classified, frame: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(b.width * b.height * 4);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const i = y * b.width + x;
      if (!k.own[i]) continue;
      const gx = b.x + x; // world pixel: noise and dither line up across chunks
      const gy = b.y + y;
      if (k.kind[i] >= 0) {
        const ramp = RAMPS[KINDS[k.kind[i]]];
        const noise = valueNoise(gx, gy, 7, 3) - 0.5;
        put(out, i, ramp[rampLevel(k.shade[i] + noise * 0.3, ramp.length, gx, gy)]);
      } else if (k.fringe[i] > 0) {
        const p = 1 - k.fringe[i] / (FRINGE_R + 1);
        const sway = frame === 1 && hash2(gx, gy, 5) < 0.35 ? 1 : 0;
        if (hash2(gx - sway, gy, 11) < p * 0.85) put(out, i, RAMPS.fringe[rampLevel(p, RAMPS.fringe.length, gx, gy)]);
      }
    }
  }
  return out;
}

/** Bakes one 16-tile chunk of the street (both wind frames). */
export function bakeChunk(length: number, index: number): ChunkBake {
  const b = chunkBounds(length, index);
  const k = classify(length, index, b);
  return { index, ...b, frames: Array.from({ length: WIND_FRAMES }, (_, f) => colorize(b, k, f)) };
}
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npx vitest run games/paper-route/tests/unit/street-bake.test.ts games/paper-route/tests/unit/post.test.ts`
Expected: PASS.

If the seam test fails at `c 0.5` or `c 13` because the floored pixel's centre falls just off the lawn, change those two values to `1` and `12.5`. Don't relax the "exactly one" assertion.

- [ ] **Step 8: Commit**

```bash
git add games/paper-route/src/render games/paper-route/tests/unit
git commit -m "feat: add the daylight post pass and the chunked street bake"
```

---

### Task 13: Camera and chunk visibility/cache

**Files:**
- Create: `PR/src/render/camera.ts`, `PR/src/render/chunks.ts`
- Test: `PR/tests/unit/camera.test.ts`, `PR/tests/unit/chunks.test.ts`

- [ ] **Step 1: Write the failing tests**

`games/paper-route/tests/unit/camera.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BIKE_ANCHOR, cameraTarget, followCamera, snapCamera, viewOf } from '../../src/render/camera';
import { streetPx } from '../../src/render/iso';

describe('camera', () => {
  it('puts the road middle at the bike anchor in the buffer', () => {
    expect(streetPx(viewOf(cameraTarget(140, 50)), 140, 7, 50)).toEqual([...BIKE_ANCHOR]);
  });
  it('moves up-right as the bike rides forward', () => {
    const a = cameraTarget(140, 50);
    const b = cameraTarget(140, 51);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeLessThan(a.y);
  });
  it('eases toward the target and converges', () => {
    const step = followCamera({ x: 0, y: 0 }, { x: 100, y: -50 }, 1 / 60);
    expect(step.x).toBeGreaterThan(0);
    expect(step.x).toBeLessThan(100);
    let cam = { x: 0, y: 0 };
    for (let i = 0; i < 300; i++) cam = followCamera(cam, { x: 100, y: -50 }, 1 / 60);
    expect(cam.x).toBeCloseTo(100, 3);
    expect(cam.y).toBeCloseTo(-50, 3);
    expect(followCamera({ x: 3, y: 4 }, { x: 100, y: 0 }, 0)).toEqual({ x: 3, y: 4 });
  });
  it('snaps to whole pixels', () => {
    expect(snapCamera({ x: 10.4, y: -3.6 })).toEqual({ x: 10, y: -4 });
  });
});
```

`games/paper-route/tests/unit/chunks.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { cameraTarget, snapCamera } from '../../src/render/camera';
import { createChunkCache, visibleChunks } from '../../src/render/chunks';

describe('visibleChunks', () => {
  it('sees the first chunks at the start, far chunks first', () => {
    const v = visibleChunks(140, snapCamera(cameraTarget(140, 2)), 360, 270);
    expect(v).toContain(0);
    expect(v).not.toContain(8);
    expect([...v].sort((a, b) => b - a)).toEqual(v);
  });
  it('follows the bike down the street', () => {
    const v = visibleChunks(140, snapCamera(cameraTarget(140, 100)), 360, 270);
    expect(v).toContain(6);
    expect(v).not.toContain(0);
  });
});

describe('createChunkCache', () => {
  it('bakes each chunk once until it is evicted', () => {
    const bake = vi.fn((i: number) => `chunk ${i}`);
    const cache = createChunkCache(bake);
    expect(cache.get(1)).toBe('chunk 1');
    expect(cache.get(1)).toBe('chunk 1');
    expect(bake).toHaveBeenCalledTimes(1);
    cache.get(2);
    cache.keepOnly([2]);
    expect(cache.size).toBe(1);
    cache.get(1);
    expect(bake).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run games/paper-route/tests/unit/camera.test.ts games/paper-route/tests/unit/chunks.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the camera**

`games/paper-route/src/render/camera.ts`:
```ts
import { STRIPS } from '../world/street';
import { ORIGIN, streetPx, type View } from './iso';

/** World pixel at the buffer's top-left corner. */
export interface Camera {
  readonly x: number;
  readonly y: number;
}

/** Where the road under the bike sits in the 360×270 buffer: lower left, so the street ahead (up-right) is in view. */
export const BIKE_ANCHOR = [120, 185] as const;
const ROAD_MID = (STRIPS.road[0] + STRIPS.road[1]) / 2;
const FOLLOW_RATE = 8;

/** The camera follows the bike's s only, so drifting across the road doesn't shake the view. */
export function cameraTarget(length: number, s: number): Camera {
  const [px, py] = streetPx(ORIGIN, length, ROAD_MID, s);
  return { x: px - BIKE_ANCHOR[0], y: py - BIKE_ANCHOR[1] };
}

export function followCamera(cam: Camera, target: Camera, dt: number, rate = FOLLOW_RATE): Camera {
  const k = 1 - Math.exp(-rate * Math.max(0, dt));
  return { x: cam.x + (target.x - cam.x) * k, y: cam.y + (target.y - cam.y) * k };
}

export const snapCamera = (cam: Camera): Camera => ({ x: Math.round(cam.x), y: Math.round(cam.y) });

export const viewOf = (cam: Camera): View => ({ ox: -cam.x, oy: -cam.y });
```

- [ ] **Step 4: Implement the chunk visibility and cache**

`games/paper-route/src/render/chunks.ts`:
```ts
import type { Camera } from './camera';
import { chunkBounds, chunkCount } from './street-bake';

/** Indices of chunks overlapping the camera's buffer, far (high s) first. */
export function visibleChunks(length: number, cam: Camera, width: number, height: number): number[] {
  const out: number[] = [];
  for (let i = chunkCount(length) - 1; i >= 0; i--) {
    const b = chunkBounds(length, i);
    if (b.x < cam.x + width && b.x + b.width > cam.x && b.y < cam.y + height && b.y + b.height > cam.y) out.push(i);
  }
  return out;
}

export interface ChunkCache<T> {
  get(index: number): T;
  /** Drop every cached chunk not listed. */
  keepOnly(keep: readonly number[]): void;
  readonly size: number;
}

export function createChunkCache<T>(bake: (index: number) => T): ChunkCache<T> {
  const cache = new Map<number, T>(); // a cache: mutated on purpose
  return {
    get(index) {
      const hit = cache.get(index);
      if (hit !== undefined) return hit;
      const baked = bake(index);
      cache.set(index, baked);
      return baked;
    },
    keepOnly(keep) {
      for (const k of [...cache.keys()]) if (!keep.includes(k)) cache.delete(k);
    },
    get size() {
      return cache.size;
    },
  };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run games/paper-route/tests/unit/camera.test.ts games/paper-route/tests/unit/chunks.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add games/paper-route/src/render games/paper-route/tests/unit
git commit -m "feat: add the follow camera and the chunk cache"
```

---

### Task 14: Assets, content loading and the renderer

**Files:**
- Create: `PR/src/render/assets.ts`, `PR/src/content.ts`, `PR/src/render/renderer.ts`
- Test: `PR/tests/unit/renderer.test.ts` (for the pure helper only)

The canvas code is checked by eye in Task 16. Only the pure `houseSpot` and `houseSprite` helpers get unit tests.

- [ ] **Step 1: Write the failing helper test**

`games/paper-route/tests/unit/renderer.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { houseSpot, houseSprite } from '../../src/render/renderer';
import { parseStreet } from '../../src/world/street';
import { rawStreet } from '../helpers/make-street';

const [left, right] = parseStreet(rawStreet()).lots;

describe('houses', () => {
  it('stands behind the porch, on the far side of the lawn from the street', () => {
    expect(houseSpot(left)).toEqual([1, 10]);
    expect(houseSpot(right)).toEqual([13, 10]);
    expect(houseSpot(left)[0]).toBeLessThan(left.porch.c0);
    expect(houseSpot(right)[0]).toBeGreaterThan(right.porch.c1);
  });
  it('uses the sprite facing the street for each side', () => {
    expect(houseSprite(left)).toBe('house-a-l');
    expect(houseSprite(right)).toBe('house-b-r');
  });
});
```

Run: `npx vitest run games/paper-route/tests/unit/renderer.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Implement asset loading**

`games/paper-route/src/render/assets.ts`:
```ts
import type { Manifest } from '../world/manifest';
import type { ChunkBake } from './street-bake';

/** One canvas per wind frame of a baked chunk. */
export function bakeToCanvases(bake: ChunkBake): HTMLCanvasElement[] {
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

/** Loads every manifest sprite that has an image. A listed image with no file warns and falls back to its placeholder. */
export async function loadSprites(manifest: Manifest): Promise<Map<string, HTMLImageElement>> {
  const entries = await Promise.all(Object.entries(manifest).flatMap(([name, def]) => {
    if (!def.image) return [];
    const url = spriteUrl(def.image.src);
    if (!url) {
      console.warn(`manifest: ${name}.image file assets/sprites/${def.image.src} is missing; drawing its placeholder`);
      return [];
    }
    return [loadImage(url).then((img) => [name, img] as const)];
  }));
  return new Map(entries);
}
```

- [ ] **Step 3: Implement content loading**

`games/paper-route/src/content.ts`:
```ts
import manifestJson from '../assets/manifest.json';
import paletteJson from '../assets/palette.json';
import { loadImage, loadSprites, spriteUrl } from './render/assets';
import { createPalette, type Palette } from './render/palette';
import { parseManifest, type Manifest } from './world/manifest';
import { parseRider, type RiderLayout } from './world/rider';
import { parseStreet, type Street } from './world/street';
import streetJson from './world/streets/maple-lane.json';

export const BUF_W = 360;
export const BUF_H = 270;

/** Present only once the rider art has been ingested (Task 17). */
const RIDER_JSON = import.meta.glob('../assets/rider.json', { eager: true, import: 'default' }) as Record<string, unknown>;

export interface Rider {
  readonly layout: RiderLayout;
  readonly image: HTMLImageElement;
}

export interface Content {
  readonly street: Street;
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
  if (!url) throw new Error(`rider: assets/sprites/${layout.src} is missing`);
  return { layout, image: await loadImage(url) };
}

export async function loadContent(): Promise<Content> {
  const manifest = parseManifest(manifestJson);
  const [sprites, rider] = await Promise.all([loadSprites(manifest), loadRider()]);
  return { street: parseStreet(streetJson), manifest, palette: createPalette(paletteJson), sprites, rider };
}
```

- [ ] **Step 4: Implement the renderer**

`games/paper-route/src/render/renderer.ts`:
```ts
import type { Content } from '../content';
import type { GameState } from '../game/state';
import { sprinklerOn } from '../sim/hazards';
import { paperPos } from '../sim/paper';
import { riderDir } from '../world/rider';
import { LAWN_WIDTH, LOT_LENGTH, lotOriginC, type Lot } from '../world/street';
import { viewOf, type Camera } from './camera';
import { depthOf, sortByDepth, streetPx, type View } from './iso';
import { chunkBounds } from './street-bake';

/** The sky behind the floating street. The page is painted the same colour after the post pass. */
export const BACKGROUND = '#9fd8ee';
const OUTLINE = '#14141c';
const SHADOW = 'rgba(20, 20, 28, 0.35)';
const MISSING = { color: '#ff00ff', w: 6, h: 6 };
/** How far from the lawn's outer edge a house stands, tiles, so its porch sits between it and the street. */
const HOUSE_INSET = 1;

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
}

interface Drawable {
  readonly depth: number;
  readonly draw: () => void;
}

export function houseSpot(lot: Lot): [number, number] {
  const c = lot.side === 'L' ? lotOriginC('L') + HOUSE_INSET : lotOriginC('R') + LAWN_WIDTH - HOUSE_INSET;
  return [c, lot.s + LOT_LENGTH / 2];
}

export const houseSprite = (lot: Lot): string => `${lot.house}-${lot.side === 'L' ? 'l' : 'r'}`;

function screen(scene: Scene, view: View, c: number, s: number, z = 0): [number, number] {
  const [x, y] = streetPx(view, scene.content.street.length, c, s, z);
  return [Math.round(x), Math.round(y)];
}

function drawSprite(ctx: CanvasRenderingContext2D, scene: Scene, view: View, name: string, c: number, s: number, z = 0, frame?: number): void {
  const def = scene.content.manifest[name];
  const img = scene.content.sprites.get(name);
  const [px, py] = screen(scene, view, c, s, z);
  if (def?.image && img) {
    const { anchor, frames, fps } = def.image;
    const cw = Math.floor(img.width / frames);
    const f = (frame ?? Math.floor(scene.time * fps)) % frames;
    ctx.drawImage(img, f * cw, 0, cw, img.height, px - anchor[0], py - anchor[1], cw, img.height);
    return;
  }
  const ph = def?.placeholder ?? MISSING;
  const x = Math.round(px - ph.w / 2);
  ctx.fillStyle = OUTLINE;
  ctx.fillRect(x - 1, py - ph.h - 1, ph.w + 2, ph.h + 2);
  ctx.fillStyle = ph.color;
  ctx.fillRect(x, py - ph.h, ph.w, ph.h);
}

function shadow(ctx: CanvasRenderingContext2D, scene: Scene, view: View, c: number, s: number, rx: number): void {
  const [px, py] = screen(scene, view, c, s);
  ctx.fillStyle = SHADOW;
  ctx.beginPath();
  ctx.ellipse(px, py, rx, rx / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBike(ctx: CanvasRenderingContext2D, scene: Scene, view: View): void {
  const { bike } = scene.state;
  if (bike.wobble <= 0 && bike.invuln > 0 && Math.floor(scene.time * 10) % 2 === 1) return; // blink while invulnerable
  const shake = bike.wobble > 0 || scene.state.inSpray ? Math.round(Math.sin(scene.time * 40)) : 0;
  shadow(ctx, scene, view, bike.c, bike.s, 6);
  const [x, py] = screen(scene, view, bike.c, bike.s);
  const px = x + shake;
  const rider = scene.content.rider;
  if (!rider) {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(px - 5, py - 21, 10, 22);
    ctx.fillStyle = '#c8463c';
    ctx.fillRect(px - 4, py - 20, 8, 20);
    return;
  }
  const { layout, image } = rider;
  const row = layout.rows[riderDir(bike.lean)];
  const f = Math.floor(scene.time * layout.fps) % layout.frames;
  const [cw, ch] = layout.cell;
  ctx.drawImage(image, f * cw, row * ch, cw, ch, px - layout.anchor[0], py - layout.anchor[1], cw, ch);
}

/** Flat things on the ground, drawn under every standing sprite. */
function drawDecals(ctx: CanvasRenderingContext2D, scene: Scene, view: View): void {
  for (const h of scene.content.street.hazards) if (h.kind === 'puddle') drawSprite(ctx, scene, view, 'puddle', h.at[0], h.at[1]);
  for (const [c, s] of scene.state.landed) drawSprite(ctx, scene, view, 'paper', c, s, 0, 0);
}

function standing(ctx: CanvasRenderingContext2D, scene: Scene, view: View): Drawable[] {
  const { street } = scene.content;
  const st = scene.state;
  const at = (name: string, c: number, s: number): Drawable => ({ depth: depthOf(street.length, c, s), draw: () => drawSprite(ctx, scene, view, name, c, s) });
  const lots = street.lots.flatMap((lot) => {
    const [hc, hs] = houseSpot(lot);
    return [at(houseSprite(lot), hc, hs), at(lot.subscriber ? 'mailbox-sub' : 'mailbox-plain', lot.mailbox[0], lot.mailbox[1])];
  });
  const hazards = street.hazards.flatMap((h) => {
    if (h.kind === 'car') return [at('car', h.at[0], h.at[1])];
    if (h.kind !== 'sprinkler') return [];
    const head = at('sprinkler', h.at[0], h.at[1]);
    return sprinklerOn(st.time) ? [head, at('spray', (h.spray.c0 + h.spray.c1) / 2, (h.spray.s0 + h.spray.s1) / 2)] : [head];
  });
  const bundles = street.bundles.flatMap((b, i) => (st.bundlesTaken.includes(i) ? [] : [at('bundle', b[0], b[1])]));
  const dog = at(st.dog.mode === 'chase' || st.dog.mode === 'return' ? 'dog-run' : 'dog-sit', st.dog.c, st.dog.s);
  const papers = st.flying.map((p): Drawable => {
    const pos = paperPos(p);
    return {
      depth: depthOf(street.length, pos.c, pos.s),
      draw: () => {
        shadow(ctx, scene, view, pos.c, pos.s, 3);
        drawSprite(ctx, scene, view, 'paper', pos.c, pos.s, pos.z);
      },
    };
  });
  const bike: Drawable = { depth: depthOf(street.length, st.bike.c, st.bike.s), draw: () => drawBike(ctx, scene, view) };
  return [...lots, ...street.props.map((p) => at(p.kind, p.at[0], p.at[1])), ...hazards, ...bundles, dog, ...papers, bike];
}

export function renderFrame(ctx: CanvasRenderingContext2D, scene: Scene): void {
  const view = viewOf(scene.cam);
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, scene.width, scene.height);
  for (const i of scene.visible) {
    const b = chunkBounds(scene.content.street.length, i);
    ctx.drawImage(scene.chunk(i), b.x - scene.cam.x, b.y - scene.cam.y);
  }
  drawDecals(ctx, scene, view);
  for (const d of sortByDepth(standing(ctx, scene, view))) d.draw();
}
```

`streetPx`'s `Vec2` destructures to numbers, which keeps `screen` simple. Every drawable is created fresh each frame, which costs about 70 small objects per frame and is fine at this scale.

- [ ] **Step 5: Run the helper test and the type check**

Run: `npx vitest run games/paper-route/tests/unit/renderer.test.ts && npx tsc --noEmit`
Expected: PASS, with no type errors. If `import.meta.glob` is flagged, check that `tsconfig.json` still lists `"vite/client"` in `types`.

- [ ] **Step 6: Commit**

```bash
git add games/paper-route/src
git add games/paper-route/tests/unit/renderer.test.ts
git commit -m "feat: add Paper Route asset loading, content and renderer"
```

---
### Task 15: HUD and sound effects

**Files:**
- Create: `PR/src/ui/hud-text.ts`, `PR/src/ui/hud.ts`, `PR/src/audio/sfx-math.ts`, `PR/src/audio/sfx.ts`
- Modify: `PR/src/style.css`
- Test: `PR/tests/unit/hud-text.test.ts`, `PR/tests/unit/sfx-math.test.ts`

- [ ] **Step 1: Write the failing tests**

`games/paper-route/tests/unit/hud-text.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { endTitle, helmetsText, percent, popupText } from '../../src/ui/hud-text';

describe('hud text', () => {
  it('shows helmets left as filled and empty pips', () => {
    expect(helmetsText(3)).toBe('●●●');
    expect(helmetsText(1)).toBe('●○○');
    expect(helmetsText(0)).toBe('○○○');
  });
  it('titles the end card by outcome', () => {
    expect(endTitle('finished')).toBe('Route complete!');
    expect(endTitle('wiped')).toBe('Wiped out!');
  });
  it('formats accuracy as a whole percent', () => {
    expect(percent(0.756)).toBe('76%');
  });
  it('flashes the latest scoring event of the frame', () => {
    expect(popupText([])).toBeNull();
    expect(popupText([{ type: 'toss' }])).toBeNull();
    expect(popupText([{ type: 'deliver', hit: 'porch', lot: 0, points: 250 }])).toBe('+250');
    expect(popupText([{ type: 'deliver', hit: 'mailbox', lot: 0, points: 500 }])).toBe('Mailbox! +500');
    expect(popupText([{ type: 'deliver', hit: 'porch', lot: 0, points: 250 }, { type: 'wrong', lot: 1, points: -100 }])).toBe('Hey! -100');
    expect(popupText([{ type: 'treat', points: 50 }])).toBe('Good dog! +50');
    expect(popupText([{ type: 'pickup' }])).toBe('+5 papers');
    expect(popupText([{ type: 'crash' }])).toBe('Ouch!');
  });
});
```

`games/paper-route/tests/unit/sfx-math.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { soundsFor } from '../../src/audio/sfx-math';

describe('soundsFor', () => {
  it('maps events to sounds, each once, in order', () => {
    expect(soundsFor([
      { type: 'toss' }, { type: 'toss' },
      { type: 'deliver', hit: 'mailbox', lot: 0, points: 500 },
      { type: 'deliver', hit: 'porch', lot: 1, points: 250 },
      { type: 'wrong', lot: 2, points: -100 },
      { type: 'splash' }, { type: 'spray' }, { type: 'finish', bonus: 0 },
    ])).toEqual(['toss', 'ding', 'thwack', 'bark', 'splash', 'fanfare']);
  });
  it('plays nothing for no events', () => {
    expect(soundsFor([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run games/paper-route/tests/unit/hud-text.test.ts games/paper-route/tests/unit/sfx-math.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the pure helpers**

`games/paper-route/src/ui/hud-text.ts`:
```ts
import type { GameEvent, Outcome } from '../game/state';
import { CRASH, PAPERS } from '../sim/constants';

export const helmetsText = (n: number, max: number = CRASH.helmets): string =>
  '●'.repeat(Math.max(0, n)) + '○'.repeat(Math.max(0, max - n));

export const endTitle = (o: Outcome | null): string => (o === 'finished' ? 'Route complete!' : 'Wiped out!');

export const percent = (v: number): string => `${Math.round(v * 100)}%`;

function eventText(e: GameEvent): string | null {
  switch (e.type) {
    case 'deliver': return e.hit === 'mailbox' ? `Mailbox! +${e.points}` : `+${e.points}`;
    case 'wrong': return `Hey! ${e.points}`;
    case 'treat': return `Good dog! +${e.points}`;
    case 'pickup': return `+${PAPERS.bundle} papers`;
    case 'crash': return 'Ouch!';
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
```

`games/paper-route/src/audio/sfx-math.ts`:
```ts
import type { GameEvent } from '../game/state';

export type Sound = 'toss' | 'thwack' | 'ding' | 'bark' | 'splash' | 'crash' | 'pickup' | 'dry' | 'land' | 'fanfare';

function soundOf(e: GameEvent): Sound {
  switch (e.type) {
    case 'deliver': return e.hit === 'mailbox' ? 'ding' : 'thwack';
    case 'wrong': case 'bark': return 'bark';
    case 'thunk': return 'thwack';
    case 'treat': case 'pickup': return 'pickup';
    case 'splash': case 'spray': return 'splash';
    case 'crash': case 'wiped': return 'crash';
    case 'finish': return 'fanfare';
    default: return e.type; // toss, dry, land share their sound's name
  }
}

/** The sounds a frame's events trigger, each at most once, in first-seen order. */
export const soundsFor = (events: readonly GameEvent[]): Sound[] => [...new Set(events.map(soundOf))];
```

Run: `npx vitest run games/paper-route/tests/unit/hud-text.test.ts games/paper-route/tests/unit/sfx-math.test.ts && npx tsc --noEmit`
Expected: PASS. In `soundOf`, the `default` branch only sees `'toss' | 'dry' | 'land'`, so `return e.type` type-checks as a `Sound`.

- [ ] **Step 4: Implement the sounds**

`games/paper-route/src/audio/sfx.ts`:
```ts
import type { Sound } from './sfx-math';

/** Sound effects only: there is deliberately no background music or ambience. */
export interface Sfx {
  /** Call from a user gesture: browsers only allow audio to start after one. */
  unlock(): void;
  play(sound: Sound): void;
}

interface Graph {
  readonly ac: AudioContext;
  readonly master: GainNode;
  readonly noise: AudioBuffer;
}

const SILENT: Sfx = { unlock() {}, play() {} };

function noiseBuffer(ac: AudioContext): AudioBuffer {
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const ch = buf.getChannelData(0);
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

const RECIPES: Readonly<Record<Sound, (g: Graph) => void>> = {
  toss: (g) => hiss(g, 0.12, 'bandpass', 1800, 0.25),
  thwack: (g) => { hiss(g, 0.08, 'lowpass', 900, 0.5); tone(g, 140, 0.1, 'triangle', 0.3); },
  ding: (g) => { tone(g, 1320, 0.5, 'sine', 0.3); tone(g, 1980, 0.35, 'sine', 0.12, 0.02); },
  bark: (g) => { tone(g, 520, 0.09, 'square', 0.15, 0, 300); tone(g, 480, 0.1, 'square', 0.15, 0.14, 260); },
  splash: (g) => hiss(g, 0.35, 'highpass', 1200, 0.3),
  crash: (g) => { hiss(g, 0.4, 'lowpass', 600, 0.6); tone(g, 90, 0.35, 'sawtooth', 0.25, 0, 40); },
  pickup: (g) => [660, 880, 1100].forEach((f, i) => tone(g, f, 0.12, 'square', 0.1, i * 0.06)),
  dry: (g) => tone(g, 200, 0.05, 'square', 0.08),
  land: (g) => hiss(g, 0.05, 'lowpass', 500, 0.2),
  fanfare: (g) => [523, 659, 784, 1047].forEach((f, i) => tone(g, f, 0.25, 'triangle', 0.2, i * 0.12)),
};

export function createSfx(): Sfx {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return SILENT;
  let graph: Graph | null = null;
  return {
    unlock() {
      if (graph) return;
      try {
        const ac = new AC();
        const master = ac.createGain();
        master.gain.value = 0.7;
        master.connect(ac.destination);
        graph = { ac, master, noise: noiseBuffer(ac) };
      } catch (err) {
        console.warn('Audio is unavailable:', err);
      }
    },
    play(sound) {
      if (!graph) return;
      try {
        RECIPES[sound](graph);
      } catch (err) {
        console.warn(`Sound "${sound}" failed:`, err);
      }
    },
  };
}
```

- [ ] **Step 5: Implement the HUD**

`games/paper-route/src/ui/hud.ts`:
```ts
import { accuracy } from '../game/score';
import type { GameState } from '../game/state';
import type { Street } from '../world/street';
import { endTitle, helmetsText, percent, popupText } from './hud-text';

export interface Hud {
  update(state: GameState, street: Street, best: number, time: number): void;
  showError(message: string): void;
}

const POPUP_SECONDS = 0.8;

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

/** A centred overlay with a card; returns [overlay, card]. */
function overlay(root: HTMLElement, name: string): [HTMLElement, HTMLElement] {
  const o = el('div', `overlay ${name}`, root);
  return [o, el('div', 'card', o)];
}

const setText = (e: HTMLElement, text: string) => {
  if (e.textContent !== text) e.textContent = text;
};

function row(table: HTMLElement, label: string): HTMLElement {
  const tr = el('tr', '', table);
  el('th', '', tr, label);
  return el('td', '', tr);
}

export function createHud(root: HTMLElement): Hud {
  const bar = el('div', 'bar', root);
  const stats = { score: stat(bar, 'score'), papers: stat(bar, 'papers'), delivered: stat(bar, 'delivered'), helmets: stat(bar, 'helmets') };
  const popup = el('div', 'popup', root);
  el('div', 'hint', root, 'A/D steer · W/S speed · J/K toss left/right · Esc pause');

  const [title, titleCard] = overlay(root, 'title');
  el('h1', '', titleCard, 'Paper Route');
  el('p', '', titleCard, 'Deliver the morning paper down Maple Lane. Mind the dog.');
  el('p', 'keys', titleCard, 'A/D or ←/→ steer · W/S speed · J/Q toss left · K/E toss right');
  const titleBest = el('p', 'best', titleCard);
  el('p', 'cta', titleCard, 'Press Enter to ride');

  const [pause, pauseCard] = overlay(root, 'pause');
  el('h1', '', pauseCard, 'Paused');
  el('p', '', pauseCard, 'Esc to keep riding · R to restart');

  const [end, endCard] = overlay(root, 'end');
  const endHeading = el('h1', '', endCard);
  const table = el('table', '', endCard);
  const cells = { delivered: row(table, 'Deliveries'), accuracy: row(table, 'Accuracy'), score: row(table, 'Score'), best: row(table, 'Best') };
  el('p', 'cta', endCard, 'Press Enter to ride again');

  const [error, errorCard] = overlay(root, 'error');
  const errorText = el('p', '', errorCard);
  let popupUntil = -1;

  return {
    update(s, street, best, time) {
      const subs = street.lots.filter((l) => l.subscriber).length;
      setText(stats.score, String(s.score));
      setText(stats.papers, String(s.papers));
      setText(stats.delivered, `${s.delivered}/${subs}`);
      setText(stats.helmets, helmetsText(s.helmets));
      const msg = popupText(s.events);
      if (msg) {
        popup.textContent = msg;
        popupUntil = time + POPUP_SECONDS;
      }
      popup.classList.toggle('on', s.phase === 'riding' && time < popupUntil);
      bar.classList.toggle('on', s.phase !== 'title');
      title.classList.toggle('on', s.phase === 'title');
      setText(titleBest, `Best: ${best}`);
      pause.classList.toggle('on', s.phase === 'riding' && s.paused);
      end.classList.toggle('on', s.phase === 'over');
      if (s.phase === 'over') {
        setText(endHeading, endTitle(s.outcome));
        setText(cells.delivered, `${s.delivered}/${subs}`);
        setText(cells.accuracy, percent(accuracy(s.delivered, s.throws)));
        setText(cells.score, String(s.score));
        setText(cells.best, String(best));
      }
    },
    showError(message) {
      errorText.textContent = message;
      error.classList.add('on');
    },
  };
}
```

- [ ] **Step 6: Extend the stylesheet**

Append to `games/paper-route/src/style.css`:
```css
.bar {
  position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
  display: none; gap: 28px; padding: 8px 18px; background: var(--panel); border-radius: 10px;
}
.bar.on { display: flex; }
.stat b { display: block; font-size: 18px; color: var(--accent); text-align: center; }
.stat span { font-size: 10px; letter-spacing: .12em; color: var(--muted); text-transform: uppercase; }
.popup {
  position: absolute; top: 22%; left: 50%; transform: translateX(-50%);
  font-size: 24px; font-weight: bold; color: #fffaf0; text-shadow: 0 2px 0 #14141c; visibility: hidden;
}
.popup.on { visibility: visible; }
.hint { position: absolute; bottom: 8px; left: 16px; font-size: 11px; color: var(--muted); }
.overlay { position: absolute; inset: 0; display: none; place-items: center; }
.overlay.on { display: grid; }
.card { background: var(--panel); padding: 24px 32px; border-radius: 12px; text-align: center; min-width: 300px; max-width: 90vw; }
.card h1 { margin: 0 0 8px; color: var(--accent); font-size: 24px; }
.card .keys, .card .best { color: var(--muted); font-size: 12px; }
.card .cta { font-weight: bold; }
table { border-collapse: collapse; margin: 12px auto; }
th, td { padding: 4px 12px; text-align: left; }
```

- [ ] **Step 7: Verify and commit**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS.

```bash
git add games/paper-route/src games/paper-route/tests/unit
git commit -m "feat: add the Paper Route HUD and sound effects"
```

---

### Task 16: Wire it up, end-to-end test, and the first by-eye check

**Files:**
- Modify: `PR/src/main.ts` (replace the stub)
- Create: `PR/tests/e2e/paper-route.spec.ts`, `.claude/launch.json` (only if it doesn't exist; otherwise add a configuration)

- [ ] **Step 1: Write the end-to-end test**

`games/paper-route/tests/e2e/paper-route.spec.ts`:
```ts
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
```

Run: `npx playwright test --project=paper-route`
Expected: FAIL. The stub page has no HUD, so `.overlay.title.on` never appears.

- [ ] **Step 2: Replace the boot with the real game**

`games/paper-route/src/main.ts`:
```ts
import './style.css';
import { createSfx, type Sfx } from './audio/sfx';
import { soundsFor } from './audio/sfx-math';
import { BUF_H, BUF_W, loadContent, type Content } from './content';
import { attachKeyboard, type Keyboard } from './core/input';
import { createStepper, startLoop } from './core/loop';
import { loadBest, saveBest, type KeyValueStore } from './game/score';
import { clearEvents, initialState, reduce, type Action, type GameState } from './game/state';
import { bakeToCanvases } from './render/assets';
import { cameraTarget, followCamera, snapCamera, type Camera } from './render/camera';
import { createChunkCache, visibleChunks } from './render/chunks';
import { parseHex } from './render/palette';
import { buildTable, MORNING, postColor, postProcess } from './render/post';
import { BACKGROUND, renderFrame } from './render/renderer';
import { bakeChunk, chunkCount } from './render/street-bake';
import { windStep } from './render/wind';
import { STEP } from './sim/constants';
import { createHud, type Hud } from './ui/hud';

const LOAD_ERROR = "Couldn't load Maple Lane — try refreshing";
const RUNTIME_ERROR = 'Something went wrong — try refreshing';

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

/** Paints the page in the canvas backdrop's exact on-screen colour, so the game sits on one seamless background. */
function matchPageToCanvas(content: Content, table: Uint8Array): void {
  const [r, g, b] = postColor(content.palette, table, parseHex(BACKGROUND));
  document.documentElement.style.setProperty('--page', `rgb(${r},${g},${b})`);
}

function wireAudio(): Sfx {
  const sfx = createSfx();
  const unlock = () => sfx.unlock();
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('pointerdown', unlock, { once: true });
  return sfx;
}

interface FrameDeps {
  readonly ctx: CanvasRenderingContext2D;
  readonly content: Content;
  readonly hud: Hud;
  readonly sfx: Sfx;
  readonly keys: Keyboard;
  readonly getState: () => GameState;
  readonly setState: (s: GameState) => void;
}

function createFrame(d: FrameDeps): (dt: number) => void {
  const { street } = d.content;
  const table = buildTable(d.content.palette, MORNING);
  matchPageToCanvas(d.content, table);
  const chunks = createChunkCache((i) => bakeToCanvases(bakeChunk(street.length, i)));
  const count = chunkCount(street.length);
  const storage = safeStorage();
  const steps = createStepper(STEP);
  let best = loadBest(storage);
  let cam: Camera = cameraTarget(street.length, d.getState().bike.s);
  let prev = d.getState();
  let time = 0;

  return (dt: number) => {
    time += Math.max(0, dt);
    let state = d.getState();
    for (let n = steps(dt); n > 0; n--) state = reduce(state, { type: 'tick', dt: STEP, controls: d.keys.controls() }, street);
    if (state.phase === 'over' && prev.phase !== 'over') best = saveBest(storage, state.score);
    // A new run starts back at the start line: jump the camera instead of sweeping down the street.
    if (state.bike.s + 1 < prev.bike.s) cam = cameraTarget(street.length, state.bike.s);
    prev = state;
    cam = followCamera(cam, cameraTarget(street.length, state.bike.s), dt);
    const snapped = snapCamera(cam);
    const visible = visibleChunks(street.length, snapped, BUF_W, BUF_H);
    const wind = windStep(time);
    renderFrame(d.ctx, { content: d.content, state, cam: snapped, visible, chunk: (i) => chunks.get(i)[wind], time, width: BUF_W, height: BUF_H });
    postProcess(d.ctx, BUF_W, BUF_H, d.content.palette.lut, table);
    // Keep what is on screen plus the next chunk ahead, baked before it scrolls into view.
    const ahead = (visible[0] ?? 0) + 1;
    chunks.keepOnly(ahead < count ? [...visible, ahead] : visible);
    if (ahead < count) chunks.get(ahead);
    for (const sound of soundsFor(state.events)) d.sfx.play(sound);
    d.hud.update(state, street, best, time);
    d.setState(clearEvents(state));
  };
}

function runGame(ctx: CanvasRenderingContext2D, content: Content, hud: Hud): void {
  let state: GameState = initialState(content.street);
  const dispatch = (a: Action) => {
    state = reduce(state, a, content.street);
  };
  const keys = attachKeyboard(window, dispatch);
  // Leaving the tab mid-run pauses it rather than riding on unattended.
  window.addEventListener('blur', () => {
    if (state.phase === 'riding' && !state.paused) dispatch({ type: 'togglePause' });
  });
  const frame = createFrame({ ctx, content, hud, sfx: wireAudio(), keys, getState: () => state, setState: (s) => { state = s; } });
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
    (window as unknown as { __paperRoute: unknown }).__paperRoute = { getState: () => state, dispatch };
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
  ctx.imageSmoothingEnabled = false;
  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  try {
    runGame(ctx, await loadContent(), hud);
  } catch (err) {
    console.error('Failed to load Paper Route:', err);
    hud.showError(LOAD_ERROR);
  }
}

void boot();
```

`attachKeyboard(window, dispatch)` type-checks because every `Edge` is also an `Action`.

- [ ] **Step 3: Run the end-to-end test**

Run: `npx playwright test --project=paper-route`
Expected: PASS.

Then run: `npx playwright test --project=minigolf`
Expected: PASS (mini-golf is unaffected).

- [ ] **Step 4: Check the screenshots by eye**

Open `test-results/paper-route-title.png` and `test-results/paper-route-riding.png` with the Read tool. Check that:
- the street is a floating diorama strip on a light-blue sky that runs edge to edge, with no box around the canvas
- the road is dark with yellow centre dashes, the sidewalks are grey and the lawns are green with mowing stripes and a frayed grass fringe on their far edges
- the brown earth sides show along the right edge and the near end
- placeholder houses stand on both lawns, there's a red placeholder rider on the road in the lower-left third, and the street runs up-right
- the HUD bar is visible while riding

Fix any rendering bug before you continue. If the road reads too dark or too light, tune `SHADE` in `street-bake.ts`.

- [ ] **Step 5: Add a launch config for the controller's in-app browser check**

If `.claude/launch.json` is missing, create it:
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "paper-route", "runtimeExecutable": "npx", "runtimeArgs": ["vite", "--port", "5174", "--strictPort"], "port": 5174 }
  ]
}
```
If it exists, add that configuration to its `configurations` array. The controller opens `http://localhost:5174/games/paper-route/` in the preview pane, plays a run (Enter, then steer and toss), and checks:
- the frame rate stays smooth
- there are no visible seams between chunks
- the page background matches the canvas sky exactly

- [ ] **Step 6: Commit**

```bash
git add games/paper-route .claude/launch.json
git commit -m "feat: wire up Paper Route boot, frame loop and an end-to-end smoke test"
```

---

### Task 17: Style lock — rider and one house, then STOP for approval

This task spends roughly 20–30 PixelLab generations. It ends by asking the user to approve the style before any other art is made.

**Tools:** the `mcp__pixellab__*` tools: `create_character`, `animate_character`, `get_character`, `create_object_pro_flash`, `get_object`, `wait_for_jobs`. Load their schemas with ToolSearch first (`select:` with a comma-separated list), and adapt the field names below to the schemas if they differ. Wherever a tool accepts a palette, pass the 32 hex colours from `games/paper-route/assets/palette.json` with `palette_name: "Maple Lane"`. Raw downloads go to `games/paper-route/assets/raw/`, which is gitignored.

- [ ] **Step 1: Write the game's ingest script**

`games/paper-route/scripts/ingest.ts` (it reuses the copied `sprite-tools`):
```ts
// Usage (run from the repo root):
//   npm run ingest:paper-route -- object <name> <png | dir-of-frames> [fps]
//       → assets/sprites/<name>.png + manifest image (a dir becomes a left-to-right frame strip)
//   npm run ingest:paper-route -- rider <dir>
//       → assets/sprites/rider.png + assets/rider.json
//     <dir> is an extracted PixelLab character ZIP: <dir>/<state>/animations/ride/<direction>/frame_NNN.png
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import paletteJson from '../assets/palette.json';
import { parsePalette } from '../src/render/palette';
import { DIRS } from '../src/world/rider';
import { bottomCenter, packRows, snapToPalette, trim, type Bitmap } from './lib/sprite-tools';

const ASSETS = 'games/paper-route/assets';
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

function ingestRider(dir: string): void {
  const state = readdirSync(dir, { withFileTypes: true }).find((d) => d.isDirectory())?.name;
  if (!state) throw new Error(`no state folder in ${dir}`);
  const rows: Bitmap[][] = [];
  const rowOf: Record<string, number> = {};
  let frames = Infinity;
  for (const d of DIRS) {
    const folder = join(dir, state, 'animations', 'ride', d);
    if (!existsSync(folder)) throw new Error(`missing ${folder} (rename the animation folder to "ride")`);
    const files = framesIn(folder);
    if (files.length === 0) throw new Error(`no frames in ${folder}`);
    frames = Math.min(frames, files.length);
    rowOf[d] = rows.length;
    rows.push(files.map((f) => snapToPalette(readPng(f), colors)));
  }
  const sheet = packRows(rows);
  mkdirSync(`${ASSETS}/sprites`, { recursive: true });
  writePng(`${ASSETS}/sprites/rider.png`, sheet.bitmap);
  const layout = { src: 'rider.png', cell: sheet.cell, anchor: sheet.anchor, frames, fps: RIDER_FPS, rows: rowOf };
  writeFileSync(`${ASSETS}/rider.json`, `${JSON.stringify(layout, null, 2)}\n`);
  console.log(`rider: ${rows.length} rows x ${frames} frames, cell ${sheet.cell.join('x')}`);
}

const [kind, a, b] = process.argv.slice(2);
try {
  if (kind === 'object' && a && b) ingestObject(a, b, Number(process.argv[5] ?? 8));
  else if (kind === 'rider' && a) ingestRider(a);
  else {
    console.error('Usage: npm run ingest:paper-route -- object <name> <png|dir> [fps] | rider <dir>');
    process.exitCode = 2;
  }
} catch (err) {
  console.error(String(err));
  process.exitCode = 1;
}
```

Run: `npx tsc --noEmit`
Expected: no errors.

Commit:
```bash
git add games/paper-route/scripts/ingest.ts
git commit -m "feat: add the Paper Route PixelLab ingest script"
```

- [ ] **Step 2: Create the rider**

Call `create_character` with:
```json
{
  "name": "Paper Route Rider",
  "description": "cheerful kid riding a red bicycle, canvas newspaper bag slung over one shoulder, blue t-shirt, yellow cap, sunny morning, chunky readable silhouette with dark outline",
  "mode": "v3",
  "view": "high top-down",
  "size": 32,
  "outline": "selective outline",
  "detail": "medium detail"
}
```
Poll `get_character(character_id)` until it's complete. Record the character id and its **south** and **north-east** rotation URLs. Download both:
```bash
mkdir -p games/paper-route/assets/raw
curl -sSL -o games/paper-route/assets/raw/rider-south.png "<south rotation URL>"
curl -sSL -o games/paper-route/assets/raw/rider-ne.png "<north-east rotation URL>"
```

- [ ] **Step 3: Animate the ride**

Call `animate_character` for that character with `"action_description": "pedaling the bicycle forward at an easy pace"`, `"animation_name": "ride"`, about 6 frames, and all 8 directions. Wait with `wait_for_jobs` (or poll `get_character`) until every direction is done. If a direction fails, re-run just that direction with the same `animation_name`.

Download and extract the character ZIP (use the download link `get_character` prints):
```bash
curl -sSL -o games/paper-route/assets/raw/rider.zip "<download link>"
rm -rf games/paper-route/assets/raw/rider && mkdir -p games/paper-route/assets/raw/rider
unzip -q -o games/paper-route/assets/raw/rider.zip -d games/paper-route/assets/raw/rider
ls games/paper-route/assets/raw/rider/*/animations
```
If the animation folder isn't named `ride`, rename it with `mv`.

Run: `npm run ingest:paper-route -- rider games/paper-route/assets/raw/rider`
Expected: `rider: 8 rows x N frames, cell WxH`.

- [ ] **Step 4: Create one house, both facings, styled after the rider**

Call `create_object_pro_flash` with:
```json
{
  "name": "house-a",
  "description": "small cozy suburban house, white clapboard siding, red shingle roof, little front porch with steps and a doormat, window boxes with flowers, sunny morning, dark outline",
  "width": 64, "height": 64, "n_directions": 8, "view": "high top-down",
  "palette": ["<the 32 hex colours from games/paper-route/assets/palette.json>"], "palette_name": "Maple Lane",
  "style_image": { "url": "<rider south rotation URL>", "usage_description": "match this pixel scale, outline thickness and shading" }
}
```
Poll `get_object` until it's complete. Download the **south-east** direction (front facing down-right, used on the left side) and the **north-west** direction (front facing up-left, used on the right side):
```bash
curl -sSL -o games/paper-route/assets/raw/house-a-se.png "<south-east PNG URL>"
curl -sSL -o games/paper-route/assets/raw/house-a-nw.png "<north-west PNG URL>"
npm run ingest:paper-route -- object house-a-l games/paper-route/assets/raw/house-a-se.png
npm run ingest:paper-route -- object house-a-r games/paper-route/assets/raw/house-a-nw.png
```
If the style image is refused for size, crop `rider-south.png` to its figure locally and pass it as `base64` instead. If the tool can't make 8 directions, make two 1-direction objects with "front door facing down-right" and "front door facing up-left" added to the description.

- [ ] **Step 5: Verify and show**

Run: `npx vitest run && npx tsc --noEmit && npx playwright test --project=paper-route`
Expected: PASS.

Open `test-results/paper-route-riding.png`. The rider should be the PixelLab sprite, facing up-right, and every `house-a` should be the new house, both sides facing the street. Size check: the house should be roughly 1.5–2× the rider's height, and the rider should read clearly against the road.

- [ ] **Step 6: Commit the style-lock art**

```bash
git add games/paper-route/assets/sprites games/paper-route/assets/manifest.json games/paper-route/assets/rider.json
git commit -m "feat: add the PixelLab rider and first house (style lock)"
```

- [ ] **Step 7: STOP — report for approval**

Report status `DONE_WITH_CONCERNS` with:
- the paths of `games/paper-route/assets/raw/rider-south.png`, `rider-ne.png`, `house-a-se.png`, and `test-results/paper-route-riding.png`
- the rider character id and the house object id
- the generations spent (check `get_balance` before and after)

The controller shows these to the user. **Don't start Task 18 until the user approves the style.** If they ask for changes, regenerate with an adjusted description, re-ingest, and report again.

---

### Task 18: The remaining art

This task uses about 60–100 PixelLab generations. Every call passes the approved rider south view as `style_image` and the Maple Lane palette, so the set matches. Sizes are canvas sizes. Props should look **small relative to the 32 px rider**: a mailbox comes up to the rider's waist, a car is about rider-height and 1.5 rider-lengths long, and a dog is knee-to-waist high.

- [ ] **Step 1: Generate and ingest each sprite**

For each row, call `create_object_pro_flash` (1 direction unless the row says otherwise). Then download the frame and run `npm run ingest:paper-route -- object <name> <png>`.

| name | canvas | directions → frame used | description (append ", sunny morning, dark outline") |
|---|---|---|---|
| house-b-l / house-b-r | 64 | 8 → SE / NW | small suburban house, pale blue siding, grey roof, front porch with steps and doormat |
| house-c-l / house-c-r | 64 | 8 → SE / NW | small suburban house, butter-yellow siding, brown roof, front porch with steps and doormat |
| mailbox-sub | 16 | 1 | classic rounded kerbside mailbox on a wooden post, red flag raised |
| mailbox-plain | 16 | 1 | plain grey kerbside mailbox on a post, flag down |
| tree | 48 | 1 | round leafy shade tree, short trunk |
| hedge | 32 | 1 | low trimmed boxwood hedge |
| car | 48 | 8 → NE | small rounded parked hatchback car, teal paint |
| puddle | 32 | 1 | shallow flat rain puddle on asphalt, seen from above at an angle |
| sprinkler | 16 | 1 | small lawn sprinkler head |
| spray | 32 | 1 | fan of sparkling sprinkler water droplets in an arc |
| bundle | 16 | 1 | bundle of rolled newspapers tied with string |
| dog-sit | 24 | 1 | small happy scruffy brown dog sitting, tongue out |
| dog-run | 24 | 1 | small scruffy brown dog running, ears flapping |
| paper | 16 | 1 | rolled newspaper with a rubber band |

Optional, only if the budget allows after everything else: animate `dog-run` (about 4 frames) and `paper` (a 4-frame spin) with `animate_object`. Save the frames to a folder and ingest the folder: `npm run ingest:paper-route -- object dog-run games/paper-route/assets/raw/dog-run/ 10`.

- [ ] **Step 2: Verify**

Run: `npx vitest run && npx tsc --noEmit && npx playwright test`
Expected: PASS (both projects).

Open `test-results/paper-route-riding.png`, and have the controller play a full run in the preview pane. Check:
- every sprite reads at 1× buffer scale
- props are small next to the rider, and the mailboxes sit at the kerb
- right-side houses face the street
- no placeholder boxes remain

- [ ] **Step 3: Commit**

```bash
git add games/paper-route/assets/sprites games/paper-route/assets/manifest.json
git commit -m "feat: add the remaining Paper Route PixelLab art"
```

---

### Task 19: Final verification and review

- [ ] **Step 1: Run the full suite**

Run: `npx vitest run --coverage && npx tsc --noEmit && npx vite build && npx playwright test`
Expected:
- all tests PASS
- coverage thresholds pass
- the build writes `dist/index.html` and `dist/games/paper-route/index.html`
- both Playwright projects pass

- [ ] **Step 2: Code review**

Dispatch the `superpowers:code-reviewer` agent on `git diff main...HEAD -- games/paper-route vite.config.ts package.json vitest.config.ts tsconfig.json playwright.config.ts .gitignore`, using the spec and this plan as the reference. Fix every CRITICAL and HIGH finding, and re-run Step 1.

- [ ] **Step 3: Play-test by eye (controller)**

The controller plays at least two full runs in the preview pane and checks:
- the finish bonus works
- a wipe-out after 3 crashes works
- R restarts, and Esc pauses and resumes
- the best score persists across a reload
- the dog chases and sits after a treat
- sprinklers turn on and off
- bundles refill papers
- the page background matches the canvas
- no music or ambience plays, only sound effects

- [ ] **Step 4: Hand-over note**

Write a short note to the shared side-session notes folder (the path is in the session brief) covering:
- the branch name
- what's done
- how to run the game (`npm run dev:paper-route`)
- the root config touch points the hub restructure must keep (multi-page `vite.config.ts` input, Vitest include, Playwright projects)
- what's left (touch controls, more streets, a hub card thumbnail)
