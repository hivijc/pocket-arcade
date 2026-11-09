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
