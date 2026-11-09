import { describe, expect, it } from 'vitest';
import paletteJson from '../../assets/palette.json';
import type { BallEvent } from '../../src/physics/ball';
import {
  DURATION, NO_EFFECTS, TRAIL_LENGTH, effectPixels, flagWiggle, prune, spawnEffects, trackTrail, trailPixels,
  type Effect, type StepSnapshot,
} from '../../src/render/effects';

const PALETTE = new Set((paletteJson.colors as string[]).map((c) => c.toLowerCase()));
const snap = (x: number, y: number, z: number, events: BallEvent[] = []): StepSnapshot => ({ ball: { x, y, z }, events });
const effect = (kind: Effect['kind'], t0 = 0, seed = 1): Effect => ({ kind, at: [2, 3, 0], t0, seed });

describe('spawnEffects', () => {
  it('spawns nothing when the step raised no new events', () => {
    const prev = snap(1, 1, 0, ['wall']);
    expect(spawnEffects(NO_EFFECTS, prev, snap(1.1, 1, 0, ['wall']), [5, 5], 1)).toBe(NO_EFFECTS);
  });

  it('puts a spark at the ball (with its height) on a wall hit', () => {
    const fx = spawnEffects(NO_EFFECTS, snap(1, 1, 0), snap(1.2, 1, 0.1, ['wall']), [5, 5], 2);
    expect(fx.list).toEqual([expect.objectContaining({ kind: 'spark', at: [1.2, 1, 0.1], t0: 2 })]);
  });

  it('puts dust where a hopping ball lands', () => {
    const fx = spawnEffects(NO_EFFECTS, snap(1, 1, 0.2), snap(1.5, 1, 0, ['land']), [5, 5], 0);
    expect(fx.list[0]).toMatchObject({ kind: 'dust', at: [1.5, 1, null] });
  });

  it('splashes where the ball entered the water, not where it was reset to', () => {
    const fx = spawnEffects(NO_EFFECTS, snap(3, 4, 0), snap(0.5, 0.5, 0, ['water']), [5, 5], 0);
    expect(fx.list[0]).toMatchObject({ kind: 'splash', at: [3, 4, null] });
  });

  it('bursts out of the cup when holed', () => {
    const fx = spawnEffects(NO_EFFECTS, snap(4.9, 5, 0), snap(5, 5, 0, ['holed']), [5, 5], 0);
    expect(fx.list[0]).toMatchObject({ kind: 'cup', at: [5, 5, null] });
  });

  it('ignores lip, stopped and repeated events, and gives effects different seeds', () => {
    const a = spawnEffects(NO_EFFECTS, snap(1, 1, 0), snap(1, 1, 0, ['lip', 'stopped', 'wall', 'wall']), [5, 5], 0);
    expect(a.list.map((e) => e.kind)).toEqual(['spark']);
    const b = spawnEffects(a, snap(1, 1, 0), snap(1, 1, 0, ['wall']), [5, 5], 0.5);
    expect(b.list).toHaveLength(2);
    expect(b.list[0].seed).not.toBe(b.list[1].seed);
  });
});

describe('prune', () => {
  it('drops finished effects and keeps live ones', () => {
    const fx = { ...NO_EFFECTS, list: [effect('spark', 0), effect('splash', 0)] };
    const later = prune(fx, DURATION.spark + 0.01);
    expect(later.list.map((e) => e.kind)).toEqual(['splash']);
  });
  it('returns the same object when nothing ends', () => {
    const fx = { ...NO_EFFECTS, list: [effect('splash', 0)] };
    expect(prune(fx, 0.1)).toBe(fx);
  });
});

describe('effectPixels', () => {
  const kinds: Effect['kind'][] = ['cup', 'splash', 'spark', 'dust'];

  it.each(kinds)('%s draws only palette colours, near its origin, and some pixels while live', (kind) => {
    const e = effect(kind, 0, 7);
    for (let t = 0; t < DURATION[kind]; t += 0.05) {
      const px = effectPixels(e, t, 100, 50);
      for (const p of px) {
        expect(PALETTE.has(p.color)).toBe(true);
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
        expect(Math.abs(p.x - 100)).toBeLessThanOrEqual(10);
        expect(Math.abs(p.y - 50)).toBeLessThanOrEqual(12);
      }
    }
    expect(effectPixels(e, DURATION[kind] * 0.3, 100, 50).length).toBeGreaterThan(0);
  });

  it.each(kinds)('%s draws nothing before it starts or after it ends', (kind) => {
    const e = effect(kind, 1);
    expect(effectPixels(e, 0.5, 0, 0)).toEqual([]);
    expect(effectPixels(e, 1 + DURATION[kind] + 0.01, 0, 0)).toEqual([]);
  });

  it('splash rings grow outward over time', () => {
    const e = effect('splash');
    const spread = (t: number) => Math.max(...effectPixels(e, t, 0, 0).map((p) => Math.abs(p.x)));
    expect(spread(0.3)).toBeGreaterThan(spread(0.05));
  });

  it('splash shows up to three rings at once', () => {
    const e = effect('splash');
    const radii = new Set(effectPixels(e, 0.3, 0, 0).filter((p) => p.y === 0).map((p) => Math.abs(p.x)));
    expect(radii.size).toBeGreaterThanOrEqual(2);
  });

  it('spark stays tiny', () => {
    const px = effectPixels(effect('spark'), 0.02, 0, 0);
    expect(px.length).toBeLessThanOrEqual(4);
    for (const p of px) expect(Math.max(Math.abs(p.x), Math.abs(p.y))).toBeLessThanOrEqual(2);
  });

  it('is deterministic for the same seed and time', () => {
    expect(effectPixels(effect('dust', 0, 3), 0.1, 0, 0)).toEqual(effectPixels(effect('dust', 0, 3), 0.1, 0, 0));
  });
});

describe('flagWiggle', () => {
  it('is 0 with no cup effect', () => {
    expect(flagWiggle(NO_EFFECTS, 1)).toBe(0);
  });
  it('wiggles the flag by a pixel shortly after the cup drop, then settles', () => {
    const fx = { ...NO_EFFECTS, list: [effect('cup', 0)] };
    const offsets = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3].map((t) => flagWiggle(fx, t));
    expect(offsets.some((o) => o !== 0)).toBe(true);
    for (const o of offsets) expect(Math.abs(o)).toBeLessThanOrEqual(1);
    expect(flagWiggle(fx, DURATION.cup + 0.1)).toBe(0);
  });
});

describe('ball trail', () => {
  it('records positions while rolling, newest first, capped', () => {
    let fx = NO_EFFECTS;
    for (let i = 0; i < TRAIL_LENGTH + 3; i++) fx = trackTrail(fx, { x: i, y: 0, z: 0 }, true);
    expect(fx.trail).toHaveLength(TRAIL_LENGTH);
    expect(fx.trail[0][0]).toBe(TRAIL_LENGTH + 2);
  });
  it('clears when the ball is not rolling', () => {
    const fx = trackTrail(NO_EFFECTS, { x: 1, y: 0, z: 0 }, true);
    expect(trackTrail(fx, { x: 1, y: 0, z: 0 }, false).trail).toEqual([]);
    expect(trackTrail(NO_EFFECTS, { x: 1, y: 0, z: 0 }, false)).toBe(NO_EFFECTS);
  });
  it('draws faint 1 px dots behind the ball, skipping where the ball still is', () => {
    const pts = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] as const;
    const px = trailPixels(pts.map(([x, y]) => [x, y] as const), [0, 0]);
    expect(px.every((p) => PALETTE.has(p.color))).toBe(true);
    expect(px.some((p) => p.x === 0 && p.y === 0)).toBe(false);
    expect(px.length).toBeGreaterThan(0);
    expect(px.length).toBeLessThan(pts.length);
  });
});
