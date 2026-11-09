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
