import { describe, expect, it } from 'vitest';
import { houseSpot, houseSprite } from '../../src/render/renderer';
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
