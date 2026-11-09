import type { Vec2 } from '../core/geometry';
import { heightAt } from '../physics/terrain';
import type { Hole, Surface } from '../world/hole';
import { classifyWall, picketPixels } from './fences';
import { project, unproject, type View } from './iso';
import { parseHex, type RGB } from './palette';

export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
/** Two wind frames: fringe tufts and water shimmer differ between them. */
export const WIND_FRAMES = 2;
/** How far below height 0 the island's earth sides hang, tiles. */
const BASE_Z = -0.5;
const FRINGE_RADIUS = 4;
const RIM_WIDTH = 2;

type Kind = 'G' | 'R' | 'S' | 'W' | 'sideL' | 'sideR';
const KINDS: readonly Kind[] = ['G', 'R', 'S', 'W', 'sideL', 'sideR'];
const TOP_KINDS = new Set([0, 1, 2]); // G, R, S: where the fringe grows from
const WATER = 3;

const hexes = (...h: string[]): RGB[] => h.map(parseHex);
export const RAMPS: Readonly<Record<Kind | 'fringe' | 'rim', readonly RGB[]>> = {
  G: hexes('#3f6b3a', '#4f8a4c', '#6fae5c', '#8fca6c', '#b5e08a'),
  R: hexes('#1f3a2c', '#2f5530', '#3f6b3a', '#5e8c45', '#8db35a'),
  S: hexes('#8a6a4a', '#b08a62', '#d9c08c', '#efe6d2'),
  W: hexes('#1d3b5c', '#2f6f9a', '#5aa7d0', '#9fd8ee'),
  sideL: hexes('#2e2420', '#4a3b2e', '#6b4f3a'),
  sideR: hexes('#14141c', '#2e2420', '#4a3b2e'),
  fringe: hexes('#1f3a2c', '#2f5530', '#3f6b3a', '#5e8c45'),
  rim: hexes('#c8463c', '#fffaf0'),
};

export interface TerrainBake {
  readonly width: number;
  readonly height: number;
  /** RGBA pixels, one buffer per wind frame. */
  readonly frames: readonly Uint8ClampedArray[];
  /** Ground height (tiles) under each pixel; NaN where there is no top surface. */
  readonly ground: Float32Array;
}

interface Buffers {
  readonly w: number;
  readonly h: number;
  readonly kind: Int8Array;
  readonly shade: Float32Array;
  readonly ground: Float32Array;
}

export const bayer = (x: number, y: number): number => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

/** Deterministic pseudo-random value in [0, 1) for an integer pixel and seed. */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
export function valueNoise(x: number, y: number, scale: number, seed: number): number {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const sx = smooth(fx - x0), sy = smooth(fy - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  const top = a + (b - a) * sx;
  const bottom = c + (d - c) * sx;
  return top + (bottom - top) * sy;
}
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Which of `levels` ramp steps a 0..1 value lands on, dithered by the pixel's Bayer threshold. */
export function rampLevel(v: number, levels: number, x: number, y: number): number {
  return Math.max(0, Math.min(levels - 1, Math.floor(v * (levels - 1) + bayer(x, y))));
}

/** True if (px, py) is inside a convex polygon of either winding. */
export function insideConvex(pts: readonly Vec2[], px: number, py: number): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    if (cross === 0) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function polyArea(pts: readonly Vec2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

function fillPoly(buf: Buffers, pts: readonly Vec2[], kind: number, shade: number, groundAt: ((x: number, y: number) => number) | null): void {
  if (polyArea(pts) < 0.5) return; // degenerate: nothing to draw
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(buf.w - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(buf.h - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!insideConvex(pts, x + 0.5, y + 0.5)) continue;
      const i = y * buf.w + x;
      buf.kind[i] = kind;
      buf.shade[i] = shade;
      buf.ground[i] = groundAt ? groundAt(x + 0.5, y + 0.5) : Number.NaN;
    }
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function bakeCell(buf: Buffers, hole: Hole, view: View, x: number, y: number): void {
  const surface = hole.surface[y][x] as Surface;
  if (surface === 'X') return;
  const h = hole.heights;
  const h00 = h[y][x], h10 = h[y][x + 1], h01 = h[y + 1][x], h11 = h[y + 1][x + 1];
  const dhdx = (h10 - h00 + (h11 - h01)) / 2;
  const dhdy = (h01 - h00 + (h11 - h10)) / 2;
  const stripe = surface === 'G' ? ((x + y) % 2 === 0 ? 0.06 : -0.04) : 0;
  const shade = clamp01(0.55 + 0.6 * dhdx + 0.2 * dhdy + stripe);
  const meanZ = (h00 + h10 + h01 + h11) / 4;
  const groundAt = (sx: number, sy: number) => {
    const [gx, gy] = unproject(view, sx, sy, meanZ);
    return heightAt(hole, gx, gy);
  };
  const top = [project(view, x, y, h00), project(view, x + 1, y, h10), project(view, x + 1, y + 1, h11), project(view, x, y + 1, h01)];
  fillPoly(buf, top, KINDS.indexOf(surface), shade, groundAt);

  // This cell's own front-facing earth sides, drawn right after its top so nearer cells paint over them.
  const solid = (cx: number, cy: number) => cx >= hole.width || cy >= hole.depth || hole.surface[cy][cx] === 'X';
  if (solid(x, y + 1)) {
    fillPoly(buf, [project(view, x, y + 1, h01), project(view, x + 1, y + 1, h11), project(view, x + 1, y + 1, BASE_Z), project(view, x, y + 1, BASE_Z)], KINDS.indexOf('sideL'), 0.5, null);
  }
  if (solid(x + 1, y)) {
    fillPoly(buf, [project(view, x + 1, y, h10), project(view, x + 1, y + 1, h11), project(view, x + 1, y + 1, BASE_Z), project(view, x + 1, y, BASE_Z)], KINDS.indexOf('sideR'), 0.5, null);
  }
}

/** Distance (pixels) from each empty pixel to the nearest grass/sand top pixel, 0 if farther than the fringe radius. */
function fringeDistances(buf: Buffers): Float32Array {
  const out = new Float32Array(buf.w * buf.h);
  const r = FRINGE_RADIUS;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if (buf.kind[y * buf.w + x] >= 0) continue;
      let best = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= buf.h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= buf.w || !TOP_KINDS.has(buf.kind[yy * buf.w + xx])) continue;
          best = Math.min(best, Math.hypot(dx, dy));
        }
      }
      out[y * buf.w + x] = best <= r ? best : 0;
    }
  }
  return out;
}

/** True if a water pixel is within RIM_WIDTH of a non-water top pixel (the kiddie-pool rim). */
function onRim(buf: Buffers, x: number, y: number): boolean {
  for (let dy = -RIM_WIDTH; dy <= RIM_WIDTH; dy++) {
    for (let dx = -RIM_WIDTH; dx <= RIM_WIDTH; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= buf.w || yy >= buf.h) continue;
      if (TOP_KINDS.has(buf.kind[yy * buf.w + xx])) return true;
    }
  }
  return false;
}

function put(out: Uint8ClampedArray, i: number, c: RGB): void {
  out[i * 4] = c[0];
  out[i * 4 + 1] = c[1];
  out[i * 4 + 2] = c[2];
  out[i * 4 + 3] = 255;
}

function colorize(buf: Buffers, fringe: Float32Array, frame: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(buf.w * buf.h * 4);
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const i = y * buf.w + x;
      const k = buf.kind[i];
      if (k === WATER && onRim(buf, x, y)) {
        put(out, i, RAMPS.rim[((x + y) >> 2) & 1]);
      } else if (k >= 0) {
        const ramp = RAMPS[KINDS[k]];
        const water = k === WATER;
        const noise = valueNoise(x, y, water ? 5 : 7, water ? 3 + frame * 17 : 3) - 0.5;
        put(out, i, ramp[rampLevel(buf.shade[i] + noise * (water ? 0.5 : 0.3), ramp.length, x, y)]);
      } else if (fringe[i] > 0) {
        const p = 1 - fringe[i] / (FRINGE_RADIUS + 1);
        const sway = frame === 1 && hash2(x, y, 5) < 0.35 ? 1 : 0;
        if (hash2(x - sway, y, 11) < p * 0.85) put(out, i, RAMPS.fringe[rampLevel(p, RAMPS.fringe.length, x, y)]);
      }
    }
  }
  return out;
}

function plotFences(frames: readonly Uint8ClampedArray[], hole: Hole, view: View, width: number, height: number): void {
  const colors = new Map<string, RGB>();
  for (const seg of hole.walls) {
    if (classifyWall(hole, seg) !== 'back') continue;
    for (const p of picketPixels(hole, view, seg)) {
      if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) continue;
      const c = colors.get(p.color) ?? parseHex(p.color);
      colors.set(p.color, c);
      for (const f of frames) put(f, p.y * width + p.x, c);
    }
  }
}

export function bakeTerrain(hole: Hole, view: View, width: number, height: number): TerrainBake {
  const n = width * height;
  const buf: Buffers = {
    w: width, h: height,
    kind: new Int8Array(n).fill(-1),
    shade: new Float32Array(n),
    ground: new Float32Array(n).fill(Number.NaN),
  };
  for (let s = 0; s <= hole.width + hole.depth - 2; s++) {
    for (let y = 0; y < hole.depth; y++) {
      const x = s - y;
      if (x >= 0 && x < hole.width) bakeCell(buf, hole, view, x, y);
    }
  }
  const fringe = fringeDistances(buf);
  const frames = Array.from({ length: WIND_FRAMES }, (_, f) => colorize(buf, fringe, f));
  plotFences(frames, hole, view, width, height);
  return { width, height, frames, ground: buf.ground };
}
