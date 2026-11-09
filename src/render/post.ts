import { lutIndex, nearestIndex, type Palette, type RGB } from './palette';
import { gradeColor, type PhaseLook } from './time-of-day';

/** Number of lamp-light bands (band 0 = unlit). */
export const LIGHT_BANDS = 3;
const LAMP_TINT: RGB = [255, 214, 150];
/** How far each band pulls a pixel from its graded colour toward its warm lamp-lit colour. */
const BAND_STRENGTH = [0, 0.4, 0.65, 0.9] as const;

export interface PhaseTables {
  /** bands[b][i * 3 .. i * 3 + 2] = output RGB for palette index i under light band b. */
  readonly bands: readonly Uint8Array[];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

const lampLit = (c: RGB): RGB => [
  Math.min(255, Math.round(((c[0] * LAMP_TINT[0]) / 255) * 1.15)),
  Math.min(255, Math.round(((c[1] * LAMP_TINT[1]) / 255) * 1.15)),
  Math.min(255, Math.round(((c[2] * LAMP_TINT[2]) / 255) * 1.15)),
];

const flat = (cs: readonly RGB[]): Uint8Array => Uint8Array.from(cs.flat());

export function buildPhaseTables(palette: Palette, look: PhaseLook): PhaseTables {
  const graded = palette.colors.map((c) => gradeColor(c, look.grade));
  const bands = BAND_STRENGTH.map((t, b) => {
    if (b === 0) return flat(graded);
    // Lit pixels snap back onto the (ungraded) palette, so a pool reads as warm daylight in hard bands.
    return flat(palette.colors.map((c, i) => palette.colors[nearestIndex(palette.colors, mix(graded[i], lampLit(c), t))]));
  });
  return { bands };
}

/**
 * Snaps every pixel to the palette and applies the phase look, IN PLACE (per-frame buffer; documented
 * exception to the immutability rule). `light` holds a band 0..LIGHT_BANDS per pixel, or null for none.
 */
export function applyPost(px: Uint8ClampedArray, lut: Uint8Array, tables: PhaseTables, light: Uint8Array | null): void {
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const idx = lutIndex(lut, px[i], px[i + 1], px[i + 2]) * 3;
    const t = tables.bands[light ? light[p] : 0];
    px[i] = t[idx];
    px[i + 1] = t[idx + 1];
    px[i + 2] = t[idx + 2];
    px[i + 3] = 255;
  }
}

/** Reads the canvas back, post-processes it and writes it out again. */
export function postProcess(
  ctx: CanvasRenderingContext2D, width: number, height: number,
  lut: Uint8Array, tables: PhaseTables, light: Uint8Array | null,
): void {
  const img = ctx.getImageData(0, 0, width, height);
  applyPost(img.data, lut, tables, light);
  ctx.putImageData(img, 0, 0);
}
