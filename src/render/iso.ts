import type { Vec2 } from '../core/geometry';
import type { Hole } from '../world/hole';

export const TILE_W = 32;
export const TILE_H = 16;
/** Screen pixels per tile of height. */
export const Z_PX = 16;
/** Push the hole a little below centre so tall props have room above it. */
export const CENTER_DROP = 12;

export interface View {
  readonly ox: number;
  readonly oy: number;
}

export function project(v: View, x: number, y: number, z: number): Vec2 {
  return [v.ox + ((x - y) * TILE_W) / 2, v.oy + ((x + y) * TILE_H) / 2 - z * Z_PX];
}

export function unproject(v: View, sx: number, sy: number, z = 0): Vec2 {
  const a = (sx - v.ox) / (TILE_W / 2); // x - y
  const b = (sy - v.oy + z * Z_PX) / (TILE_H / 2); // x + y
  return [(a + b) / 2, (b - a) / 2];
}

export function viewFor(hole: Hole, bufW: number, bufH: number): View {
  const cx = hole.width / 2;
  const cy = hole.depth / 2;
  return {
    ox: bufW / 2 - ((cx - cy) * TILE_W) / 2,
    oy: bufH / 2 + CENTER_DROP - ((cx + cy) * TILE_H) / 2,
  };
}

/** Larger depth = closer to the viewer = drawn later. */
export function depthOf(x: number, y: number, z = 0): number {
  return x + y + z * 0.01;
}

export function sortByDepth<T extends { readonly depth: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.depth - b.depth);
}
