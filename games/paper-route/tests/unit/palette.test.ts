import { describe, expect, it } from 'vitest';
import paletteJson from '../../assets/palette.json';
import {
  buildLut, colorDistance, createPalette, lutIndex, nearestIndex, parseHex, parsePalette, toHex, type RGB,
} from '../../src/render/palette';

describe('hex colours', () => {
  it('parses and formats', () => {
    expect(parseHex('#ff8000')).toEqual([255, 128, 0]);
    expect(toHex([255, 128, 0])).toBe('#ff8000');
  });
  it('rejects bad hex', () => {
    expect(() => parseHex('ff8000')).toThrow(/not a #rrggbb colour/);
    expect(() => parseHex('#ff80')).toThrow(/not a #rrggbb colour/);
  });
});

describe('nearest colour', () => {
  const colors: RGB[] = [[0, 0, 0], [255, 255, 255], [255, 0, 0]];
  it('finds exact and near matches', () => {
    expect(nearestIndex(colors, [255, 0, 0])).toBe(2);
    expect(nearestIndex(colors, [240, 20, 10])).toBe(2);
    expect(nearestIndex(colors, [30, 30, 30])).toBe(0);
  });
  it('weights green most', () => {
    expect(colorDistance([0, 10, 0], [0, 0, 0])).toBeGreaterThan(colorDistance([10, 0, 0], [0, 0, 0]));
  });
  it('the lookup table agrees with nearestIndex', () => {
    const lut = buildLut(colors);
    expect(lutIndex(lut, 250, 10, 10)).toBe(2);
    expect(lutIndex(lut, 200, 200, 200)).toBe(1);
    expect(lutIndex(lut, 5, 5, 5)).toBe(0);
  });
});

describe('palette file', () => {
  it('loads the 32-colour Maple Lane palette', () => {
    const p = createPalette(paletteJson);
    expect(p.colors).toHaveLength(32);
    expect(p.lut).toHaveLength(32 * 32 * 32);
  });
  it('maps every palette colour to itself or a near twin', () => {
    const p = createPalette(paletteJson);
    for (const c of p.colors) expect(colorDistance(p.colors[lutIndex(p.lut, ...c)], c)).toBeLessThan(9 * 64 * 3);
  });
  it('rejects a bad palette', () => {
    expect(() => parsePalette({})).toThrow(/needs a "colors" array/);
    expect(() => parsePalette({ colors: ['#000000'] })).toThrow(/needs a "colors" array/);
    expect(() => parsePalette({ colors: ['#000000', 5] })).toThrow(/colours must be strings/);
  });
});
