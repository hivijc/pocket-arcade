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
