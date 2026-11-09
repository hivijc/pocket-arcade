import type { Vec2 } from '../core/geometry';
import type { Hole, Surface } from '../world/hole';
import { project, type View } from './iso';

type RGB = readonly [number, number, number];

const TOP: Readonly<Record<Surface, RGB>> = {
  G: [111, 174, 92],
  R: [78, 128, 62],
  S: [222, 200, 140],
  W: [90, 160, 200],
  X: [0, 0, 0],
};
const SIDE_LEFT: RGB = [110, 82, 58];
const SIDE_RIGHT: RGB = [84, 62, 44];
/** How far the island's earth sides hang below height 0, in tiles. */
const BASE_Z = -0.5;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Brightness for a tile from its slope (light from screen upper-left) plus mown stripes on green. */
export function tileShade(dhdx: number, dhdy: number, x: number, y: number, surface: Surface): number {
  const light = 1 + 0.6 * dhdx + 0.2 * dhdy;
  const stripe = surface === 'G' ? ((x + y) % 2 === 0 ? 1.04 : 0.97) : 1;
  return clamp(light * stripe, 0.6, 1.4);
}

export function shadeColor(c: RGB, k: number): string {
  const [r, g, b] = c.map((v) => Math.round(clamp(v * k, 0, 255)));
  return `rgb(${r},${g},${b})`;
}

function fillPoly(ctx: CanvasRenderingContext2D, pts: readonly Vec2[], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

function drawTile(ctx: CanvasRenderingContext2D, hole: Hole, view: View, x: number, y: number): void {
  const surface = hole.surface[y][x] as Surface;
  if (surface === 'X') return;
  const h = hole.heights;
  const h00 = h[y][x], h10 = h[y][x + 1], h01 = h[y + 1][x], h11 = h[y + 1][x + 1];
  const pts = [project(view, x, y, h00), project(view, x + 1, y, h10), project(view, x + 1, y + 1, h11), project(view, x, y + 1, h01)];
  const dhdx = (h10 - h00 + (h11 - h01)) / 2;
  const dhdy = (h01 - h00 + (h11 - h10)) / 2;
  fillPoly(ctx, pts, shadeColor(TOP[surface], tileShade(dhdx, dhdy, x, y, surface)));
}

function drawSides(ctx: CanvasRenderingContext2D, hole: Hole, view: View): void {
  const solid = (x: number, y: number) => x >= hole.width || y >= hole.depth || hole.surface[y][x] === 'X';
  const h = hole.heights;
  for (let y = 0; y < hole.depth; y++) {
    for (let x = 0; x < hole.width; x++) {
      if (hole.surface[y][x] === 'X') continue;
      if (solid(x, y + 1)) {
        fillPoly(ctx, [
          project(view, x, y + 1, h[y + 1][x]), project(view, x + 1, y + 1, h[y + 1][x + 1]),
          project(view, x + 1, y + 1, BASE_Z), project(view, x, y + 1, BASE_Z),
        ], shadeColor(SIDE_LEFT, 1));
      }
      if (solid(x + 1, y)) {
        fillPoly(ctx, [
          project(view, x + 1, y, h[y][x + 1]), project(view, x + 1, y + 1, h[y + 1][x + 1]),
          project(view, x + 1, y + 1, BASE_Z), project(view, x + 1, y, BASE_Z),
        ], shadeColor(SIDE_RIGHT, 1));
      }
    }
  }
}

/** Draws the hole's ground once into an offscreen canvas the size of the buffer. */
export function drawTerrain(hole: Hole, view: View, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  for (let s = 0; s <= hole.width + hole.depth - 2; s++) {
    for (let y = 0; y < hole.depth; y++) {
      const x = s - y;
      if (x >= 0 && x < hole.width) drawTile(ctx, hole, view, x, y);
    }
  }
  drawSides(ctx, hole, view);
  return canvas;
}
