import { describe, expect, it } from 'vitest';
import paletteJson from '../../assets/palette.json';
import { createPalette, type RGB } from '../../src/render/palette';
import { LIGHT_BANDS, applyPost, buildPhaseTables } from '../../src/render/post';
import { PHASES } from '../../src/render/time-of-day';

const palette = createPalette(paletteJson);
const inPalette = (c: RGB) => palette.colors.some((p) => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]);
const px = (...cs: RGB[]) => Uint8ClampedArray.from(cs.flatMap((c) => [...c, 255]));
const rgbAt = (a: Uint8ClampedArray, i: number): RGB => [a[i * 4], a[i * 4 + 1], a[i * 4 + 2]];

describe('buildPhaseTables', () => {
  it('has one table per light band plus unlit', () => {
    expect(buildPhaseTables(palette, PHASES.night).bands).toHaveLength(LIGHT_BANDS + 1);
  });
  it('day band 0 is the palette itself', () => {
    const t = buildPhaseTables(palette, PHASES.day).bands[0];
    palette.colors.forEach((c, i) => expect([t[i * 3], t[i * 3 + 1], t[i * 3 + 2]]).toEqual([...c]));
  });
  it('lit bands are palette colours', () => {
    const t = buildPhaseTables(palette, PHASES.night).bands[3];
    for (let i = 0; i < palette.colors.length; i++) expect(inPalette([t[i * 3], t[i * 3 + 1], t[i * 3 + 2]])).toBe(true);
  });
});

describe('applyPost', () => {
  it('snaps off-palette colours to the palette in daylight', () => {
    const a = px([110, 175, 90], [3, 3, 3]);
    applyPost(a, palette.lut, buildPhaseTables(palette, PHASES.day), null);
    expect(inPalette(rgbAt(a, 0))).toBe(true);
    expect(rgbAt(a, 1)).toEqual([20, 20, 28]);
    expect(a[3]).toBe(255);
  });
  it('night is darker than day', () => {
    const day = px([239, 230, 210]);
    const night = px([239, 230, 210]);
    applyPost(day, palette.lut, buildPhaseTables(palette, PHASES.day), null);
    applyPost(night, palette.lut, buildPhaseTables(palette, PHASES.night), null);
    expect(rgbAt(night, 0)[0]).toBeLessThan(rgbAt(day, 0)[0]);
  });
  it('lamp light brightens a pixel at night', () => {
    const tables = buildPhaseTables(palette, PHASES.night);
    const unlit = px([111, 174, 92]);
    const lit = px([111, 174, 92]);
    applyPost(unlit, palette.lut, tables, Uint8Array.from([0]));
    applyPost(lit, palette.lut, tables, Uint8Array.from([3]));
    const sum = (c: RGB) => c[0] + c[1] + c[2];
    expect(sum(rgbAt(lit, 0))).toBeGreaterThan(sum(rgbAt(unlit, 0)));
  });
});
