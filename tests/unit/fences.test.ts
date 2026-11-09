import { describe, expect, it } from 'vitest';
import { FENCE_COLORS, classifyWall, picketPixels, wallDepth } from '../../src/render/fences';
import { depthOf, viewFor } from '../../src/render/iso';
import { makeHole } from '../helpers/makeHole';

const hole = makeHole({ width: 2, depth: 2, rows: ['GG', 'GX'], tee: [0.5, 1.5], cup: [1.5, 0.5], walls: [[[0.2, 0.2], [0.8, 0.8]]] });
const seg = (a: [number, number], b: [number, number]) => ({ a, b });

describe('classifyWall', () => {
  it('top and left outer edges are back walls', () => {
    expect(classifyWall(hole, seg([0, 0], [1, 0]))).toBe('back');
    expect(classifyWall(hole, seg([0, 0], [0, 1]))).toBe('back');
  });
  it('bottom, right and X-facing edges are front walls', () => {
    expect(classifyWall(hole, seg([0, 2], [1, 2]))).toBe('front');
    expect(classifyWall(hole, seg([2, 0], [2, 1]))).toBe('front');
    expect(classifyWall(hole, seg([1, 1], [2, 1]))).toBe('front'); // above the X tile
    expect(classifyWall(hole, seg([1, 1], [1, 2]))).toBe('front'); // left of the X tile
  });
  it('anything else is an inner wall', () => {
    expect(classifyWall(hole, seg([0.2, 0.2], [0.8, 0.8]))).toBe('inner');
  });
});

describe('wallDepth', () => {
  it('front walls sort at their nearest end, inner walls at their middle', () => {
    expect(wallDepth(seg([0, 2], [1, 2]), 'front')).toBe(depthOf(1, 2));
    expect(wallDepth(seg([0.2, 0.2], [0.8, 0.8]), 'inner')).toBe(depthOf(0.5, 0.5));
  });
});

describe('picketPixels', () => {
  it('draws posts and a rail above the wall line', () => {
    const view = viewFor(hole, 360, 270);
    const px = picketPixels(hole, view, seg([0, 0], [1, 0]));
    expect(px.length).toBeGreaterThan(20);
    expect(px.some((p) => p.color === FENCE_COLORS.post)).toBe(true);
    expect(px.some((p) => p.color === FENCE_COLORS.rail)).toBe(true);
    expect(px.every((p) => Number.isInteger(p.x) && Number.isInteger(p.y))).toBe(true);
  });
});
