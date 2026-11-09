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
  it('bakes the back fence into the terrain', () => {
    const [sx, sy] = project(view, 2, 0, 0);
    const c = at(0, sx, sy - 3);
    expect([c[0], c[1], c[2]]).toEqual([0xef, 0xe6, 0xd2]);
  });
  it('is deterministic', () => {
    expect(bakeTerrain(hole, view, 360, 270).frames[1]).toEqual(bake.frames[1]);
  });
});
