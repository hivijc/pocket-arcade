# Backyard Mini-Golf — Plan 1: Playable Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fully playable 3-hole Backyard mini-golf game in the browser, with placeholder code-drawn art: hole data, ball physics, game flow, scorecard, HUD, tests.

**Architecture:** TypeScript + Canvas 2D, no framework. Holes are validated JSON. Physics is a pure `step(ball, hole, dt)` function at a fixed 120 Hz. Game flow is a pure reducer (`reduce` for player actions, `update` for time). Rendering reads state and draws into a 360×270 buffer that is scaled up in whole pixels. An HTML overlay shows the HUD.

**Tech Stack:** TypeScript 5, Vite 5, Vitest 2 (+ v8 coverage), Playwright, vite-node (scripts).

**Spec:** `docs/superpowers/specs/2026-11-09-backyard-minigolf-design.md`

**Out of scope here (Plan 2 — Look & Art):** dithered terrain shading, grass fringe, palette snap and time-of-day post pass, light pools, wind sway, PixelLab sprites and golfer animation, the asset palette check, audio, and the per-time-of-day debug page. Plan 1 draws everything with flat code shapes so the game is playable and testable first.

**Units used everywhere:** positions are in **tiles** (x across, y down the grid), heights in **tiles**, speeds in tiles/second. Hole JSON stores heights in **quarter-tile steps**; the loader converts.

---

## File map

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `index.html` | Tooling and page shell |
| `src/style.css` | Page and HUD styles |
| `src/core/geometry.ts` | `Vec2`, distance, closest point on a segment |
| `src/core/loop.ts` | Fixed-step accumulator + requestAnimationFrame loop |
| `src/core/input.ts` | Mouse/keyboard → `InputEvent`s; client → buffer coordinate mapping |
| `src/world/manifest.ts` | Sprite manifest type + validator (footprints, placeholder looks) |
| `src/world/hole.ts` | Hole type + validator; builds wall segments and prop obstacles |
| `src/world/holes/01.json` … `03.json` | The three Backyard holes |
| `assets/manifest.json` | Sprite definitions (Plan 1: placeholders + footprints) |
| `src/physics/constants.ts` | All physics tuning constants |
| `src/physics/terrain.ts` | Height, slope gradient and surface at any point |
| `src/physics/ball.ts` | Ball state, `strike`, `step` |
| `src/physics/simulate.ts` | Run one shot to completion (solver, tests) |
| `src/game/score.ts` | Score labels, totals, best-total storage |
| `src/game/state.ts` | Game state machine: `initialState`, `reduce`, `update` |
| `src/render/iso.ts` | Isometric projection, view fitting, depth sort |
| `src/render/terrain-draw.ts` | Flat-shaded terrain cache per hole |
| `src/render/renderer.ts` | Per-frame drawing of fences, props, ball, golfer, flag, aim |
| `src/ui/hud.ts` | HTML overlay: stats, power meter, popup, title/menu/scorecard/error |
| `src/main.ts` | Boot, wiring, dev test hook |
| `scripts/solve-hole.ts` | Brute-force solver that finds a par-or-better line for a hole |
| `tests/helpers/makeHole.ts` | Builds small test holes |
| `tests/fixtures/solutions.ts` | Known solutions for the three holes (from the solver) |
| `tests/unit/*.test.ts` | Unit tests |
| `tests/e2e/play.spec.ts` | End-to-end test |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `index.html`, `src/style.css`, `src/main.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "backyard-minigolf",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "e2e": "playwright test",
    "solve": "vite-node scripts/solve-hole.ts"
  }
}
```

- [ ] **Step 2: Install dev dependencies**

Run:
```bash
npm install -D typescript@^5.6 vite@^5.4 vitest@^2.1 @vitest/coverage-v8@^2.1 @playwright/test@^1.48 vite-node@^2.1
npx playwright install chromium
```
Expected: installs without errors; `node_modules/` created (already in `.gitignore`).

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "scripts", "vitest.config.ts", "playwright.config.ts"]
}
```

Also run: `npm install -D @types/node@^22`

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/physics/**', 'src/world/**', 'src/game/**'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

- [ ] **Step 5: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5199' },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 6: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Backyard Mini-Golf</title>
  </head>
  <body>
    <div id="stage"><canvas id="game" width="360" height="270"></canvas></div>
    <div id="hud"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `src/style.css`**

```css
:root {
  --bg: #1b2a2f;
  --ink: #f3ead7;
  --muted: #a9b6ad;
  --accent: #f0a64a;
  --panel: rgba(34, 52, 58, 0.85);
}
* { box-sizing: border-box; }
html, body {
  margin: 0; height: 100%; overflow: hidden;
  background: var(--bg); color: var(--ink);
  font: 14px/1.4 ui-monospace, Menlo, Consolas, monospace;
}
#stage { position: fixed; inset: 0; display: grid; place-items: center; }
#game { display: block; image-rendering: pixelated; }
#hud { position: fixed; inset: 0; pointer-events: none; }
.bar {
  position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 28px; padding: 8px 18px; background: var(--panel); border-radius: 10px;
}
.stat b { display: block; font-size: 18px; color: var(--accent); }
.stat span { font-size: 10px; letter-spacing: .12em; color: var(--muted); text-transform: uppercase; }
.power {
  position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
  width: 240px; height: 10px; background: var(--panel); border-radius: 5px; overflow: hidden; visibility: hidden;
}
.power.on { visibility: visible; }
.power i { display: block; height: 100%; width: 0; background: var(--accent); }
.popup {
  position: absolute; top: 20%; left: 50%; transform: translateX(-50%);
  font-size: 26px; color: var(--accent); text-shadow: 0 2px 0 #0008; visibility: hidden;
}
.popup.on { visibility: visible; }
.hint { position: absolute; bottom: 8px; left: 16px; font-size: 11px; color: var(--muted); }
.overlay { position: absolute; inset: 0; display: none; place-items: center; background: rgba(0, 0, 0, .5); pointer-events: auto; }
.overlay.on { display: grid; }
.card { background: var(--bg); padding: 24px 32px; border-radius: 12px; text-align: center; min-width: 300px; }
.card h1 { margin: 0 0 8px; color: var(--accent); font-size: 22px; }
button {
  font: inherit; padding: 8px 18px; margin: 6px; border: 0; border-radius: 8px;
  background: var(--accent); color: var(--bg); cursor: pointer;
}
table { border-collapse: collapse; margin: 12px auto; }
td, th { padding: 4px 12px; text-align: left; }
```

- [ ] **Step 8: Create a placeholder `src/main.ts`** (replaced in Task 14)

```ts
import './style.css';

console.info('Backyard Mini-Golf: scaffold ready');
```

- [ ] **Step 9: Verify the toolchain**

Run: `npx tsc --noEmit`
Expected: no output (success).

Run: `npm run build`
Expected: `vite build` finishes and writes `dist/`.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts playwright.config.ts index.html src/style.css src/main.ts
git commit -m "chore: scaffold Vite + TypeScript + Vitest + Playwright project" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Geometry helpers

**Files:**
- Create: `src/core/geometry.ts`
- Test: `tests/unit/geometry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { closestPointOnSegment, distance } from '../../src/core/geometry';

describe('distance', () => {
  it('measures straight-line distance', () => {
    expect(distance([0, 0], [3, 4])).toBe(5);
  });
});

describe('closestPointOnSegment', () => {
  it('projects onto the middle of a segment', () => {
    expect(closestPointOnSegment([1, 5], [0, 0], [2, 0])).toEqual([1, 0]);
  });
  it('clamps to the start point', () => {
    expect(closestPointOnSegment([-3, 1], [0, 0], [2, 0])).toEqual([0, 0]);
  });
  it('clamps to the end point', () => {
    expect(closestPointOnSegment([9, -1], [0, 0], [2, 0])).toEqual([2, 0]);
  });
  it('handles a zero-length segment', () => {
    expect(closestPointOnSegment([4, 4], [1, 1], [1, 1])).toEqual([1, 1]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/geometry.test.ts`
Expected: FAIL — cannot resolve `../../src/core/geometry`.

- [ ] **Step 3: Write the implementation**

```ts
export type Vec2 = readonly [number, number];

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return a;
  const t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2;
  const clamped = Math.max(0, Math.min(1, t));
  return [a[0] + abx * clamped, a[1] + aby * clamped];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/geometry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/geometry.ts tests/unit/geometry.test.ts
git commit -m "feat: add geometry helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sprite manifest validator

**Files:**
- Create: `src/world/manifest.ts`
- Test: `tests/unit/manifest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { parseManifest } from '../../src/world/manifest';

const placeholder = { color: '#fff', w: 4, h: 8 };

describe('parseManifest', () => {
  it('accepts circle, box and no footprint', () => {
    const m = parseManifest({
      post: { footprint: { kind: 'circle', r: 0.3 }, placeholder },
      crate: { footprint: { kind: 'box', w: 1, d: 2 }, placeholder },
      flower: { placeholder },
    });
    expect(m.post.footprint).toEqual({ kind: 'circle', r: 0.3 });
    expect(m.crate.footprint).toEqual({ kind: 'box', w: 1, d: 2 });
    expect(m.flower.footprint).toBeUndefined();
    expect(m.flower.placeholder).toEqual(placeholder);
  });

  it('rejects a non-object', () => {
    expect(() => parseManifest([])).toThrow(/manifest: must be an object/);
  });

  it('rejects a missing placeholder', () => {
    expect(() => parseManifest({ post: {} })).toThrow(/post\.placeholder is required/);
  });

  it('rejects a bad placeholder', () => {
    expect(() => parseManifest({ post: { placeholder: { color: 1, w: 4, h: 8 } } })).toThrow(/post\.placeholder needs color, w, h/);
  });

  it('rejects a bad footprint', () => {
    expect(() => parseManifest({ post: { footprint: { kind: 'circle', r: -1 }, placeholder } })).toThrow(/post\.footprint must be/);
    expect(() => parseManifest({ post: { footprint: 'round', placeholder } })).toThrow(/post\.footprint must be an object/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/manifest.test.ts`
Expected: FAIL — cannot resolve `../../src/world/manifest`.

- [ ] **Step 3: Write the implementation**

```ts
export type Footprint =
  | { readonly kind: 'circle'; readonly r: number }
  | { readonly kind: 'box'; readonly w: number; readonly d: number };

export interface Placeholder {
  readonly color: string;
  readonly w: number;
  readonly h: number;
}

export interface SpriteDef {
  readonly footprint?: Footprint;
  readonly placeholder: Placeholder;
}

export type Manifest = Readonly<Record<string, SpriteDef>>;

export class ManifestError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

function parseFootprint(name: string, raw: unknown): Footprint | undefined {
  if (raw === undefined) return undefined;
  if (!isObj(raw)) throw new ManifestError(`manifest: ${name}.footprint must be an object`);
  if (raw.kind === 'circle' && isPosNum(raw.r)) return { kind: 'circle', r: raw.r };
  if (raw.kind === 'box' && isPosNum(raw.w) && isPosNum(raw.d)) return { kind: 'box', w: raw.w, d: raw.d };
  throw new ManifestError(`manifest: ${name}.footprint must be {kind:'circle',r} or {kind:'box',w,d}`);
}

function parsePlaceholder(name: string, raw: unknown): Placeholder {
  if (!isObj(raw)) throw new ManifestError(`manifest: ${name}.placeholder is required`);
  if (typeof raw.color !== 'string' || !isPosNum(raw.w) || !isPosNum(raw.h)) {
    throw new ManifestError(`manifest: ${name}.placeholder needs color, w, h`);
  }
  return { color: raw.color, w: raw.w, h: raw.h };
}

export function parseManifest(raw: unknown): Manifest {
  if (!isObj(raw)) throw new ManifestError('manifest: must be an object of sprite definitions');
  const entries = Object.entries(raw).map(([name, def]): [string, SpriteDef] => {
    const d = isObj(def) ? def : {};
    return [name, { footprint: parseFootprint(name, d.footprint), placeholder: parsePlaceholder(name, d.placeholder) }];
  });
  return Object.freeze(Object.fromEntries(entries));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/manifest.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/world/manifest.ts tests/unit/manifest.test.ts
git commit -m "feat: add sprite manifest validator" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Physics constants and hole loader

**Files:**
- Create: `src/physics/constants.ts`, `src/world/hole.ts`, `tests/helpers/makeHole.ts`
- Test: `tests/unit/hole.test.ts`

- [ ] **Step 1: Create `src/physics/constants.ts`** (tuning values used by the loader and physics)

```ts
/** Fixed physics step in seconds (120 Hz). */
export const STEP = 1 / 120;
/** Ball radius in tiles. */
export const BALL_R = 0.06;
/** Ball speed at 100% power, tiles/s. */
export const MAX_PUTT_SPEED = 6;
/** Acceleration per unit of slope gradient, tiles/s². */
export const SLOPE_ACCEL = 4;
/** Vertical gravity while airborne, tiles/s². */
export const GRAVITY = 6;
/** Rolling deceleration per surface, tiles/s². */
export const FRICTION = { G: 1.2, R: 4, S: 9 } as const;
/** Share of speed kept after hitting a wall or prop. */
export const WALL_KEEP = 0.7;
/** Share of ground speed kept on landing from a hop. */
export const LAND_KEEP = 0.85;
/** How much faster the ground must fall away than the ball (tiles/s) to launch a hop. */
export const LAUNCH_DROP = 1.0;
/** Cup capture radius, tiles. */
export const CUP_R = 0.18;
/** Ball must cross the cup slower than this to drop in, tiles/s. */
export const CAPTURE_SPEED = 2.2;
/** Lip-out deflection angle, radians, and speed kept. */
export const LIP_DEFLECT = 0.3;
export const LIP_KEEP = 0.85;
/** Below this speed on ground where friction beats the slope, the ball stops. */
export const STOP_SPEED = 0.05;
/** A shot that is still rolling after this long is stopped. */
export const MAX_SIM_SECONDS = 20;
```

- [ ] **Step 2: Create the test helper `tests/helpers/makeHole.ts`**

```ts
import { parseHole, type Hole } from '../../src/world/hole';
import { parseManifest } from '../../src/world/manifest';

export const TEST_MANIFEST = parseManifest({
  post: { footprint: { kind: 'circle', r: 0.3 }, placeholder: { color: '#ffffff', w: 4, h: 8 } },
  crate: { footprint: { kind: 'box', w: 1, d: 1 }, placeholder: { color: '#aa5522', w: 8, h: 8 } },
  flower: { placeholder: { color: '#ff00ff', w: 4, h: 4 } },
});

export interface HoleOpts {
  width?: number;
  depth?: number;
  rows?: string[];
  heightOf?: (x: number, y: number) => number; // quarter-tile steps at corner (x, y)
  tee?: [number, number];
  cup?: [number, number];
  props?: { sprite: string; at: [number, number] }[];
  walls?: [[number, number], [number, number]][];
  par?: number;
}

export function rawHole(o: HoleOpts = {}): Record<string, unknown> {
  const width = o.width ?? 20;
  const depth = o.depth ?? 5;
  const surface = o.rows ?? Array.from({ length: depth }, () => 'G'.repeat(width));
  const height = Array.from({ length: depth + 1 }, (_, y) =>
    Array.from({ length: width + 1 }, (_, x) => (o.heightOf ? o.heightOf(x, y) : 0)),
  );
  return {
    name: 'Test',
    par: o.par ?? 3,
    size: [width, depth],
    height,
    surface,
    walls: o.walls ?? [],
    tee: o.tee ?? [1.5, 2.5],
    cup: o.cup ?? [width - 1.5, 0.5],
    props: o.props ?? [],
  };
}

export function makeHole(o: HoleOpts = {}): Hole {
  return parseHole(rawHole(o), TEST_MANIFEST, 'test.json');
}
```

Note: the default cup sits at row 0, off the default putting line (y = 2.5), so tests don't sink the ball by accident.

- [ ] **Step 3: Write the failing test `tests/unit/hole.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { parseHole } from '../../src/world/hole';
import { TEST_MANIFEST, makeHole, rawHole } from '../helpers/makeHole';

const parse = (raw: unknown) => parseHole(raw, TEST_MANIFEST, 'test.json');

describe('parseHole: valid data', () => {
  it('loads a simple hole', () => {
    const h = makeHole({ width: 4, depth: 3, tee: [0.5, 1.5], cup: [3.5, 1.5], par: 2 });
    expect(h.name).toBe('Test');
    expect(h.par).toBe(2);
    expect([h.width, h.depth]).toEqual([4, 3]);
    expect(h.tee).toEqual([0.5, 1.5]);
    expect(h.cup).toEqual([3.5, 1.5]);
  });

  it('converts quarter-step heights to tiles', () => {
    const h = makeHole({ width: 2, depth: 1, tee: [0.5, 0.5], cup: [1.5, 0.5], heightOf: (x) => x * 2 });
    expect(h.heights).toEqual([[0, 0.5, 1], [0, 0.5, 1]]);
  });

  it('builds walls around the outside of a hole', () => {
    const h = makeHole({ width: 2, depth: 1, tee: [0.5, 0.5], cup: [1.5, 0.5] });
    expect(h.walls).toHaveLength(6);
  });

  it('builds walls between play tiles and X tiles', () => {
    const h = makeHole({ width: 2, depth: 2, rows: ['GG', 'GX'], tee: [0.5, 0.5], cup: [1.5, 0.5] });
    // 6 outer-boundary edges of the 3 play tiles + 2 edges facing the X tile = 8
    expect(h.walls).toHaveLength(8);
  });

  it('keeps explicit walls', () => {
    const h = makeHole({ walls: [[[5, 0], [5, 2]]] });
    expect(h.walls).toContainEqual({ a: [5, 0], b: [5, 2] });
  });

  it('turns circle footprints into circles and box footprints into 4 walls', () => {
    const plain = makeHole();
    const h = makeHole({ props: [{ sprite: 'post', at: [6, 2.5] }, { sprite: 'crate', at: [10, 2.5] }, { sprite: 'flower', at: [12, 1] }] });
    expect(h.circles).toEqual([{ c: [6, 2.5], r: 0.3 }]);
    expect(h.walls.length - plain.walls.length).toBe(4);
    expect(h.props).toHaveLength(3);
  });
});

describe('parseHole: invalid data', () => {
  const bad = (patch: Record<string, unknown>) => ({ ...rawHole(), ...patch });

  it('rejects a non-object', () => {
    expect(() => parse(null)).toThrow(/test\.json: must be an object/);
  });
  it('rejects a missing name', () => {
    expect(() => parse(bad({ name: '' }))).toThrow(/name must be a non-empty string/);
  });
  it('rejects par outside 1..5', () => {
    expect(() => parse(bad({ par: 7 }))).toThrow(/par must be an integer from 1 to 5/);
  });
  it('rejects a bad size', () => {
    expect(() => parse(bad({ size: [0, 5] }))).toThrow(/size must be \[width, depth\]/);
  });
  it('rejects the wrong number of surface rows', () => {
    expect(() => parse(bad({ surface: ['G'.repeat(20)] }))).toThrow(/surface must have 5 rows/);
  });
  it('rejects a surface row of the wrong length', () => {
    const rows = Array.from({ length: 5 }, () => 'G'.repeat(20));
    rows[2] = 'G'.repeat(19);
    expect(() => parse(bad({ surface: rows }))).toThrow(/surface row 2 must be a string of 20 letters/);
  });
  it('rejects an unknown surface letter', () => {
    const rows = Array.from({ length: 5 }, () => 'G'.repeat(20));
    rows[1] = 'GGQ' + 'G'.repeat(17);
    expect(() => parse(bad({ surface: rows }))).toThrow(/surface row 1 has unknown letter "Q"/);
  });
  it('rejects a height grid of the wrong size', () => {
    expect(() => parse(bad({ height: [[0]] }))).toThrow(/height must have 6 rows of corners/);
    const h = Array.from({ length: 6 }, () => Array(21).fill(0));
    h[3] = Array(20).fill(0);
    expect(() => parse(bad({ height: h }))).toThrow(/height row 3 must have 21 numbers/);
  });
  it('rejects a tee that is not on green', () => {
    const rows = Array.from({ length: 5 }, () => 'G'.repeat(20));
    rows[2] = 'GR' + 'G'.repeat(18);
    expect(() => parse(bad({ surface: rows }))).toThrow(/tee must be on a green \(G\) tile/);
  });
  it('rejects a cup outside the grid', () => {
    expect(() => parse(bad({ cup: [30, 1] }))).toThrow(/cup must be on a green \(G\) tile/);
  });
  it('rejects a malformed point', () => {
    expect(() => parse(bad({ tee: [1] }))).toThrow(/tee must be \[x, y\]/);
  });
  it('rejects an unknown sprite', () => {
    expect(() => parse(bad({ props: [{ sprite: 'unicorn', at: [3, 3] }] }))).toThrow(/props\[0\] uses unknown sprite "unicorn"/);
  });
  it('rejects a prop outside the grid', () => {
    expect(() => parse(bad({ props: [{ sprite: 'flower', at: [40, 3] }] }))).toThrow(/props\[0\]\.at is outside the grid/);
  });
  it('rejects a tee inside a prop footprint', () => {
    expect(() => parse(bad({ props: [{ sprite: 'post', at: [1.6, 2.5] }] }))).toThrow(/tee is inside a wall or prop/);
  });
  it('rejects a cup touching a wall', () => {
    expect(() => parse(bad({ cup: [18.5, 0.03] }))).toThrow(/cup is inside a wall or prop/);
  });
  it('rejects malformed walls', () => {
    expect(() => parse(bad({ walls: [[1, 2]] }))).toThrow(/walls\[0\] must be \[\[x, y\], \[x, y\]\]/);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run tests/unit/hole.test.ts`
Expected: FAIL — cannot resolve `../../src/world/hole`.

- [ ] **Step 5: Write the implementation `src/world/hole.ts`**

```ts
import { closestPointOnSegment, distance, type Vec2 } from '../core/geometry';
import { BALL_R } from '../physics/constants';
import type { Manifest } from './manifest';

export type { Vec2 } from '../core/geometry';
export type Surface = 'G' | 'R' | 'S' | 'W' | 'X';

export interface Segment { readonly a: Vec2; readonly b: Vec2 }
export interface Circle { readonly c: Vec2; readonly r: number }
export interface PropPlacement { readonly sprite: string; readonly at: Vec2 }

export interface Hole {
  readonly name: string;
  readonly par: number;
  readonly width: number;
  readonly depth: number;
  /** [depth + 1][width + 1] corner heights, in tiles. */
  readonly heights: readonly (readonly number[])[];
  /** [depth] rows of `width` surface letters. */
  readonly surface: readonly string[];
  readonly walls: readonly Segment[];
  readonly circles: readonly Circle[];
  readonly tee: Vec2;
  readonly cup: Vec2;
  readonly props: readonly PropPlacement[];
}

export class HoleError extends Error {}

export const QUARTER = 0.25;
const SURFACES = new Set(['G', 'R', 'S', 'W', 'X']);

type Fail = (msg: string) => never;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function point(v: unknown, field: string, fail: Fail): Vec2 {
  if (Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1])) return [v[0], v[1]];
  return fail(`${field} must be [x, y]`);
}

function parseSurface(v: unknown, width: number, depth: number, fail: Fail): string[] {
  if (!Array.isArray(v) || v.length !== depth) return fail(`surface must have ${depth} rows`);
  return v.map((row, y) => {
    if (typeof row !== 'string' || row.length !== width) return fail(`surface row ${y} must be a string of ${width} letters`);
    const unknown = [...row].find((c) => !SURFACES.has(c));
    if (unknown !== undefined) return fail(`surface row ${y} has unknown letter "${unknown}"`);
    return row;
  });
}

function parseHeights(v: unknown, width: number, depth: number, fail: Fail): number[][] {
  if (!Array.isArray(v) || v.length !== depth + 1) return fail(`height must have ${depth + 1} rows of corners`);
  return v.map((row, y) => {
    if (!Array.isArray(row) || row.length !== width + 1 || !row.every(isNum)) {
      return fail(`height row ${y} must have ${width + 1} numbers`);
    }
    return row.map((q: number) => q * QUARTER);
  });
}

function parseWalls(v: unknown, fail: Fail): Segment[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return fail('walls must be an array');
  return v.map((w, i) => {
    const field = `walls[${i}] must be [[x, y], [x, y]]`;
    if (!Array.isArray(w) || w.length !== 2) return fail(field);
    return { a: point(w[0], field, fail), b: point(w[1], field, fail) };
  });
}

function parseProps(v: unknown, manifest: Manifest, width: number, depth: number, fail: Fail): PropPlacement[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return fail('props must be an array');
  return v.map((p, i) => {
    if (!isObj(p) || typeof p.sprite !== 'string') return fail(`props[${i}].sprite must be a string`);
    if (!manifest[p.sprite]) return fail(`props[${i}] uses unknown sprite "${p.sprite}"`);
    const at = point(p.at, `props[${i}].at`, fail);
    if (at[0] < 0 || at[1] < 0 || at[0] > width || at[1] > depth) return fail(`props[${i}].at is outside the grid`);
    return { sprite: p.sprite, at };
  });
}

/** A wall on every edge where a play tile meets an X tile or the outside of the grid. */
export function edgeWalls(surface: readonly string[], width: number, depth: number): Segment[] {
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= depth || surface[y][x] === 'X';
  return surface.flatMap((row, y) =>
    [...row].flatMap((cell, x): Segment[] => {
      if (cell === 'X') return [];
      return [
        solid(x, y - 1) ? [{ a: [x, y], b: [x + 1, y] } as Segment] : [],
        solid(x, y + 1) ? [{ a: [x, y + 1], b: [x + 1, y + 1] } as Segment] : [],
        solid(x - 1, y) ? [{ a: [x, y], b: [x, y + 1] } as Segment] : [],
        solid(x + 1, y) ? [{ a: [x + 1, y], b: [x + 1, y + 1] } as Segment] : [],
      ].flat();
    }),
  );
}

function boxSegments(at: Vec2, w: number, d: number): Segment[] {
  const x0 = at[0] - w / 2, x1 = at[0] + w / 2, y0 = at[1] - d / 2, y1 = at[1] + d / 2;
  return [
    { a: [x0, y0], b: [x1, y0] },
    { a: [x1, y0], b: [x1, y1] },
    { a: [x1, y1], b: [x0, y1] },
    { a: [x0, y1], b: [x0, y0] },
  ];
}

export function parseHole(raw: unknown, manifest: Manifest, file: string): Hole {
  const fail: Fail = (msg) => { throw new HoleError(`${file}: ${msg}`); };
  if (!isObj(raw)) return fail('must be an object');

  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : fail('name must be a non-empty string');
  const par = typeof raw.par === 'number' && Number.isInteger(raw.par) && raw.par >= 1 && raw.par <= 5
    ? raw.par : fail('par must be an integer from 1 to 5');
  const size = Array.isArray(raw.size) && raw.size.length === 2 && raw.size.every((n) => Number.isInteger(n) && n > 0)
    ? (raw.size as [number, number]) : fail('size must be [width, depth] positive integers');
  const [width, depth] = size;

  const surface = parseSurface(raw.surface, width, depth, fail);
  const heights = parseHeights(raw.height, width, depth, fail);
  const tee = point(raw.tee, 'tee', fail);
  const cup = point(raw.cup, 'cup', fail);
  const props = parseProps(raw.props, manifest, width, depth, fail);

  const circles: Circle[] = props.flatMap((p) => {
    const fp = manifest[p.sprite].footprint;
    return fp?.kind === 'circle' ? [{ c: p.at, r: fp.r }] : [];
  });
  const walls: Segment[] = [
    ...parseWalls(raw.walls, fail),
    ...edgeWalls(surface, width, depth),
    ...props.flatMap((p) => {
      const fp = manifest[p.sprite].footprint;
      return fp?.kind === 'box' ? boxSegments(p.at, fp.w, fp.d) : [];
    }),
  ];

  const surfaceAt = (p: Vec2) => surface[Math.floor(p[1])]?.[Math.floor(p[0])];
  const blocked = (p: Vec2) =>
    walls.some((w) => distance(p, closestPointOnSegment(p, w.a, w.b)) <= BALL_R) ||
    circles.some((c) => distance(p, c.c) <= c.r + BALL_R);
  for (const [label, p] of [['tee', tee], ['cup', cup]] as const) {
    if (surfaceAt(p) !== 'G') fail(`${label} must be on a green (G) tile`);
    if (blocked(p)) fail(`${label} is inside a wall or prop`);
  }

  return { name, par, width, depth, heights, surface, walls, circles, tee, cup, props };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/hole.test.ts`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add src/physics/constants.ts src/world/hole.ts tests/helpers/makeHole.ts tests/unit/hole.test.ts
git commit -m "feat: add hole loader with validation, edge walls and prop obstacles" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Terrain sampling

**Files:**
- Create: `src/physics/terrain.ts`
- Test: `tests/unit/terrain.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { gradientAt, heightAt, surfaceAt } from '../../src/physics/terrain';
import { makeHole } from '../helpers/makeHole';

// 2×1 hole: a ridge 1 tile high along x = 1.
const ridge = makeHole({ width: 2, depth: 1, tee: [0.5, 0.5], cup: [1.5, 0.5], heightOf: (x) => (x === 1 ? 4 : 0) });

describe('heightAt', () => {
  it('interpolates between corners', () => {
    expect(heightAt(ridge, 0.5, 0.5)).toBeCloseTo(0.5);
    expect(heightAt(ridge, 1, 0.5)).toBeCloseTo(1);
    expect(heightAt(ridge, 0, 0)).toBeCloseTo(0);
  });
  it('clamps outside the grid', () => {
    expect(heightAt(ridge, 5, 0.5)).toBeCloseTo(0);
    expect(heightAt(ridge, -3, 0.5)).toBeCloseTo(0);
  });
});

describe('gradientAt', () => {
  it('points uphill', () => {
    const [gx, gy] = gradientAt(ridge, 0.5, 0.5);
    expect(gx).toBeCloseTo(1);
    expect(gy).toBeCloseTo(0);
    expect(gradientAt(ridge, 1.5, 0.5)[0]).toBeCloseTo(-1);
  });
  it('is zero on flat ground', () => {
    const flat = makeHole();
    expect(gradientAt(flat, 3.3, 2.2)).toEqual([0, 0]);
  });
});

describe('surfaceAt', () => {
  it('returns the tile letter', () => {
    const h = makeHole({ width: 2, depth: 1, rows: ['GS'], tee: [0.5, 0.5], cup: [0.6, 0.6] });
    expect(surfaceAt(h, 0.2, 0.2)).toBe('G');
    expect(surfaceAt(h, 1.2, 0.2)).toBe('S');
  });
  it('returns null outside the grid', () => {
    expect(surfaceAt(ridge, -0.1, 0.5)).toBeNull();
    expect(surfaceAt(ridge, 0.5, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/terrain.test.ts`
Expected: FAIL — cannot resolve `../../src/physics/terrain`.

- [ ] **Step 3: Write the implementation**

```ts
import type { Vec2 } from '../core/geometry';
import type { Hole, Surface } from '../world/hole';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function surfaceAt(hole: Hole, x: number, y: number): Surface | null {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= hole.width || cy >= hole.depth) return null;
  return hole.surface[cy][cx] as Surface;
}

interface Cell { h00: number; h10: number; h01: number; h11: number; fx: number; fy: number }

function cellAt(hole: Hole, x: number, y: number): Cell {
  const cx = clamp(Math.floor(x), 0, hole.width - 1);
  const cy = clamp(Math.floor(y), 0, hole.depth - 1);
  const h = hole.heights;
  return {
    h00: h[cy][cx], h10: h[cy][cx + 1], h01: h[cy + 1][cx], h11: h[cy + 1][cx + 1],
    fx: clamp(x - cx, 0, 1), fy: clamp(y - cy, 0, 1),
  };
}

export function heightAt(hole: Hole, x: number, y: number): number {
  const { h00, h10, h01, h11, fx, fy } = cellAt(hole, x, y);
  const top = h00 + (h10 - h00) * fx;
  const bottom = h01 + (h11 - h01) * fx;
  return top + (bottom - top) * fy;
}

/** Height change per tile in x and y: the uphill direction. */
export function gradientAt(hole: Hole, x: number, y: number): Vec2 {
  const { h00, h10, h01, h11, fx, fy } = cellAt(hole, x, y);
  const dx = (1 - fy) * (h10 - h00) + fy * (h11 - h01);
  const dy = (1 - fx) * (h01 - h00) + fx * (h11 - h10);
  return [dx + 0, dy + 0]; // `+ 0` turns -0 into 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/terrain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/physics/terrain.ts tests/unit/terrain.test.ts
git commit -m "feat: add terrain height, gradient and surface sampling" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Ball physics and shot simulation

**Files:**
- Create: `src/physics/ball.ts`, `src/physics/simulate.ts`
- Test: `tests/unit/ball.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { isMoving, restingBall, step, strike, type Ball } from '../../src/physics/ball';
import { simulateShot } from '../../src/physics/simulate';
import { BALL_R, FRICTION, MAX_PUTT_SPEED } from '../../src/physics/constants';
import { makeHole } from '../helpers/makeHole';
import type { Hole } from '../../src/world/hole';

const speed = (b: Ball) => Math.hypot(b.vx, b.vy);

function runSteps(hole: Hole, ball: Ball, n: number): Ball {
  let b = ball;
  for (let i = 0; i < n; i++) b = step(b, hole).ball;
  return b;
}

describe('strike and rest', () => {
  it('a resting ball does not move and emits nothing', () => {
    const hole = makeHole();
    const ball = restingBall(hole, [2.5, 2.5]);
    const r = step(ball, hole);
    expect(r.ball).toBe(ball);
    expect(r.events).toEqual([]);
    expect(isMoving(ball)).toBe(false);
  });

  it('strike sets velocity from angle and power, clamped to 0..1', () => {
    const hole = makeHole();
    const b = strike(restingBall(hole, [2.5, 2.5]), Math.PI / 2, 2);
    expect(b.vx).toBeCloseTo(0);
    expect(b.vy).toBeCloseTo(MAX_PUTT_SPEED);
  });
});

describe('rolling', () => {
  it('stops on flat green after about v²/(2·friction)', () => {
    const hole = makeHole();
    const r = simulateShot(hole, restingBall(hole, [2.5, 2.5]), 0, 0.5);
    const v = 0.5 * MAX_PUTT_SPEED;
    expect(r.outcome).toBe('stopped');
    expect(r.ball.x - 2.5).toBeCloseTo((v * v) / (2 * FRICTION.G), 0);
    expect(Math.abs(r.ball.x - 2.5 - (v * v) / (2 * FRICTION.G))).toBeLessThan(0.1);
  });

  it('rough stops the ball sooner than green', () => {
    const rough = makeHole({ rows: ['GGGGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGGGG', 'GGRRRRRRRRRRRRRRRRRR', 'GGGGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGGGG'] });
    const green = makeHole();
    const a = simulateShot(rough, restingBall(rough, [1.5, 2.5]), 0, 0.5);
    const b = simulateShot(green, restingBall(green, [1.5, 2.5]), 0, 0.5);
    expect(a.ball.x).toBeLessThan(b.ball.x);
  });

  it('rolls further downhill than on the flat', () => {
    const downhill = makeHole({ heightOf: (x) => -2 * x });
    const flat = makeHole();
    const a = runSteps(downhill, strike(restingBall(downhill, [2.5, 2.5]), 0, 0.2), 60);
    const b = runSteps(flat, strike(restingBall(flat, [2.5, 2.5]), 0, 0.2), 60);
    expect(a.x).toBeGreaterThan(b.x);
  });

  it('stays put on a gentle slope where friction wins', () => {
    const gentle = makeHole({ heightOf: (x) => x });
    const r = simulateShot(gentle, restingBall(gentle, [2.5, 2.5]), 0, 0.3);
    expect(r.outcome).toBe('stopped');
    expect(step(r.ball, gentle).ball).toBe(r.ball);
  });
});

describe('collisions', () => {
  it('bounces off a wall keeping about 70% of its speed', () => {
    const hole = makeHole({ width: 6, cup: [4.5, 0.5] });
    let ball = strike(restingBall(hole, [3, 2.5]), 0, 0.5);
    for (let i = 0; i < 1000; i++) {
      const r = step(ball, hole);
      if (r.events.includes('wall')) {
        expect(r.ball.vx).toBeLessThan(0);
        const ratio = speed(r.ball) / speed(ball);
        expect(ratio).toBeGreaterThan(0.65);
        expect(ratio).toBeLessThan(0.71);
        return;
      }
      ball = r.ball;
    }
    throw new Error('never hit the wall');
  });

  it('bounces off a round prop', () => {
    const hole = makeHole({ props: [{ sprite: 'post', at: [6, 2.5] }] });
    const r = simulateShot(hole, restingBall(hole, [3, 2.5]), 0, 0.5);
    expect(r.events).toContain('wall');
    expect(r.ball.x).toBeLessThan(6);
  });

  it('never passes through a wall at full speed', () => {
    const hole = makeHole({ width: 6, cup: [4.5, 0.5] });
    let ball = strike(restingBall(hole, [3, 2.5]), 0, 1);
    for (let i = 0; i < 300; i++) {
      ball = step(ball, hole).ball;
      expect(ball.x).toBeLessThanOrEqual(6 - BALL_R + 1e-9);
    }
  });
});

describe('cup', () => {
  it('drops in when slow enough', () => {
    const hole = makeHole({ cup: [6.5, 2.5] });
    const r = simulateShot(hole, restingBall(hole, [5.5, 2.5]), 0, 0.3);
    expect(r.outcome).toBe('holed');
    expect([r.ball.x, r.ball.y]).toEqual([6.5, 2.5]);
    expect(isMoving(r.ball)).toBe(false);
  });

  it('lips out when too fast', () => {
    const hole = makeHole({ cup: [6.5, 2.5] });
    const r = simulateShot(hole, restingBall(hole, [3.5, 2.5]), 0, 1);
    expect(r.events).toContain('lip');
    expect(r.outcome).toBe('stopped');
    expect(r.ball.x).toBeGreaterThan(10);
  });
});

describe('hazards and hops', () => {
  it('water ends the shot with a water event', () => {
    const rows = ['GGGGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGGGG', 'GGGGGGWWWWGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGGGG', 'GGGGGGGGGGGGGGGGGGGG'];
    const hole = makeHole({ rows });
    expect(simulateShot(hole, restingBall(hole, [1.5, 2.5]), 0, 0.6).outcome).toBe('water');
  });

  it('a ball outside the grid or with a broken value counts as water', () => {
    const hole = makeHole();
    const out: Ball = { ...restingBall(hole, [2.5, 2.5]), x: -1, vx: -1 };
    expect(step(out, hole).events).toContain('water');
    const broken: Ball = { ...restingBall(hole, [2.5, 2.5]), vx: Number.NaN };
    expect(step(broken, hole).events).toContain('water');
  });

  it('launches off a ramp lip and lands', () => {
    const ramp = makeHole({ heightOf: (x) => (x === 5 ? 2 : x === 6 ? 4 : 0) });
    let ball = strike(restingBall(ramp, [1.5, 2.5]), 0, 1);
    let sawAirborne = false;
    let landed = false;
    for (let i = 0; i < 2000 && isMoving(ball); i++) {
      const r = step(ball, ramp);
      sawAirborne ||= r.ball.airborne;
      landed ||= r.events.includes('land');
      ball = r.ball;
    }
    expect(sawAirborne).toBe(true);
    expect(landed).toBe(true);
  });
});

describe('simulateShot', () => {
  it('is deterministic', () => {
    const hole = makeHole({ props: [{ sprite: 'post', at: [8, 2.4] }] });
    const from = restingBall(hole, [1.5, 2.5]);
    expect(simulateShot(hole, from, 0.05, 0.8)).toEqual(simulateShot(hole, from, 0.05, 0.8));
  });

  it('a zero-power shot stops immediately', () => {
    const hole = makeHole();
    expect(simulateShot(hole, restingBall(hole, [2.5, 2.5]), 0, 0).outcome).toBe('stopped');
  });

  it('reports a timeout when the time limit is too short', () => {
    const hole = makeHole();
    expect(simulateShot(hole, restingBall(hole, [2.5, 2.5]), 0, 1, 0.05).outcome).toBe('timeout');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ball.test.ts`
Expected: FAIL — cannot resolve `../../src/physics/ball`.

- [ ] **Step 3: Write `src/physics/ball.ts`**

```ts
import { closestPointOnSegment, type Vec2 } from '../core/geometry';
import type { Hole, Surface } from '../world/hole';
import {
  BALL_R, CAPTURE_SPEED, CUP_R, FRICTION, GRAVITY, LAND_KEEP, LAUNCH_DROP, LIP_DEFLECT, LIP_KEEP,
  MAX_PUTT_SPEED, SLOPE_ACCEL, STEP, STOP_SPEED, WALL_KEEP,
} from './constants';
import { gradientAt, heightAt, surfaceAt } from './terrain';

export interface Ball {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly vx: number;
  readonly vy: number;
  /** Vertical speed: while rolling, the ground's rise rate along the path; while airborne, true vertical speed. */
  readonly vz: number;
  readonly airborne: boolean;
  /** True while the ball is over the cup (so a lip-out deflects only once per pass). */
  readonly overCup: boolean;
}

export type BallEvent = 'wall' | 'land' | 'lip' | 'holed' | 'water' | 'stopped';

export interface StepResult {
  readonly ball: Ball;
  readonly events: readonly BallEvent[];
}

export function restingBall(hole: Hole, at: Vec2): Ball {
  return { x: at[0], y: at[1], z: heightAt(hole, at[0], at[1]), vx: 0, vy: 0, vz: 0, airborne: false, overCup: false };
}

export function isMoving(b: Ball): boolean {
  return b.airborne || b.vx !== 0 || b.vy !== 0;
}

export function strike(ball: Ball, angle: number, power: number): Ball {
  const s = Math.max(0, Math.min(1, power)) * MAX_PUTT_SPEED;
  return { ...ball, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s, vz: 0, airborne: false };
}

const frictionOf = (s: Surface | null): number => (s === 'R' ? FRICTION.R : s === 'S' ? FRICTION.S : FRICTION.G);
const halt = (b: Ball): Ball => ({ ...b, vx: 0, vy: 0, vz: 0, airborne: false });

function flyStep(b: Ball, hole: Hole, dt: number, events: BallEvent[]): Ball {
  const vz = b.vz - GRAVITY * dt;
  const x = b.x + b.vx * dt;
  const y = b.y + b.vy * dt;
  const z = b.z + vz * dt;
  const ground = heightAt(hole, x, y);
  if (z > ground) return { ...b, x, y, z, vz };
  events.push('land');
  return { ...b, x, y, z: ground, vx: b.vx * LAND_KEEP, vy: b.vy * LAND_KEEP, vz: 0, airborne: false };
}

function rollStep(b: Ball, hole: Hole, dt: number): Ball {
  const friction = frictionOf(surfaceAt(hole, b.x, b.y));
  const [gx, gy] = gradientAt(hole, b.x, b.y);
  const sx = b.vx - SLOPE_ACCEL * gx * dt;
  const sy = b.vy - SLOPE_ACCEL * gy * dt;
  const sp = Math.hypot(sx, sy);
  const keep = sp > 0 ? (sp - Math.min(sp, friction * dt)) / sp : 0;
  const vx = sx * keep;
  const vy = sy * keep;
  const x = b.x + vx * dt;
  const y = b.y + vy * dt;
  const ground = heightAt(hole, x, y);
  const groundVz = (ground - b.z) / dt;
  if (b.vz - groundVz > LAUNCH_DROP) {
    return { ...b, x, y, z: b.z + b.vz * dt, vx, vy, airborne: true };
  }
  return { ...b, x, y, z: ground, vx, vy, vz: groundVz };
}

function collide(b: Ball, hole: Hole, events: BallEvent[]): Ball {
  let x = b.x, y = b.y, vx = b.vx, vy = b.vy, hit = false;
  const pushOut = (px: number, py: number, minDist: number) => {
    const dx = x - px, dy = y - py;
    const d = Math.hypot(dx, dy);
    if (d >= minDist || d === 0) return;
    const nx = dx / d, ny = dy / d;
    x = px + nx * minDist;
    y = py + ny * minDist;
    const vn = vx * nx + vy * ny;
    if (vn < 0) {
      vx = (vx - 2 * vn * nx) * WALL_KEEP;
      vy = (vy - 2 * vn * ny) * WALL_KEEP;
      hit = true;
    }
  };
  for (const w of hole.walls) {
    const [px, py] = closestPointOnSegment([x, y], w.a, w.b);
    pushOut(px, py, BALL_R);
  }
  for (const c of hole.circles) pushOut(c.c[0], c.c[1], c.r + BALL_R);
  if (hit) events.push('wall');
  return x === b.x && y === b.y && vx === b.vx && vy === b.vy ? b : { ...b, x, y, vx, vy };
}

function settle(b: Ball, hole: Hole, events: BallEvent[]): Ball {
  if (![b.x, b.y, b.z, b.vx, b.vy, b.vz].every(Number.isFinite)) {
    events.push('water');
    return halt(b);
  }
  if (b.airborne) return b;
  const surf = surfaceAt(hole, b.x, b.y);
  if (surf === null || surf === 'W' || surf === 'X') {
    events.push('water');
    return halt(b);
  }
  const z = heightAt(hole, b.x, b.y);
  const sp = Math.hypot(b.vx, b.vy);
  const tx = hole.cup[0] - b.x, ty = hole.cup[1] - b.y;
  const overCup = Math.hypot(tx, ty) < CUP_R;
  if (overCup && sp < CAPTURE_SPEED) {
    events.push('holed');
    return { ...halt(b), x: hole.cup[0], y: hole.cup[1], z, overCup: true };
  }
  let vx = b.vx, vy = b.vy;
  if (overCup && !b.overCup) {
    events.push('lip');
    const side = Math.sign(vx * ty - vy * tx); // cup to the left (+) or right (-) of travel
    const a = -side * LIP_DEFLECT;
    [vx, vy] = [(vx * Math.cos(a) - vy * Math.sin(a)) * LIP_KEEP, (vx * Math.sin(a) + vy * Math.cos(a)) * LIP_KEEP];
  }
  const [gx, gy] = gradientAt(hole, b.x, b.y);
  if (Math.hypot(vx, vy) < STOP_SPEED && SLOPE_ACCEL * Math.hypot(gx, gy) < frictionOf(surf)) {
    events.push('stopped');
    return { ...halt(b), z, overCup };
  }
  return { ...b, z, vx, vy, overCup };
}

export function step(ball: Ball, hole: Hole, dt: number = STEP): StepResult {
  if (!isMoving(ball)) return { ball, events: [] };
  const events: BallEvent[] = [];
  const moved = ball.airborne ? flyStep(ball, hole, dt, events) : rollStep(ball, hole, dt);
  const walled = collide(moved, hole, events);
  return { ball: settle(walled, hole, events), events };
}
```

- [ ] **Step 4: Write `src/physics/simulate.ts`**

```ts
import type { Hole } from '../world/hole';
import { isMoving, step, strike, type Ball, type BallEvent } from './ball';
import { MAX_SIM_SECONDS, STEP } from './constants';

export type Outcome = 'holed' | 'stopped' | 'water' | 'timeout';

export interface ShotResult {
  readonly ball: Ball;
  readonly outcome: Outcome;
  readonly events: readonly BallEvent[];
  readonly steps: number;
}

const ENDINGS: readonly BallEvent[] = ['holed', 'water', 'stopped'];

export function simulateShot(hole: Hole, from: Ball, angle: number, power: number, maxSeconds = MAX_SIM_SECONDS): ShotResult {
  const maxSteps = Math.ceil(maxSeconds / STEP);
  let ball = strike(from, angle, power);
  const events: BallEvent[] = [];
  for (let i = 1; i <= maxSteps; i++) {
    const r = step(ball, hole);
    ball = r.ball;
    events.push(...r.events);
    const end = r.events.find((e) => ENDINGS.includes(e));
    if (end) return { ball, outcome: end as Outcome, events, steps: i };
    if (!isMoving(ball)) return { ball, outcome: 'stopped', events, steps: i };
  }
  return { ball, outcome: 'timeout', events, steps: maxSteps };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/ball.test.ts`
Expected: PASS. If the flat stopping-distance or wall-ratio test is off by a small margin, check the constants match Task 4 exactly before changing any test.

- [ ] **Step 6: Commit**

```bash
git add src/physics/ball.ts src/physics/simulate.ts tests/unit/ball.test.ts
git commit -m "feat: add ball physics (slopes, friction, walls, cup, water, hops)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Scoring and best total

**Files:**
- Create: `src/game/score.ts`
- Test: `tests/unit/score.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { BEST_KEY, STROKE_CAP, loadBest, saveBest, scoreLabel, totalStrokes, type KeyValueStore } from '../../src/game/score';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}
const brokenStore: KeyValueStore = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('denied'); },
};

describe('scoreLabel', () => {
  it.each([
    [1, 3, 'Hole in one!'],
    [1, 2, 'Hole in one!'],
    [1, 4, 'Hole in one!'],
    [2, 4, 'Eagle'],
    [2, 3, 'Birdie'],
    [3, 3, 'Par'],
    [4, 3, 'Bogey'],
    [5, 3, 'Double bogey'],
    [6, 2, '+4'],
  ])('%i strokes on par %i is %s', (strokes, par, label) => {
    expect(scoreLabel(strokes, par)).toBe(label);
  });
});

describe('totals', () => {
  it('sums strokes', () => {
    expect(totalStrokes([2, 3, 4])).toBe(9);
  });
  it('caps a hole at 6', () => {
    expect(STROKE_CAP).toBe(6);
  });
});

describe('best total', () => {
  it('returns null when nothing is stored', () => {
    expect(loadBest(memoryStore())).toBeNull();
  });
  it('reads a stored best', () => {
    expect(loadBest(memoryStore({ [BEST_KEY]: '9' }))).toBe(9);
  });
  it('ignores junk', () => {
    expect(loadBest(memoryStore({ [BEST_KEY]: 'abc' }))).toBeNull();
  });
  it('saves a new best and keeps a better old one', () => {
    const store = memoryStore({ [BEST_KEY]: '9' });
    expect(saveBest(store, 11)).toBe(9);
    expect(store.data[BEST_KEY]).toBe('9');
    expect(saveBest(store, 7)).toBe(7);
    expect(store.data[BEST_KEY]).toBe('7');
  });
  it('works without storage', () => {
    expect(loadBest(null)).toBeNull();
    expect(saveBest(null, 8)).toBe(8);
  });
  it('survives storage that throws', () => {
    expect(loadBest(brokenStore)).toBeNull();
    expect(saveBest(brokenStore, 8)).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/score.test.ts`
Expected: FAIL — cannot resolve `../../src/game/score`.

- [ ] **Step 3: Write the implementation**

```ts
export const STROKE_CAP = 6;
export const BEST_KEY = 'backyard-minigolf:best';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function scoreLabel(strokes: number, par: number): string {
  if (strokes === 1) return 'Hole in one!';
  const diff = strokes - par;
  if (diff <= -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double bogey';
  return `+${diff}`;
}

export function totalStrokes(strokes: readonly number[]): number {
  return strokes.reduce((sum, s) => sum + s, 0);
}

export function loadBest(store: KeyValueStore | null): number | null {
  if (!store) return null;
  try {
    const n = Number.parseInt(store.getItem(BEST_KEY) ?? '', 10);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveBest(store: KeyValueStore | null, total: number): number {
  const previous = loadBest(store);
  const best = previous === null ? total : Math.min(previous, total);
  if (store && best !== previous) {
    try {
      store.setItem(BEST_KEY, String(best));
    } catch {
      // Storage blocked (private mode): the best just isn't kept.
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/score.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/score.ts tests/unit/score.test.ts
git commit -m "feat: add score labels, totals and best-total storage" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Game state machine

**Files:**
- Create: `src/game/state.ts`
- Test: `tests/unit/state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  HOLED_SECONDS, INTRO_SECONDS, chargePower, initialState, reduce, update, type GameState,
} from '../../src/game/state';
import { STEP } from '../../src/physics/constants';
import type { Hole } from '../../src/world/hole';
import { makeHole } from '../helpers/makeHole';

// Cup 2 tiles straight ahead of the tee: angle 0, power 0.45 drops in.
const HOLES: Hole[] = [
  makeHole({ width: 8, cup: [3.5, 2.5], par: 2 }),
  makeHole({ width: 8, cup: [3.5, 2.5], par: 3 }),
];
const SINK = { angle: 0, power: 0.45 };

function runUntil(s: GameState, pred: (s: GameState) => boolean, holes = HOLES, max = 10_000): GameState {
  let cur = s;
  for (let i = 0; i < max; i++) {
    if (pred(cur)) return cur;
    cur = update(cur, STEP, holes);
  }
  throw new Error('condition never reached');
}
const kind = (k: string) => (s: GameState) => s.phase.kind === k;
const aimingOn = (holes = HOLES) => runUntil(reduce(initialState(holes), { type: 'start' }, holes), kind('aiming'), holes);

describe('chargePower', () => {
  it('rises to full then falls back', () => {
    expect(chargePower(0)).toBe(0);
    expect(chargePower(0.5)).toBeCloseTo(0.5);
    expect(chargePower(1)).toBeCloseTo(1);
    expect(chargePower(1.5)).toBeCloseTo(0.5);
    expect(chargePower(2)).toBeCloseTo(0);
  });
});

describe('flow', () => {
  it('starts on the title', () => {
    const s = initialState(HOLES);
    expect(s.phase.kind).toBe('title');
    expect(s.strokes).toEqual([0]);
  });

  it('start shows the intro, then aiming after the intro time', () => {
    const s = reduce(initialState(HOLES), { type: 'start' }, HOLES);
    expect(s.phase.kind).toBe('intro');
    expect(update(s, INTRO_SECONDS / 2, HOLES).phase.kind).toBe('intro');
    expect(update(s, INTRO_SECONDS, HOLES).phase.kind).toBe('aiming');
  });

  it('press on the title also starts a game', () => {
    expect(reduce(initialState(HOLES), { type: 'press' }, HOLES).phase.kind).toBe('intro');
  });

  it('press charges, release putts with the charged power', () => {
    const aiming = reduce(aimingOn(), { type: 'aim', angle: 0 }, HOLES);
    const charging = reduce(aiming, { type: 'press' }, HOLES);
    expect(charging.phase.kind).toBe('charging');
    const later = update(charging, 0.5, HOLES);
    const rolling = reduce(later, { type: 'release' }, HOLES);
    expect(rolling.phase.kind).toBe('rolling');
    expect(rolling.strokes[0]).toBe(1);
    expect(rolling.lastRest).toEqual(HOLES[0].tee);
    expect(rolling.ball.vx).toBeGreaterThan(0);
  });

  it('release without charging does nothing', () => {
    const s = aimingOn();
    expect(reduce(s, { type: 'release' }, HOLES)).toBe(s);
  });

  it('a hole in one shows the label, then moves to the next hole', () => {
    const rolling = reduce(aimingOn(), { type: 'putt', ...SINK }, HOLES);
    const holed = runUntil(rolling, kind('holed'));
    expect(holed.phase.kind === 'holed' && holed.phase.label).toBe('Hole in one!');
    expect(holed.events).toContain('holed');
    expect(update(holed, HOLED_SECONDS / 2, HOLES).phase.kind).toBe('holed');
    const next = update(holed, HOLED_SECONDS, HOLES);
    expect(next.phase.kind).toBe('intro');
    expect(next.holeIndex).toBe(1);
    expect(next.strokes).toEqual([1, 0]);
    expect([next.ball.x, next.ball.y]).toEqual(HOLES[1].tee);
  });

  it('shows the scorecard after the last hole', () => {
    let s = reduce(aimingOn(), { type: 'putt', ...SINK }, HOLES);
    s = runUntil(s, (x) => x.holeIndex === 1 && x.phase.kind === 'aiming');
    s = reduce(s, { type: 'putt', ...SINK }, HOLES);
    s = runUntil(s, kind('scorecard'));
    expect(s.strokes).toEqual([1, 1]);
  });

  it('a short putt stops and returns to aiming', () => {
    const s = runUntil(reduce(aimingOn(), { type: 'putt', angle: 0, power: 0.1 }, HOLES), kind('aiming'));
    expect(s.strokes[0]).toBe(1);
    expect(s.ball.x).toBeGreaterThan(HOLES[0].tee[0]);
  });
});

describe('penalties', () => {
  const WATER: Hole[] = [makeHole({ width: 12, rows: ['GGGGGGGGGGGG', 'GGGGGGGGGGGG', 'GGGGWWWGGGGG', 'GGGGGGGGGGGG', 'GGGGGGGGGGGG'], cup: [10.5, 2.5] })];

  it('water costs a stroke and puts the ball back where it was struck', () => {
    const s = runUntil(reduce(aimingOn(WATER), { type: 'putt', angle: 0, power: 0.6 }, WATER), kind('aiming'), WATER);
    expect(s.strokes[0]).toBe(2);
    expect([s.ball.x, s.ball.y]).toEqual(WATER[0].tee);
  });

  it('retry costs a stroke and returns the ball to the tee', () => {
    const moved = runUntil(reduce(aimingOn(), { type: 'putt', angle: 0, power: 0.1 }, HOLES), kind('aiming'));
    const retried = reduce(moved, { type: 'retry' }, HOLES);
    expect(retried.strokes[0]).toBe(2);
    expect([retried.ball.x, retried.ball.y]).toEqual(HOLES[0].tee);
    expect(retried.phase.kind).toBe('aiming');
  });

  it('retry is ignored while the ball rolls', () => {
    const rolling = reduce(aimingOn(), { type: 'putt', angle: 0, power: 0.5 }, HOLES);
    expect(reduce(rolling, { type: 'retry' }, HOLES)).toBe(rolling);
  });

  it('a hole ends at the stroke cap', () => {
    let s = aimingOn();
    for (let i = 0; i < 6; i++) s = reduce(s, { type: 'retry' }, HOLES);
    expect(s.phase.kind).toBe('holed');
    expect(s.strokes[0]).toBe(6);
    expect(s.phase.kind === 'holed' && s.phase.label).toBe('+4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/state.test.ts`
Expected: FAIL — cannot resolve `../../src/game/state`.

- [ ] **Step 3: Write the implementation**

```ts
import type { Hole, Vec2 } from '../world/hole';
import { isMoving, restingBall, step, strike, type Ball, type BallEvent } from '../physics/ball';
import { MAX_SIM_SECONDS } from '../physics/constants';
import { STROKE_CAP, scoreLabel } from './score';

export const INTRO_SECONDS = 1.5;
export const HOLED_SECONDS = 1.5;
export const CHARGE_PERIOD = 2;

export type Phase =
  | { readonly kind: 'title' }
  | { readonly kind: 'intro'; readonly t: number }
  | { readonly kind: 'aiming' }
  | { readonly kind: 'charging'; readonly t: number }
  | { readonly kind: 'rolling'; readonly t: number }
  | { readonly kind: 'holed'; readonly t: number; readonly label: string }
  | { readonly kind: 'scorecard' };

export interface GameState {
  readonly phase: Phase;
  readonly holeIndex: number;
  /** Strokes per hole played so far; the current hole is `strokes[holeIndex]`. */
  readonly strokes: readonly number[];
  readonly ball: Ball;
  /** Where the ball was last struck from (water resets here). */
  readonly lastRest: Vec2;
  /** Aim angle in radians, in grid space. */
  readonly aim: number;
  /** Ball events from the latest update (for sounds and effects). */
  readonly events: readonly BallEvent[];
}

export type Action =
  | { readonly type: 'start' }
  | { readonly type: 'aim'; readonly angle: number }
  | { readonly type: 'press' }
  | { readonly type: 'release' }
  | { readonly type: 'retry' }
  | { readonly type: 'putt'; readonly angle: number; readonly power: number };

/** Power 0..1 after charging for t seconds: rises to 1, falls back to 0, repeats. */
export function chargePower(t: number): number {
  const half = CHARGE_PERIOD / 2;
  const m = ((t % CHARGE_PERIOD) + CHARGE_PERIOD) % CHARGE_PERIOD;
  return m <= half ? m / half : (CHARGE_PERIOD - m) / half;
}

const atTee = (hole: Hole): Ball => restingBall(hole, hole.tee);
const current = (s: GameState): number => s.strokes[s.holeIndex];
const withStrokes = (s: GameState, n: number): GameState => ({
  ...s,
  strokes: s.strokes.map((v, i) => (i === s.holeIndex ? n : v)),
});

export function initialState(holes: readonly Hole[]): GameState {
  const first = holes[0];
  return { phase: { kind: 'title' }, holeIndex: 0, strokes: [0], ball: atTee(first), lastRest: first.tee, aim: 0, events: [] };
}

function newGame(holes: readonly Hole[]): GameState {
  return { ...initialState(holes), phase: { kind: 'intro', t: 0 } };
}

function finishHole(s: GameState, holes: readonly Hole[]): GameState {
  const strokes = Math.min(current(s), STROKE_CAP);
  return { ...withStrokes(s, strokes), phase: { kind: 'holed', t: 0, label: scoreLabel(strokes, holes[s.holeIndex].par) } };
}

/** Back to aiming, unless the stroke cap has been reached. */
function ready(s: GameState, holes: readonly Hole[]): GameState {
  return current(s) >= STROKE_CAP ? finishHole(s, holes) : { ...s, phase: { kind: 'aiming' } };
}

function shoot(s: GameState, angle: number, power: number): GameState {
  return {
    ...withStrokes(s, current(s) + 1),
    ball: strike(s.ball, angle, power),
    lastRest: [s.ball.x, s.ball.y],
    aim: angle,
    phase: { kind: 'rolling', t: 0 },
  };
}

export function reduce(s: GameState, a: Action, holes: readonly Hole[]): GameState {
  const p = s.phase;
  switch (a.type) {
    case 'start':
      return newGame(holes);
    case 'aim':
      return { ...s, aim: a.angle };
    case 'press':
      if (p.kind === 'title' || p.kind === 'scorecard') return newGame(holes);
      return p.kind === 'aiming' ? { ...s, phase: { kind: 'charging', t: 0 } } : s;
    case 'release':
      return p.kind === 'charging' ? shoot(s, s.aim, chargePower(p.t)) : s;
    case 'putt':
      return p.kind === 'aiming' ? shoot(s, a.angle, a.power) : s;
    case 'retry': {
      if (p.kind !== 'aiming' && p.kind !== 'charging') return s;
      const hole = holes[s.holeIndex];
      return ready({ ...withStrokes(s, current(s) + 1), ball: atTee(hole), lastRest: hole.tee }, holes);
    }
  }
}

function advance(s: GameState, holes: readonly Hole[]): GameState {
  const next = s.holeIndex + 1;
  if (next >= holes.length) return { ...s, phase: { kind: 'scorecard' } };
  const hole = holes[next];
  return { ...s, holeIndex: next, strokes: [...s.strokes, 0], ball: atTee(hole), lastRest: hole.tee, phase: { kind: 'intro', t: 0 } };
}

function roll(s: GameState, t: number, dt: number, holes: readonly Hole[]): GameState {
  const hole = holes[s.holeIndex];
  const r = step(s.ball, hole, dt);
  const moved: GameState = { ...s, ball: r.ball, events: r.events, phase: { kind: 'rolling', t } };
  if (r.events.includes('holed')) return finishHole(moved, holes);
  if (r.events.includes('water')) {
    return ready({ ...withStrokes(moved, current(moved) + 1), ball: restingBall(hole, moved.lastRest) }, holes);
  }
  if (r.events.includes('stopped') || !isMoving(r.ball)) return ready(moved, holes);
  if (t > MAX_SIM_SECONDS) return ready({ ...moved, ball: { ...r.ball, vx: 0, vy: 0, vz: 0, airborne: false } }, holes);
  return moved;
}

/** Advance time by dt seconds. The main loop calls this with the fixed physics step. */
export function update(s: GameState, dt: number, holes: readonly Hole[]): GameState {
  const base = s.events.length > 0 ? { ...s, events: [] } : s;
  const p = base.phase;
  switch (p.kind) {
    case 'intro':
      return { ...base, phase: p.t + dt >= INTRO_SECONDS ? { kind: 'aiming' } : { kind: 'intro', t: p.t + dt } };
    case 'charging':
      return { ...base, phase: { kind: 'charging', t: p.t + dt } };
    case 'holed':
      return p.t + dt >= HOLED_SECONDS ? advance(base, holes) : { ...base, phase: { ...p, t: p.t + dt } };
    case 'rolling':
      return roll(base, p.t + dt, dt, holes);
    default:
      return base;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/state.ts tests/unit/state.test.ts
git commit -m "feat: add game state machine (intro, aim, charge, roll, holed, scorecard)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Projection, loop stepper and input mapping

**Files:**
- Create: `src/render/iso.ts`, `src/core/loop.ts`, `src/core/input.ts`
- Test: `tests/unit/iso.test.ts`, `tests/unit/loop.test.ts`, `tests/unit/input.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/unit/iso.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CENTER_DROP, depthOf, project, sortByDepth, unproject, viewFor } from '../../src/render/iso';
import { makeHole } from '../helpers/makeHole';

describe('iso projection', () => {
  const view = { ox: 100, oy: 50 };

  it('maps the grid origin to the view origin', () => {
    expect(project(view, 0, 0, 0)).toEqual([100, 50]);
  });

  it('moves right-down for +x and left-down for +y, up for +z', () => {
    expect(project(view, 1, 0, 0)).toEqual([116, 58]);
    expect(project(view, 0, 1, 0)).toEqual([84, 58]);
    expect(project(view, 0, 0, 1)).toEqual([100, 34]);
  });

  it('unproject undoes project at a given height', () => {
    const [sx, sy] = project(view, 3.25, 1.5, 0.5);
    const [x, y] = unproject(view, sx, sy, 0.5);
    expect(x).toBeCloseTo(3.25);
    expect(y).toBeCloseTo(1.5);
  });

  it('centres a hole in the buffer', () => {
    const hole = makeHole({ width: 12, depth: 8, tee: [1.5, 2.5], cup: [10.5, 2.5] });
    const v = viewFor(hole, 360, 270);
    expect(project(v, 6, 4, 0)).toEqual([180, 135 + CENTER_DROP]);
  });

  it('sorts by depth, back to front', () => {
    const items = [{ depth: depthOf(5, 5) }, { depth: depthOf(1, 1) }, { depth: depthOf(5, 4) }];
    expect(sortByDepth(items).map((i) => i.depth)).toEqual([2, 9, 10]);
    expect(items[0].depth).toBe(10); // input untouched
  });
});
```

`tests/unit/loop.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createStepper } from '../../src/core/loop';

describe('createStepper', () => {
  it('turns elapsed time into whole fixed steps', () => {
    const steps = createStepper(1 / 120);
    expect(steps(1 / 60)).toBe(2);
  });
  it('carries leftover time to the next frame', () => {
    const steps = createStepper(1 / 120);
    expect(steps(1 / 240)).toBe(0);
    expect(steps(1 / 240)).toBe(1);
  });
  it('caps the steps after a long pause', () => {
    const steps = createStepper(1 / 120, 12);
    expect(steps(5)).toBe(12);
    expect(steps(1 / 120)).toBe(1);
  });
  it('ignores negative time', () => {
    expect(createStepper(1 / 120)(-1)).toBe(0);
  });
});
```

`tests/unit/input.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { toBuffer } from '../../src/core/input';

describe('toBuffer', () => {
  it('maps a click on a scaled canvas to buffer pixels', () => {
    const rect = { left: 10, top: 20, width: 720, height: 540 };
    expect(toBuffer(10, 20, rect, 360, 270)).toEqual([0, 0]);
    expect(toBuffer(370, 290, rect, 360, 270)).toEqual([180, 135]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/iso.test.ts tests/unit/loop.test.ts tests/unit/input.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/render/iso.ts`**

```ts
import type { Vec2 } from '../core/geometry';
import type { Hole } from '../world/hole';

export const TILE_W = 32;
export const TILE_H = 16;
/** Screen pixels per tile of height. */
export const Z_PX = 16;
/** Push the hole a little below centre so tall props have room above it. */
export const CENTER_DROP = 12;

export interface View {
  readonly ox: number;
  readonly oy: number;
}

export function project(v: View, x: number, y: number, z: number): Vec2 {
  return [v.ox + ((x - y) * TILE_W) / 2, v.oy + ((x + y) * TILE_H) / 2 - z * Z_PX];
}

export function unproject(v: View, sx: number, sy: number, z = 0): Vec2 {
  const a = (sx - v.ox) / (TILE_W / 2); // x - y
  const b = (sy - v.oy + z * Z_PX) / (TILE_H / 2); // x + y
  return [(a + b) / 2, (b - a) / 2];
}

export function viewFor(hole: Hole, bufW: number, bufH: number): View {
  const cx = hole.width / 2;
  const cy = hole.depth / 2;
  return {
    ox: bufW / 2 - ((cx - cy) * TILE_W) / 2,
    oy: bufH / 2 + CENTER_DROP - ((cx + cy) * TILE_H) / 2,
  };
}

/** Larger depth = closer to the viewer = drawn later. */
export function depthOf(x: number, y: number, z = 0): number {
  return x + y + z * 0.01;
}

export function sortByDepth<T extends { readonly depth: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.depth - b.depth);
}
```

- [ ] **Step 4: Write `src/core/loop.ts`**

```ts
/** Returns a function that converts frame time into a whole number of fixed steps, carrying the remainder. */
export function createStepper(stepSeconds: number, maxSteps = 12): (dt: number) => number {
  let acc = 0;
  return (dt: number) => {
    acc += Math.max(0, dt);
    const n = Math.min(maxSteps, Math.floor(acc / stepSeconds + 1e-9));
    acc = n === maxSteps ? 0 : Math.max(0, acc - n * stepSeconds);
    return n;
  };
}

/** Calls `frame(dt)` every animation frame (dt in seconds, capped at 0.25). Returns a stop function. */
export function startLoop(frame: (dt: number) => void): () => void {
  let last = performance.now();
  let id = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    frame(dt);
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}
```

- [ ] **Step 5: Write `src/core/input.ts`**

```ts
export type InputEvent =
  | { readonly type: 'aimAt'; readonly sx: number; readonly sy: number }
  | { readonly type: 'press' | 'release' | 'retry' | 'escape' };

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export function toBuffer(clientX: number, clientY: number, rect: Rect, bufW: number, bufH: number): [number, number] {
  return [((clientX - rect.left) * bufW) / rect.width, ((clientY - rect.top) * bufH) / rect.height];
}

/** Listens for mouse and keyboard input and reports it as InputEvents. Returns a detach function. */
export function attachInput(canvas: HTMLCanvasElement, bufW: number, bufH: number, push: (e: InputEvent) => void): () => void {
  const onMove = (e: MouseEvent) => {
    const [sx, sy] = toBuffer(e.clientX, e.clientY, canvas.getBoundingClientRect(), bufW, bufH);
    push({ type: 'aimAt', sx, sy });
  };
  const onDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    push({ type: 'press' });
  };
  const onUp = (e: MouseEvent) => {
    if (e.button === 0) push({ type: 'release' });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) push({ type: 'press' });
    } else if (e.code === 'KeyR' && !e.repeat) {
      push({ type: 'retry' });
    } else if (e.code === 'Escape') {
      push({ type: 'escape' });
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') push({ type: 'release' });
  };
  window.addEventListener('mousemove', onMove);
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  return () => {
    window.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/unit/iso.test.ts tests/unit/loop.test.ts tests/unit/input.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/render/iso.ts src/core/loop.ts src/core/input.ts tests/unit/iso.test.ts tests/unit/loop.test.ts tests/unit/input.test.ts
git commit -m "feat: add iso projection, fixed-step loop and input mapping" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: The three Backyard holes and manifest

**Files:**
- Create: `assets/manifest.json`, `src/world/holes/01.json`, `src/world/holes/02.json`, `src/world/holes/03.json`
- Test: `tests/unit/holes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import manifestJson from '../../assets/manifest.json';
import hole1 from '../../src/world/holes/01.json';
import hole2 from '../../src/world/holes/02.json';
import hole3 from '../../src/world/holes/03.json';
import { parseManifest } from '../../src/world/manifest';
import { parseHole } from '../../src/world/hole';

const manifest = parseManifest(manifestJson);
const holes = [hole1, hole2, hole3].map((raw, i) => parseHole(raw, manifest, `holes/0${i + 1}.json`));

describe('Backyard holes', () => {
  it('all load', () => {
    expect(holes.map((h) => h.name)).toEqual(['Gnome Alley', 'Picket Bank', 'Pool Hop']);
    expect(holes.map((h) => h.par)).toEqual([2, 3, 3]);
  });

  it('fit in the 360×270 buffer at 32 px tiles', () => {
    for (const h of holes) {
      expect((h.width + h.depth) * 16).toBeLessThanOrEqual(360); // screen width of the diamond
      expect((h.width + h.depth) * 8).toBeLessThanOrEqual(200); // screen height, leaving room for props
    }
  });

  it('hole 3 has water between the tee and the cup', () => {
    expect(holes[2].surface.some((row) => row.includes('W'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/holes.test.ts`
Expected: FAIL — cannot resolve `../../assets/manifest.json`.

- [ ] **Step 3: Create `assets/manifest.json`**

```json
{
  "gnome": { "footprint": { "kind": "circle", "r": 0.3 }, "placeholder": { "color": "#c8463c", "w": 6, "h": 10 } },
  "big-gnome": { "footprint": { "kind": "circle", "r": 0.5 }, "placeholder": { "color": "#c8463c", "w": 12, "h": 18 } },
  "flowerpot": { "footprint": { "kind": "circle", "r": 0.2 }, "placeholder": { "color": "#b5653a", "w": 6, "h": 6 } },
  "bush": { "footprint": { "kind": "circle", "r": 0.4 }, "placeholder": { "color": "#3f6b3a", "w": 14, "h": 12 } },
  "lamp": { "footprint": { "kind": "circle", "r": 0.1 }, "placeholder": { "color": "#4a4a52", "w": 2, "h": 26 } }
}
```

- [ ] **Step 4: Create `src/world/holes/01.json`** — Gnome Alley: straight lane, gentle rise in the middle.

```json
{
  "name": "Gnome Alley",
  "par": 2,
  "size": [12, 7],
  "height": [
    [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2]
  ],
  "surface": [
    "RRRRRRRRRRRR",
    "GGGGGGGGGGGG",
    "GGGGGGGGGGGG",
    "GGGGGGGGGGGG",
    "GGGGGGGGGGGG",
    "GGGGGGGGGGGG",
    "RRRRRRRRRRRR"
  ],
  "tee": [1.5, 3.5],
  "cup": [10.5, 3.5],
  "props": [
    { "sprite": "gnome", "at": [3.5, 0.5] },
    { "sprite": "gnome", "at": [8.5, 6.5] },
    { "sprite": "flowerpot", "at": [11.5, 0.5] },
    { "sprite": "bush", "at": [0.5, 6.5] }
  ]
}
```

- [ ] **Step 5: Create `src/world/holes/02.json`** — Picket Bank: an L, gnome guarding the corner, bank off the fence.

```json
{
  "name": "Picket Bank",
  "par": 3,
  "size": [12, 10],
  "height": [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  ],
  "surface": [
    "GGGGGGGGGGGG",
    "GGGGGGGGGGGG",
    "GGGGGGGGGGGG",
    "GGGGGGGGGGGG",
    "XXXXXXXXGGGG",
    "XXXXXXXXGGGG",
    "XXXXXXXXGGGG",
    "XXXXXXXXGGGG",
    "XXXXXXXXGGGG",
    "XXXXXXXXGGGG"
  ],
  "tee": [1.5, 1.5],
  "cup": [9.5, 8.5],
  "props": [
    { "sprite": "big-gnome", "at": [10, 2] },
    { "sprite": "flowerpot", "at": [0.5, 3.5] },
    { "sprite": "lamp", "at": [11.5, 9.5] }
  ]
}
```

- [ ] **Step 6: Create `src/world/holes/03.json`** — Pool Hop: ramp over the kiddie pool to a raised green, or round through the rough.

```json
{
  "name": "Pool Hop",
  "par": 3,
  "size": [14, 7],
  "height": [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 3, 0, 0, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 3, 0, 0, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 3, 0, 0, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 1, 3, 0, 0, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2]
  ],
  "surface": [
    "RRRRRRRRRRRRRR",
    "RRRRRRRRRRGGGR",
    "GGGGGGWWWGGGGG",
    "GGGGGGWWWGGGGG",
    "GGGGGGWWWGGGGG",
    "RRRRRRRRRRGGGR",
    "RRRRRRRRRRRRRR"
  ],
  "tee": [1.5, 3.5],
  "cup": [12.5, 3.5],
  "props": [
    { "sprite": "lamp", "at": [13.5, 0.5] },
    { "sprite": "flowerpot", "at": [0.5, 0.5] },
    { "sprite": "bush", "at": [0.5, 6.5] },
    { "sprite": "gnome", "at": [9.5, 6.5] }
  ]
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/unit/holes.test.ts`
Expected: PASS (3 tests). If a hole fails validation, the error names the file and field — fix the JSON, not the loader.

- [ ] **Step 8: Commit**

```bash
git add assets/manifest.json src/world/holes tests/unit/holes.test.ts
git commit -m "feat: add the three Backyard holes and placeholder sprite manifest" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Hole solver and solvability test

Proves every hole can be finished in par or better with the current physics, and gives the end-to-end test a known line.

**Files:**
- Create: `scripts/solve-hole.ts`, `tests/fixtures/solutions.ts`
- Modify: `tests/unit/holes.test.ts` (append a test)

- [ ] **Step 1: Write `scripts/solve-hole.ts`**

```ts
// Usage: npm run solve -- <hole number 1..3>
// Greedy search: each stroke tries a coarse grid of angles × powers, refines the best,
// and stops as soon as a stroke sinks the ball. Prints JSON: { hole, holed, shots: [[angleDeg, power], ...] }.
import { readFileSync } from 'node:fs';
import manifestJson from '../assets/manifest.json';
import { parseManifest } from '../src/world/manifest';
import { parseHole, type Hole } from '../src/world/hole';
import { restingBall, type Ball } from '../src/physics/ball';
import { simulateShot, type ShotResult } from '../src/physics/simulate';

type Shot = readonly [number, number];
interface Candidate { shot: Shot; result: ShotResult; dist: number }

const range = (from: number, to: number, stepSize: number): number[] =>
  Array.from({ length: Math.round((to - from) / stepSize) + 1 }, (_, i) => Number((from + i * stepSize).toFixed(4)));

function search(hole: Hole, ball: Ball, angles: number[], powers: number[]): Candidate | null {
  let best: Candidate | null = null;
  for (const a of angles) {
    for (const p of powers) {
      const result = simulateShot(hole, ball, (a * Math.PI) / 180, p);
      if (result.outcome === 'holed') return { shot: [a, p], result, dist: 0 };
      if (result.outcome !== 'stopped') continue;
      const dist = Math.hypot(result.ball.x - hole.cup[0], result.ball.y - hole.cup[1]);
      if (!best || dist < best.dist) best = { shot: [a, p], result, dist };
    }
  }
  return best;
}

function solve(hole: Hole): { holed: boolean; shots: Shot[] } {
  let ball = restingBall(hole, hole.tee);
  const shots: Shot[] = [];
  for (let stroke = 0; stroke < hole.par; stroke++) {
    const coarse = search(hole, ball, range(-180, 178, 2), range(0.05, 1, 0.05));
    if (!coarse) break;
    const pick = coarse.dist === 0 ? coarse : search(
      hole, ball,
      range(coarse.shot[0] - 2, coarse.shot[0] + 2, 0.25),
      range(Math.max(0.02, coarse.shot[1] - 0.05), Math.min(1, coarse.shot[1] + 0.05), 0.005),
    ) ?? coarse;
    shots.push(pick.shot);
    if (pick.dist === 0) return { holed: true, shots };
    ball = pick.result.ball;
  }
  return { holed: false, shots };
}

const n = Number(process.argv[2]);
if (![1, 2, 3].includes(n)) {
  console.error('Usage: npm run solve -- <1|2|3>');
  process.exit(2);
}
const file = `src/world/holes/0${n}.json`;
const hole = parseHole(JSON.parse(readFileSync(file, 'utf8')), parseManifest(manifestJson), file);
const result = solve(hole);
console.log(JSON.stringify({ hole: hole.name, ...result }));
process.exitCode = result.holed ? 0 : 1;
```

- [ ] **Step 2: Run the solver for each hole**

Run:
```bash
npm run solve -- 1
npm run solve -- 2
npm run solve -- 3
```
Expected: each prints a line like `{"hole":"Gnome Alley","holed":true,"shots":[[0,0.87]]}` and exits 0.

If a hole prints `"holed":false`, the hole is too hard for the physics. Adjust **that hole's JSON** (e.g. hole 3: lower the ramp lip from `3` to `2`, or move the raised green's start one column left) and rerun until it solves. Do not change physics constants here; the physics tests pin them.

- [ ] **Step 3: Create `tests/fixtures/solutions.ts`** with the solver output

Copy each hole's `shots` array from Step 2 into this file exactly (example values shown — replace them with your solver's output):

```ts
/** Known par-or-better lines from `npm run solve`, as [angle in degrees, power 0..1] per stroke. */
export const SOLUTIONS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  'Gnome Alley': [[0, 0.87]],
  'Picket Bank': [[2, 0.9], [90, 0.75]],
  'Pool Hop': [[0, 1]],
};
```

- [ ] **Step 4: Append the solvability test to `tests/unit/holes.test.ts`**

Add these imports at the top of the file:
```ts
import { restingBall } from '../../src/physics/ball';
import { simulateShot } from '../../src/physics/simulate';
import { SOLUTIONS } from '../fixtures/solutions';
```

Append this block at the end of the file:
```ts
describe('Backyard holes are solvable in par', () => {
  it.each(holes.map((h) => [h.name, h] as const))('%s', (_name, hole) => {
    const shots = SOLUTIONS[hole.name];
    expect(shots.length).toBeLessThanOrEqual(hole.par);
    let ball = restingBall(hole, hole.tee);
    let outcome = '';
    for (const [deg, power] of shots) {
      const r = simulateShot(hole, ball, (deg * Math.PI) / 180, power);
      ball = r.ball;
      outcome = r.outcome;
    }
    expect(outcome).toBe('holed');
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/holes.test.ts`
Expected: PASS (3 + 3 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/solve-hole.ts tests/fixtures/solutions.ts tests/unit/holes.test.ts src/world/holes
git commit -m "test: add hole solver and prove each hole is solvable in par" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Placeholder terrain drawing

Drawing code is checked by eye (Task 14), not unit-tested; the pure shading helper is tested.

**Files:**
- Create: `src/render/terrain-draw.ts`
- Test: `tests/unit/terrain-draw.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { shadeColor, tileShade } from '../../src/render/terrain-draw';

describe('tileShade', () => {
  it('is neutral on flat rough', () => {
    expect(tileShade(0, 0, 0, 0, 'R')).toBe(1);
  });
  it('lights faces that rise to +x and darkens faces that fall', () => {
    expect(tileShade(0.5, 0, 0, 0, 'R')).toBeGreaterThan(1);
    expect(tileShade(-0.5, 0, 0, 0, 'R')).toBeLessThan(1);
  });
  it('stripes the green like a mown lawn', () => {
    expect(tileShade(0, 0, 0, 0, 'G')).not.toBe(tileShade(0, 0, 1, 0, 'G'));
  });
  it('stays within bounds', () => {
    expect(tileShade(10, 0, 0, 0, 'R')).toBeLessThanOrEqual(1.4);
    expect(tileShade(-10, 0, 0, 0, 'R')).toBeGreaterThanOrEqual(0.6);
  });
});

describe('shadeColor', () => {
  it('scales and clamps channels', () => {
    expect(shadeColor([100, 200, 250], 1.2)).toBe('rgb(120,240,255)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/terrain-draw.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
import type { Vec2 } from '../core/geometry';
import type { Hole, Surface } from '../world/hole';
import { project, type View } from './iso';

type RGB = readonly [number, number, number];

const TOP: Readonly<Record<Surface, RGB>> = {
  G: [111, 174, 92],
  R: [78, 128, 62],
  S: [222, 200, 140],
  W: [90, 160, 200],
  X: [0, 0, 0],
};
const SIDE_LEFT: RGB = [110, 82, 58];
const SIDE_RIGHT: RGB = [84, 62, 44];
/** How far the island's earth sides hang below height 0, in tiles. */
const BASE_Z = -0.5;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Brightness for a tile from its slope (light from screen upper-left) plus mown stripes on green. */
export function tileShade(dhdx: number, dhdy: number, x: number, y: number, surface: Surface): number {
  const light = 1 + 0.6 * dhdx + 0.2 * dhdy;
  const stripe = surface === 'G' ? ((x + y) % 2 === 0 ? 1.04 : 0.97) : 1;
  return clamp(light * stripe, 0.6, 1.4);
}

export function shadeColor(c: RGB, k: number): string {
  const [r, g, b] = c.map((v) => Math.round(clamp(v * k, 0, 255)));
  return `rgb(${r},${g},${b})`;
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: readonly Vec2[], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function drawTile(ctx: CanvasRenderingContext2D, hole: Hole, view: View, x: number, y: number): void {
  const surface = hole.surface[y][x] as Surface;
  if (surface === 'X') return;
  const h = hole.heights;
  const h00 = h[y][x], h10 = h[y][x + 1], h01 = h[y + 1][x], h11 = h[y + 1][x + 1];
  const pts = [project(view, x, y, h00), project(view, x + 1, y, h10), project(view, x + 1, y + 1, h11), project(view, x, y + 1, h01)];
  const dhdx = (h10 - h00 + (h11 - h01)) / 2;
  const dhdy = (h01 - h00 + (h11 - h10)) / 2;
  fillPoly(ctx, pts, shadeColor(TOP[surface], tileShade(dhdx, dhdy, x, y, surface)));
}

function drawSides(ctx: CanvasRenderingContext2D, hole: Hole, view: View): void {
  const solid = (x: number, y: number) => x >= hole.width || y >= hole.depth || hole.surface[y][x] === 'X';
  const h = hole.heights;
  for (let y = 0; y < hole.depth; y++) {
    for (let x = 0; x < hole.width; x++) {
      if (hole.surface[y][x] === 'X') continue;
      if (solid(x, y + 1)) {
        fillPoly(ctx, [
          project(view, x, y + 1, h[y + 1][x]), project(view, x + 1, y + 1, h[y + 1][x + 1]),
          project(view, x + 1, y + 1, BASE_Z), project(view, x, y + 1, BASE_Z),
        ], shadeColor(SIDE_LEFT, 1));
      }
      if (solid(x + 1, y)) {
        fillPoly(ctx, [
          project(view, x + 1, y, h[y][x + 1]), project(view, x + 1, y + 1, h[y + 1][x + 1]),
          project(view, x + 1, y + 1, BASE_Z), project(view, x + 1, y, BASE_Z),
        ], shadeColor(SIDE_RIGHT, 1));
      }
    }
  }
}

/** Draws the hole's ground once into an offscreen canvas the size of the buffer. */
export function drawTerrain(hole: Hole, view: View, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  for (let s = 0; s <= hole.width + hole.depth - 2; s++) {
    for (let y = 0; y < hole.depth; y++) {
      const x = s - y;
      if (x >= 0 && x < hole.width) drawTile(ctx, hole, view, x, y);
    }
  }
  drawSides(ctx, hole, view);
  return canvas;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/terrain-draw.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/terrain-draw.ts tests/unit/terrain-draw.test.ts
git commit -m "feat: add flat-shaded placeholder terrain drawing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Frame renderer

**Files:**
- Create: `src/render/renderer.ts`

- [ ] **Step 1: Write `src/render/renderer.ts`**

```ts
import type { Vec2 } from '../core/geometry';
import type { GameState } from '../game/state';
import { heightAt } from '../physics/terrain';
import type { Hole } from '../world/hole';
import type { Manifest } from '../world/manifest';
import { depthOf, project, sortByDepth, type View } from './iso';

export interface Frame {
  readonly state: GameState;
  readonly hole: Hole;
  readonly view: View;
  readonly terrain: CanvasImageSource;
  readonly manifest: Manifest;
  readonly width: number;
  readonly height: number;
}

interface Drawable {
  readonly depth: number;
  draw(ctx: CanvasRenderingContext2D): void;
}

const COLORS = {
  bg: '#1b2a2f', ball: '#ffffff', shadow: 'rgba(0,0,0,0.35)', cup: '#151515',
  fence: '#efe6d2', fenceSide: '#b8ad96', shirt: '#3d6fb6', legs: '#2f3b52', skin: '#e7b98f',
  pole: '#dddddd', flag: '#e5483b', aim: '#ffffff', aimShadow: 'rgba(0,0,0,0.5)', propSide: 'rgba(0,0,0,0.25)',
} as const;
const FENCE_H = 0.3;
const AIM_DOTS = 6;
const AIM_SPACING = 0.3;

function poly(ctx: CanvasRenderingContext2D, pts: readonly Vec2[], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function ground(f: Frame, x: number, y: number, lift = 0): Vec2 {
  return project(f.view, x, y, heightAt(f.hole, x, y) + lift);
}

function walls(f: Frame): Drawable[] {
  return f.hole.walls.map((w) => {
    const [ax, ay] = w.a;
    const [bx, by] = w.b;
    const pts = [ground(f, ax, ay), ground(f, bx, by), ground(f, bx, by, FENCE_H), ground(f, ax, ay, FENCE_H)];
    const color = ax === bx ? COLORS.fenceSide : COLORS.fence;
    return { depth: depthOf((ax + bx) / 2, (ay + by) / 2), draw: (ctx) => poly(ctx, pts, color) };
  });
}

function props(f: Frame): Drawable[] {
  return f.hole.props.map((p) => {
    const { color, w, h } = f.manifest[p.sprite].placeholder;
    const [sx, sy] = ground(f, p.at[0], p.at[1]);
    return {
      depth: depthOf(p.at[0], p.at[1]),
      draw: (ctx) => {
        rect(ctx, sx - w / 2, sy - h, w, h, color);
        rect(ctx, sx, sy - h, Math.ceil(w / 2), h, COLORS.propSide);
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
      rect(ctx, sx + 1, sy - 16, 6, 4, COLORS.flag);
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

function golfer(f: Frame): Drawable[] {
  const k = f.state.phase.kind;
  if (k !== 'aiming' && k !== 'charging') return [];
  const { ball: b, aim } = f.state;
  const x = b.x + Math.cos(aim + Math.PI / 2) * 0.35 - Math.cos(aim) * 0.15;
  const y = b.y + Math.sin(aim + Math.PI / 2) * 0.35 - Math.sin(aim) * 0.15;
  const [sx, sy] = ground(f, x, y);
  return [{
    depth: depthOf(x, y),
    draw: (ctx) => {
      rect(ctx, sx - 2, sy - 6, 4, 6, COLORS.legs);
      rect(ctx, sx - 3, sy - 13, 6, 7, COLORS.shirt);
      rect(ctx, sx - 2, sy - 17, 4, 4, COLORS.skin);
    },
  }];
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
  const { ball: b, aim } = f.state;
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

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/render/renderer.ts
git commit -m "feat: add frame renderer with depth-sorted placeholder sprites" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: HUD and boot wiring

**Files:**
- Create: `src/ui/hud.ts`
- Modify: `src/main.ts` (replace the placeholder entirely)

- [ ] **Step 1: Write `src/ui/hud.ts`**

```ts
import { totalStrokes } from '../game/score';
import { chargePower, type GameState } from '../game/state';
import type { Hole } from '../world/hole';

export interface HudCallbacks {
  onPlay(): void;
  onResume(): void;
  onRestart(): void;
}

export interface Hud {
  update(state: GameState, holes: readonly Hole[], best: number | null, menuOpen: boolean): void;
  showError(message: string): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function stat(label: string, testId: string): { box: HTMLDivElement; value: HTMLElement } {
  const box = el('div', 'stat');
  const value = el('b');
  value.dataset.testid = testId;
  box.append(value, el('span', undefined, label));
  return { box, value };
}

function overlay(): { root: HTMLDivElement; card: HTMLDivElement } {
  const root = el('div', 'overlay');
  const card = el('div', 'card');
  root.append(card);
  return { root, card };
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', undefined, label);
  b.addEventListener('click', onClick);
  return b;
}

function row(cells: readonly string[], tag: 'td' | 'th'): HTMLTableRowElement {
  const r = el('tr');
  r.append(...cells.map((c) => el(tag, undefined, c)));
  return r;
}

function fillScorecard(table: HTMLTableElement, strokes: readonly number[], holes: readonly Hole[]): void {
  const parTotal = holes.reduce((sum, h) => sum + h.par, 0);
  table.replaceChildren(
    row(['Hole', 'Par', 'Strokes'], 'th'),
    ...holes.map((h, i) => row([`${i + 1} ${h.name}`, String(h.par), String(strokes[i] ?? '-')], 'td')),
    row(['Total', String(parTotal), String(totalStrokes(strokes))], 'th'),
  );
}

export function createHud(root: HTMLElement, cb: HudCallbacks): Hud {
  const hole = stat('Hole', 'hole');
  const par = stat('Par', 'par');
  const strokes = stat('Strokes', 'strokes');
  const bar = el('div', 'bar');
  bar.append(hole.box, par.box, strokes.box);

  const power = el('div', 'power');
  const fill = el('i');
  power.append(fill);

  const popup = el('div', 'popup');
  popup.dataset.testid = 'popup';
  const hint = el('div', 'hint', 'Mouse: aim · Hold click or Space: power · R: retry (+1) · Esc: menu');

  const title = overlay();
  title.card.append(el('h1', undefined, 'Backyard'), el('p', undefined, '3 holes of mini-golf'), button('Play', cb.onPlay));
  const menu = overlay();
  menu.card.append(el('h1', undefined, 'Paused'), button('Resume', cb.onResume), button('Restart course', cb.onRestart));
  const score = overlay();
  const table = el('table');
  const bestLine = el('p');
  score.card.append(el('h1', undefined, 'Scorecard'), table, bestLine, button('Play again', cb.onPlay));
  const error = overlay();
  const errorText = el('p');
  error.card.append(errorText);

  root.append(bar, power, popup, hint, title.root, menu.root, score.root, error.root);
  let shownScorecard = '';

  return {
    update(state, holes, best, menuOpen) {
      const h = holes[state.holeIndex];
      const p = state.phase;
      hole.value.textContent = `${state.holeIndex + 1} · ${h.name}`;
      par.value.textContent = String(h.par);
      strokes.value.textContent = String(state.strokes[state.holeIndex] ?? 0);
      power.classList.toggle('on', p.kind === 'charging');
      fill.style.width = p.kind === 'charging' ? `${Math.round(chargePower(p.t) * 100)}%` : '0';
      const message = p.kind === 'holed' ? p.label : p.kind === 'intro' ? `${h.name} · Par ${h.par}` : '';
      popup.textContent = message;
      popup.classList.toggle('on', message !== '');
      title.root.classList.toggle('on', p.kind === 'title');
      menu.root.classList.toggle('on', menuOpen);
      score.root.classList.toggle('on', p.kind === 'scorecard');
      if (p.kind === 'scorecard') {
        const key = `${state.strokes.join(',')}|${best}`;
        if (key !== shownScorecard) {
          shownScorecard = key;
          fillScorecard(table, state.strokes, holes);
          bestLine.textContent = best === null ? '' : `Best total: ${best}`;
        }
      }
    },
    showError(message) {
      errorText.textContent = message;
      error.root.classList.add('on');
    },
  };
}
```

All text is set with `textContent`, never `innerHTML`.

- [ ] **Step 2: Replace `src/main.ts`**

```ts
import './style.css';
import manifestJson from '../assets/manifest.json';
import hole1 from './world/holes/01.json';
import hole2 from './world/holes/02.json';
import hole3 from './world/holes/03.json';
import { attachInput, type InputEvent } from './core/input';
import { createStepper, startLoop } from './core/loop';
import { loadBest, saveBest, totalStrokes, type KeyValueStore } from './game/score';
import { initialState, reduce, update, type Action, type GameState } from './game/state';
import { STEP } from './physics/constants';
import { unproject, viewFor } from './render/iso';
import { renderFrame } from './render/renderer';
import { drawTerrain } from './render/terrain-draw';
import { createHud } from './ui/hud';
import { parseHole, type Hole } from './world/hole';
import { parseManifest, type Manifest } from './world/manifest';

const BUF_W = 360;
const BUF_H = 270;
const LOAD_ERROR = "Couldn't load the Backyard — try refreshing";

interface Content {
  readonly manifest: Manifest;
  readonly holes: readonly Hole[];
}

function loadContent(): Content {
  const manifest = parseManifest(manifestJson);
  const holes = [hole1, hole2, hole3].map((raw, i) => parseHole(raw, manifest, `holes/0${i + 1}.json`));
  return { manifest, holes };
}

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

function boot(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hudRoot = document.getElementById('hud') as HTMLElement;
  let content: Content | null = null;
  let state: GameState | null = null;
  let menuOpen = false;

  const dispatch = (a: Action) => {
    if (content && state) state = reduce(state, a, content.holes);
  };
  const hud = createHud(hudRoot, {
    onPlay: () => dispatch({ type: 'start' }),
    onResume: () => { menuOpen = false; },
    onRestart: () => { menuOpen = false; dispatch({ type: 'start' }); },
  });

  const ctx = canvas.getContext('2d');
  try {
    content = loadContent();
  } catch (err) {
    console.error('Failed to load course data:', err);
    hud.showError(LOAD_ERROR);
    return;
  }
  if (!ctx) {
    console.error('2D canvas is not available');
    hud.showError(LOAD_ERROR);
    return;
  }
  const { holes, manifest } = content;
  state = initialState(holes);

  const views = holes.map((h) => viewFor(h, BUF_W, BUF_H));
  const terrains = new Map<number, HTMLCanvasElement>();
  const terrainFor = (i: number) => {
    const cached = terrains.get(i);
    if (cached) return cached;
    const made = drawTerrain(holes[i], views[i], BUF_W, BUF_H);
    terrains.set(i, made);
    return made;
  };

  const onInput = (e: InputEvent) => {
    if (!state) return;
    const kind = state.phase.kind;
    if (e.type === 'escape') {
      if (kind !== 'title' && kind !== 'scorecard') menuOpen = !menuOpen;
      return;
    }
    if (menuOpen) return;
    if (e.type === 'aimAt') {
      const b = state.ball;
      const [gx, gy] = unproject(views[state.holeIndex], e.sx, e.sy, b.z);
      dispatch({ type: 'aim', angle: Math.atan2(gy - b.y, gx - b.x) });
    } else {
      dispatch({ type: e.type });
    }
  };

  fitCanvas(canvas);
  window.addEventListener('resize', () => fitCanvas(canvas));
  attachInput(canvas, BUF_W, BUF_H, onInput);

  const storage = safeStorage();
  let best = loadBest(storage);
  let prevKind = state.phase.kind;
  const steps = createStepper(STEP);

  startLoop((dt) => {
    if (!state) return;
    if (!menuOpen) {
      const n = steps(dt);
      for (let i = 0; i < n; i++) state = update(state, STEP, holes);
    }
    if (state.phase.kind === 'scorecard' && prevKind !== 'scorecard') best = saveBest(storage, totalStrokes(state.strokes));
    prevKind = state.phase.kind;
    const i = state.holeIndex;
    renderFrame(ctx, { state, hole: holes[i], view: views[i], terrain: terrainFor(i), manifest, width: BUF_W, height: BUF_H });
    hud.update(state, holes, best, menuOpen);
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __minigolf: unknown }).__minigolf = {
      getState: () => state,
      putt: (angle: number, power: number) => dispatch({ type: 'putt', angle, power }),
    };
  }
}

boot();
```

- [ ] **Step 3: Type-check and run all unit tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all unit tests PASS.

- [ ] **Step 4: Play it by eye**

Run: `npm run dev` and open the printed URL (default `http://localhost:5173`).

Check each item:
- Title card shows "Backyard" with a Play button; clicking Play shows "Gnome Alley · Par 2", then the hole.
- The island is centred, green tiles have mown stripes, the rise in the middle of hole 1 is lighter, earth sides show on the front edges, fences line the edges.
- Moving the mouse swings the dotted aim line; the little golfer stands beside the ball.
- Holding the mouse button or Space fills the power bar up and back down; releasing putts.
- The ball slows on the rise, rolls back if too weak, drops into the cup when slow, and the popup shows the score label.
- Hole 2: the ball banks off fences and bounces off the big gnome. Hole 3: a strong putt hops off the ramp; landing in the pool shows the ball back where it was struck, strokes +1.
- R returns the ball to the tee (+1 stroke). Esc opens Paused with Resume / Restart course.
- After hole 3 the scorecard lists all holes, the total, and "Best total"; reload the page and finish again — the best total persists.

If something is off, fix it before committing. Visual layout bugs (things drawn in the wrong order, off-centre) belong in `iso.ts`/`renderer.ts`/`terrain-draw.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hud.ts src/main.ts
git commit -m "feat: wire HUD, input, loop and renderer into a playable game" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: End-to-end test

**Files:**
- Create: `tests/e2e/play.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { expect, test } from '@playwright/test';
import { SOLUTIONS } from '../fixtures/solutions';

interface Hook {
  getState(): { phase: { kind: string }; strokes: number[] };
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
```

Note: the spec described a scripted mouse aim and release. The power meter is time-based, which makes real mouse timing flaky in CI, so this test putts through the dev-only `window.__minigolf` hook (Task 14) using the solver's known line. The mouse path is covered by the manual check in Task 14, Step 4.

- [ ] **Step 2: Run the e2e tests**

Run: `npm run e2e`
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/play.spec.ts
git commit -m "test: add end-to-end test playing hole 1" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Coverage and build check

**Files:** none new (fix gaps if found)

- [ ] **Step 1: Run coverage**

Run: `npm run coverage`
Expected: all tests pass and the run does not fail on thresholds (≥ 80% lines, functions, branches, statements across `src/physics`, `src/world`, `src/game`).

If a threshold fails, the report lists uncovered lines. Add a focused test for each uncovered branch in the matching test file (for example, `parseHole` with `walls: 5` → "walls must be an array"; `props: {}` → "props must be an array"; `update` on a `title` phase returns the same state). Rerun until it passes.

- [ ] **Step 2: Production build**

Run: `npm run build && npx vite preview --port 4173`
Expected: build succeeds; opening `http://localhost:4173` shows the title card and the game plays. The dev hook `window.__minigolf` is **absent** in this build (check in the browser console: `window.__minigolf` → `undefined`).

- [ ] **Step 3: Commit any added tests**

```bash
git add tests
git commit -m "test: close coverage gaps to meet the 80% threshold" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Skip this commit if nothing changed.)

---

## Done for Plan 1

- 3 Backyard holes playable start to finish with placeholder art; scorecard and best total work.
- Unit tests, solvability tests and e2e tests pass; coverage ≥ 80% on physics/world/game.
- `npm run build` output runs from a static host.

**Next:** Plan 2 — Look & Art (dithered terrain, grass fringe, palette snap + time-of-day post pass, light pools, wind sway, PixelLab golfer and props with the style-lock approval step, asset palette check, audio, per-time-of-day debug page). Plan 2 replaces `terrain-draw.ts` shading and the placeholder sprite drawing in `renderer.ts`, and adds `frames`/`anchor` to `assets/manifest.json`.
