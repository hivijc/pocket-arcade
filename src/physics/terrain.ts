import type { Vec2 } from '../core/geometry';
import type { Hole, Surface } from '../world/hole';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function surfaceAt(hole: Hole, x: number, y: number): Surface | null {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= hole.width || cy >= hole.depth) return null;
  return hole.surface[cy][cx] as Surface;
}

interface Cell { h00: number; h10: number; h01: number; h11: number; fx: number; fy: number }

function cellAt(hole: Hole, x: number, y: number): Cell {
  const cx = clamp(Math.floor(x), 0, hole.width - 1);
  const cy = clamp(Math.floor(y), 0, hole.depth - 1);
  const h = hole.heights;
  return {
    h00: h[cy][cx], h10: h[cy][cx + 1], h01: h[cy + 1][cx], h11: h[cy + 1][cx + 1],
    fx: clamp(x - cx, 0, 1), fy: clamp(y - cy, 0, 1),
  };
}

export function heightAt(hole: Hole, x: number, y: number): number {
  const { h00, h10, h01, h11, fx, fy } = cellAt(hole, x, y);
  const top = h00 + (h10 - h00) * fx;
  const bottom = h01 + (h11 - h01) * fx;
  return top + (bottom - top) * fy;
}

/** Height change per tile in x and y: the uphill direction. */
export function gradientAt(hole: Hole, x: number, y: number): Vec2 {
  const { h00, h10, h01, h11, fx, fy } = cellAt(hole, x, y);
  const dx = (1 - fy) * (h10 - h00) + fy * (h11 - h01);
  const dy = (1 - fx) * (h01 - h00) + fx * (h11 - h10);
  return [dx + 0, dy + 0]; // `+ 0` turns -0 into 0
}
