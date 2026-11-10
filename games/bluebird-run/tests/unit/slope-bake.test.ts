import { describe, expect, it } from 'vitest';
import { ORIGIN, slopePx } from '../../src/render/iso';
import { bakeChunk, chunkBounds, chunkCount, chunkRange, groundAt, ownerChunk, pixelKind, RAMPS, shadeAt, type ChunkBake } from '../../src/render/slope-bake';
import { makeSlope } from '../helpers/make-slope';

const slope = makeSlope({ length: 100, finish: 80, surfaces: [{ kind: 'packed', rect: [6, 20, 4, 10] }, { kind: 'shade', rect: [6, 25, 2, 2] }] });
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

describe('corduroy', () => {
  const groove = (gx: number, gy: number): boolean => shadeAt('groomed', gx, gy) < shadeAt('packed', gx, gy);
  it('runs downhill: grooves persist along the fall line and not across it', () => {
    expect(groove(0, 0)).toBe(true);
    expect(groove(16, 8)).toBe(true); // one tile downhill
    expect(groove(4, 2)).toBe(true); // a quarter tile downhill
    expect(groove(4, -2)).toBe(false); // a quarter tile across
  });
});
