import { lutIndex, type Palette, type RGB } from './palette';

export interface Grade {
  readonly mul: RGB;
  readonly add: RGB;
}

/** The one daylight look: a touch warm, like early sun. Daytime only, so there are no phases or lamps. */
export const MORNING: Grade = { mul: [1, 0.97, 0.93], add: [10, 6, 2] };

export function gradeColor(c: RGB, g: Grade): RGB {
  const ch = (i: 0 | 1 | 2) => Math.max(0, Math.min(255, Math.round(c[i] * g.mul[i] + g.add[i])));
  return [ch(0), ch(1), ch(2)];
}

/** table[i * 3 .. i * 3 + 2] = output RGB for palette index i. */
export function buildTable(palette: Palette, grade: Grade): Uint8Array {
  return Uint8Array.from(palette.colors.flatMap((c) => gradeColor(c, grade)));
}

/** The colour the post pass turns `c` into, e.g. so the page background can match the canvas. */
export function postColor(palette: Palette, table: Uint8Array, c: RGB): RGB {
  const i = lutIndex(palette.lut, c[0], c[1], c[2]) * 3;
  return [table[i], table[i + 1], table[i + 2]];
}

/** Snaps every pixel to the palette and grades it, IN PLACE (per-frame buffer: documented exception to immutability). */
export function applyPost(px: Uint8ClampedArray, lut: Uint8Array, table: Uint8Array): void {
  for (let i = 0; i < px.length; i += 4) {
    const idx = lutIndex(lut, px[i], px[i + 1], px[i + 2]) * 3;
    px[i] = table[idx];
    px[i + 1] = table[idx + 1];
    px[i + 2] = table[idx + 2];
    px[i + 3] = 255;
  }
}

export function postProcess(ctx: CanvasRenderingContext2D, width: number, height: number, lut: Uint8Array, table: Uint8Array): void {
  const img = ctx.getImageData(0, 0, width, height);
  applyPost(img.data, lut, table);
  ctx.putImageData(img, 0, 0);
}
