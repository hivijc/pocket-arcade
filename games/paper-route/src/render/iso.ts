import type { Vec2 } from '../core/geometry';

export const TILE_W = 32;
export const TILE_H = 16;
/** Screen pixels per tile of height. */
export const Z_PX = 16;

export interface View {
  readonly ox: number;
  readonly oy: number;
}

/** World pixel space: grid (0, 0, 0) sits at pixel (0, 0). */
export const ORIGIN: View = { ox: 0, oy: 0 };

export function project(v: View, x: number, y: number, z: number): Vec2 {
  return [v.ox + ((x - y) * TILE_W) / 2, v.oy + ((x + y) * TILE_H) / 2 - z * Z_PX];
}

export function unproject(v: View, sx: number, sy: number, z = 0): Vec2 {
  const a = (sx - v.ox) / (TILE_W / 2); // x - y
  const b = (sy - v.oy + z * Z_PX) / (TILE_H / 2); // x + y
  return [(a + b) / 2, (b - a) / 2];
}

/**
 * Street point [c, s] → grid [x, y]: c (across) is grid x, s (along, from the start) runs against
 * grid y, so riding forward moves up-right on screen.
 */
export const toGrid = (length: number, c: number, s: number): Vec2 => [c, length - s];
export const fromGrid = (length: number, x: number, y: number): Vec2 => [x, length - y];

export function streetPx(v: View, length: number, c: number, s: number, z = 0): Vec2 {
  return project(v, c, length - s, z);
}

/** Larger depth = closer to the viewer = drawn later. */
export function depthOf(length: number, c: number, s: number): number {
  return c + (length - s);
}

export function sortByDepth<T extends { readonly depth: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.depth - b.depth);
}
