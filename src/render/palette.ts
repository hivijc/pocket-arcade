export type RGB = readonly [number, number, number];

export interface Palette {
  readonly colors: readonly RGB[];
  /** 32×32×32 lookup (5 bits per channel) → nearest palette index. */
  readonly lut: Uint8Array;
}

export class PaletteError extends Error {}

const HEX = /^#[0-9a-fA-F]{6}$/;

export function parseHex(hex: string): RGB {
  if (!HEX.test(hex)) throw new PaletteError(`palette: "${hex}" is not a #rrggbb colour`);
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Perceptually weighted squared distance: green counts most, then blue, then red. */
export function colorDistance(a: RGB, b: RGB): number {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
}

export function nearestIndex(colors: readonly RGB[], c: RGB): number {
  let best = 0;
  let bestD = Infinity;
  colors.forEach((p, i) => {
    const d = colorDistance(p, c);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

const expand5 = (v: number) => (v << 3) | (v >> 2);

export function buildLut(colors: readonly RGB[]): Uint8Array {
  const lut = new Uint8Array(32 * 32 * 32);
  for (let r = 0; r < 32; r++) {
    for (let g = 0; g < 32; g++) {
      for (let b = 0; b < 32; b++) lut[(r << 10) | (g << 5) | b] = nearestIndex(colors, [expand5(r), expand5(g), expand5(b)]);
    }
  }
  return lut;
}

export function lutIndex(lut: Uint8Array, r: number, g: number, b: number): number {
  return lut[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)];
}

export function parsePalette(raw: unknown): RGB[] {
  const colors = typeof raw === 'object' && raw !== null ? (raw as { colors?: unknown }).colors : undefined;
  if (!Array.isArray(colors) || colors.length < 2 || colors.length > 64) {
    throw new PaletteError('palette: needs a "colors" array of 2 to 64 hex strings');
  }
  return colors.map((c) => {
    if (typeof c !== 'string') throw new PaletteError('palette: colours must be strings');
    return parseHex(c);
  });
}

export function createPalette(raw: unknown): Palette {
  const colors = parsePalette(raw);
  return { colors, lut: buildLut(colors) };
}
