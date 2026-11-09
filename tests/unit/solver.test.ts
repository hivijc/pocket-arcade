import { describe, expect, it } from 'vitest';
import { cupDistance, distanceField, range, solve } from '../../src/world/solver';
import { makeHole } from '../helpers/makeHole';

describe('range', () => {
  it('includes both ends', () => {
    expect(range(0, 1, 0.25)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
});

describe('distanceField', () => {
  // A U-shaped lane: the cup is beside the tee but around a wall of X tiles.
  const rows = ['GGGGG', 'XXXXG', 'GGGGG'];
  const hole = makeHole({ width: 5, depth: 3, rows, tee: [0.5, 2.5], cup: [0.5, 0.5] });

  it('walks around X tiles', () => {
    const field = distanceField(hole);
    expect(field[0][0]).toBe(0);
    expect(field[1][0]).toBe(Infinity);
    expect(field[2][0]).toBeGreaterThan(6); // around the end, not through the wall
  });

  it('measures straight-line distance on the cup tile', () => {
    const field = distanceField(hole);
    expect(cupDistance(hole, field, 0.5, 0.5)).toBe(0);
    expect(cupDistance(hole, field, 0.9, 0.5)).toBeCloseTo(0.4);
    expect(cupDistance(hole, field, 0.5, 2.5)).toBeGreaterThan(6);
  });
});

describe('solve', () => {
  it('finds a hole-in-one on a flat straight lane', () => {
    const hole = makeHole({ width: 8, depth: 3, tee: [1.5, 1.5], cup: [6.5, 1.5], par: 2 });
    const r = solve(hole);
    expect(r.holed).toBe(true);
    expect(r.shots).toHaveLength(1);
  });

  it('gives up after par strokes when the cup is unreachable', () => {
    const hole = makeHole({ width: 5, depth: 3, rows: ['GGXGG', 'GGXGG', 'GGXGG'], tee: [0.5, 1.5], cup: [4.5, 1.5], par: 2 });
    const r = solve(hole);
    expect(r.holed).toBe(false);
    expect(r.shots.length).toBeLessThanOrEqual(2);
  });
});
