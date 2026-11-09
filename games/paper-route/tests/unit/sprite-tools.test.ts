import { describe, expect, it } from 'vitest';
import { blank, blit, bottomCenter, opaqueBounds, packRows, snapToPalette, trim, type Bitmap } from '../../scripts/lib/sprite-tools';
import type { RGB } from '../../src/render/palette';

const colors: RGB[] = [[0, 0, 0], [255, 255, 255], [200, 50, 50]];
function withPixels(w: number, h: number, pts: [number, number, RGB, number?][]): Bitmap {
  const b = blank(w, h);
  const data = new Uint8Array(b.data);
  for (const [x, y, c, a = 255] of pts) data.set([...c, a], (y * w + x) * 4);
  return { ...b, data };
}

describe('snapToPalette', () => {
  it('snaps colours and makes alpha binary', () => {
    const b = snapToPalette(withPixels(3, 1, [[0, 0, [210, 40, 60]], [1, 0, [250, 250, 250], 100], [2, 0, [10, 10, 10], 200]]), colors);
    expect([...b.data.slice(0, 4)]).toEqual([200, 50, 50, 255]);
    expect(b.data[7]).toBe(0);
    expect([...b.data.slice(8, 12)]).toEqual([0, 0, 0, 255]);
  });
});

describe('bounds, trim and anchor', () => {
  const b = withPixels(10, 10, [[3, 2, colors[1]], [6, 7, colors[1]]]);
  it('finds opaque bounds (exclusive max)', () => {
    expect(opaqueBounds(b)).toEqual({ x0: 3, y0: 2, x1: 7, y1: 8 });
    expect(opaqueBounds(blank(4, 4))).toBeNull();
  });
  it('trims to the bounds plus padding', () => {
    const t = trim(b, 1);
    expect([t.width, t.height]).toEqual([6, 8]);
    expect(opaqueBounds(t)).toEqual({ x0: 1, y0: 1, x1: 5, y1: 7 });
  });
  it('anchors at the bottom centre of the opaque area', () => {
    expect(bottomCenter(b)).toEqual([5, 8]);
  });
});

describe('blit and packRows', () => {
  it('blit copies only opaque pixels and clips', () => {
    const out = blit(blank(2, 2), withPixels(2, 2, [[1, 1, colors[2]]]), 1, 1);
    expect(out.data.every((v) => v === 0)).toBe(true); // copied pixel lands at (2,2): clipped
  });
  it('packs rows bottom-aligned into equal cells', () => {
    const a = withPixels(8, 8, [[2, 5, colors[1]], [2, 6, colors[1]]]);
    const b = withPixels(12, 12, [[6, 9, colors[1]]]);
    const sheet = packRows([[a, a], [b]]);
    expect(sheet.cell[0]).toBeGreaterThanOrEqual(3);
    expect(sheet.bitmap.width).toBe(sheet.cell[0] * 2);
    expect(sheet.bitmap.height).toBe(sheet.cell[1] * 2);
    // every row's lowest opaque pixel sits on the row just above the anchor line
    const lowest = (row: number) => {
      const cell = { ...sheet.bitmap };
      let y = -1;
      for (let yy = row * sheet.cell[1]; yy < (row + 1) * sheet.cell[1]; yy++) {
        for (let xx = 0; xx < sheet.cell[0]; xx++) if (cell.data[(yy * cell.width + xx) * 4 + 3]) y = yy - row * sheet.cell[1];
      }
      return y;
    };
    expect(lowest(0)).toBe(sheet.anchor[1] - 1);
    expect(lowest(1)).toBe(sheet.anchor[1] - 1);
  });
});
