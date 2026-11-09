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
