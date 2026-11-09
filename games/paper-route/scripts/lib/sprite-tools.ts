import { nearestIndex, type RGB } from '../../src/render/palette';

export interface Bitmap {
  readonly width: number;
  readonly height: number;
  /** RGBA, row-major. */
  readonly data: Uint8Array;
}

export interface Bounds { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }

export interface Sheet {
  readonly bitmap: Bitmap;
  readonly cell: [number, number];
  readonly anchor: [number, number];
}

export const blank = (width: number, height: number): Bitmap => ({ width, height, data: new Uint8Array(width * height * 4) });

const alphaAt = (b: Bitmap, x: number, y: number) => b.data[(y * b.width + x) * 4 + 3];

export function snapToPalette(b: Bitmap, colors: readonly RGB[]): Bitmap {
  const data = new Uint8Array(b.data.length);
  for (let i = 0; i < data.length; i += 4) {
    if (b.data[i + 3] < 128) continue; // transparent stays (0,0,0,0)
    const c = colors[nearestIndex(colors, [b.data[i], b.data[i + 1], b.data[i + 2]])];
    data.set([c[0], c[1], c[2], 255], i);
  }
  return { ...b, data };
}

export function opaqueBounds(b: Bitmap): Bounds | null {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      if (!alphaAt(b, x, y)) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

export function crop(b: Bitmap, x: number, y: number, w: number, h: number): Bitmap {
  const out = blank(w, h);
  return blit(out, b, -x, -y);
}

export function trim(b: Bitmap, pad = 1): Bitmap {
  const r = opaqueBounds(b);
  if (!r) return blank(1, 1);
  return crop(b, r.x0 - pad, r.y0 - pad, r.x1 - r.x0 + pad * 2, r.y1 - r.y0 + pad * 2);
}

export function bottomCenter(b: Bitmap): [number, number] {
  const r = opaqueBounds(b);
  return r ? [Math.floor((r.x0 + r.x1) / 2), r.y1] : [Math.floor(b.width / 2), b.height];
}

/** Copies src's opaque pixels onto a copy of dst at (dx, dy), clipping at dst's edges. */
export function blit(dst: Bitmap, src: Bitmap, dx: number, dy: number): Bitmap {
  const data = new Uint8Array(dst.data);
  for (let y = 0; y < src.height; y++) {
    const ty = y + dy;
    if (ty < 0 || ty >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const tx = x + dx;
      if (tx < 0 || tx >= dst.width || !alphaAt(src, x, y)) continue;
      const s = (y * src.width + x) * 4;
      data.set(src.data.subarray(s, s + 4), (ty * dst.width + tx) * 4);
    }
  }
  return { ...dst, data };
}

function unionBounds(frames: readonly Bitmap[]): Bounds | null {
  return frames.map(opaqueBounds).reduce<Bounds | null>((acc, r) => {
    if (!r) return acc;
    if (!acc) return r;
    return { x0: Math.min(acc.x0, r.x0), y0: Math.min(acc.y0, r.y0), x1: Math.max(acc.x1, r.x1), y1: Math.max(acc.y1, r.y1) };
  }, null);
}

/**
 * Packs rows of frames into a sheet of equal cells. Each row is aligned as a group (its union's
 * bottom-centre lands on the cell anchor) so motion inside an animation is kept.
 */
export function packRows(rows: readonly (readonly Bitmap[])[]): Sheet {
  const groups = rows.map(unionBounds);
  const cw = Math.max(1, ...groups.map((g) => (g ? g.x1 - g.x0 : 0))) + 2;
  const ch = Math.max(1, ...groups.map((g) => (g ? g.y1 - g.y0 : 0))) + 2;
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const anchor: [number, number] = [Math.floor(cw / 2), ch - 1];
  let sheet = blank(cw * cols, ch * rows.length);
  rows.forEach((frames, r) => {
    const g = groups[r];
    if (!g) return;
    const ox = anchor[0] - Math.floor((g.x0 + g.x1) / 2);
    const oy = anchor[1] - g.y1;
    frames.forEach((frame, c) => {
      const cell = blit(blank(cw, ch), frame, ox, oy);
      sheet = blit(sheet, cell, c * cw, r * ch);
    });
  });
  return { bitmap: sheet, cell: [cw, ch], anchor };
}
