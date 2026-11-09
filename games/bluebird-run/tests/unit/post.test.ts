import { describe, expect, it } from 'vitest';
import paletteJson from '../../assets/palette.json';
import { createPalette } from '../../src/render/palette';
import { applyPost, buildTable, gradeColor, SUNNY, postColor } from '../../src/render/post';

const palette = createPalette(paletteJson);
const table = buildTable(palette, SUNNY);
const SKY = [0x9f, 0xd8, 0xee] as const;

describe('post pass', () => {
  it('grades a colour with clamping', () => {
    expect(gradeColor([250, 100, 0], { mul: [1.1, 1, 1], add: [10, 0, -5] })).toEqual([255, 100, 0]);
  });
  it('has one graded colour per palette entry', () => {
    expect(table).toHaveLength(palette.colors.length * 3);
  });
  it('turns a colour into its nearest palette entry, graded', () => {
    expect(postColor(palette, table, SKY)).toEqual(gradeColor(SKY, SUNNY));
  });
  it('snaps a buffer in place and makes it opaque', () => {
    const px = new Uint8ClampedArray([0x9f, 0xd9, 0xef, 10]);
    applyPost(px, palette.lut, table);
    expect([...px]).toEqual([...gradeColor(SKY, SUNNY), 255]);
  });
});
