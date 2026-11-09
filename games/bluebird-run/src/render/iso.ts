import type { Vec2 } from '../core/geometry';
import { SLOPE } from '../sim/constants';

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

/** Slope point [c, d] → grid [x, y]: d (downhill) is grid x; c (screen-left 0 → screen-right 16) runs against grid y. */
export const toGrid = (c: number, d: number): Vec2 => [d, SLOPE.width - c];
/** Grid [x, y] → slope point [c, d]. */
export const fromGrid = (x: number, y: number): Vec2 => [SLOPE.width - y, x];

export function slopePx(v: View, c: number, d: number, z = 0): Vec2 {
  return project(v, d, SLOPE.width - c, z);
}

/** Larger depth = closer to the viewer = drawn later. */
export function depthOf(c: number, d: number): number {
  return d + (SLOPE.width - c);
}

export function sortByDepth<T extends { readonly depth: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.depth - b.depth);
}
