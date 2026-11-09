import { describe, expect, it } from 'vitest';
import { doormatQuad, houseSpot, houseSprite } from '../../src/render/renderer';
import { parseStreet } from '../../src/world/street';
import { rawStreet } from '../helpers/make-street';

const [left, right] = parseStreet(rawStreet()).lots;

describe('houses', () => {
  it('stands behind the porch, on the far side of the lawn from the street', () => {
    expect(houseSpot(left)).toEqual([1, 10]);
    expect(houseSpot(right)).toEqual([13, 10]);
    expect(houseSpot(left)[0]).toBeLessThan(left.porch.c0);
    expect(houseSpot(right)[0]).toBeGreaterThan(right.porch.c1);
  });
  it('uses the sprite facing the street for each side', () => {
    expect(houseSprite(left)).toBe('house-a-l');
    expect(houseSprite(right)).toBe('house-b-r');
  });
});

describe('doormat', () => {
  it('marks the middle of a subscriber porch with a small flat quad', () => {
    const quad = doormatQuad(left);
    const cs = quad.map((p) => p[0]);
    const ss = quad.map((p) => p[1]);
    expect(quad).toHaveLength(4);
    expect((Math.min(...cs) + Math.max(...cs)) / 2).toBeCloseTo((left.porch.c0 + left.porch.c1) / 2);
    expect((Math.min(...ss) + Math.max(...ss)) / 2).toBeCloseTo((left.porch.s0 + left.porch.s1) / 2);
    expect(Math.min(...cs)).toBeGreaterThan(left.porch.c0);
    expect(Math.max(...ss)).toBeLessThan(left.porch.s1);
  });
});
