import { SLOPE } from '../sim/constants';
import type { Slope } from '../world/slope';
import { hash2, rampLevel, valueNoise } from './dither';
import { ORIGIN, slopePx, TILE_H, TILE_W, unproject, Z_PX } from './iso';
import { parseHex, type RGB } from './palette';

export const CHUNK_TILES = 16;
/** How far below the snow the rock sides hang, tiles. */
const SIDE_Z = -0.6;
const FRINGE_R = 3;
const PAD = Math.max(2 * FRINGE_R + 1, Math.ceil(-SIDE_Z * Z_PX) + FRINGE_R + 1);
const W = SLOPE.width;

export type Kind = 'groomed' | 'packed' | 'powder' | 'shade' | 'sideC' | 'sideD';
const KINDS: readonly Kind[] = ['groomed', 'packed', 'powder', 'shade', 'sideC', 'sideD'];
const POWDER = KINDS.indexOf('powder');

const hexes = (...h: string[]): RGB[] => h.map(parseHex);
export const RAMPS: Readonly<Record<Kind | 'lip', readonly RGB[]>> = {
  groomed: hexes('#a9c2e2', '#c9daee', '#e3edf8', '#f4f8ff'),
  packed: hexes('#8aa6d4', '#a9c2e2', '#b8b8c4', '#c9daee'),
  powder: hexes('#e3edf8', '#f4f8ff', '#ffffff'),
  shade: hexes('#4d5f9a', '#6b84bf', '#8aa6d4'),
  sideC: hexes('#2c2c3a', '#4a4a5a', '#8a8a96'),
  sideD: hexes('#14141c', '#2c2c3a', '#4a4a5a'),
  lip: hexes('#c9daee', '#f4f8ff', '#ffffff'),
};
const SHADE: Readonly<Record<Kind, number>> = { groomed: 0.6, packed: 0.5, powder: 0.65, shade: 0.5, sideC: 0.5, sideD: 0.5 };

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ChunkBake extends PixelRect {
  readonly index: number;
  /** RGBA pixels (one frame: snow has no wind). Transparent where another chunk owns the pixel. */
  readonly frames: readonly Uint8ClampedArray[];
}

export type Ground = Pick<Slope, 'length' | 'surfaces'>;

/** Where powder gives way to groomed snow on each side: a lumpy line, not a ruler edge. */
const powderEdge = (d: number, side: 0 | 1): number => SLOPE.powder + (valueNoise(d * 6, side * 97, 4, 9) - 0.5) * 0.7;

/** The snow surface at a slope point, or null off the slope. */
export function groundAt(g: Ground, c: number, d: number): Kind | null {
  if (c < 0 || c >= W || d < 0 || d >= g.length) return null;
  if (c < powderEdge(d, 0) || c > W - powderEdge(d, 1)) return 'powder';
  for (let i = g.surfaces.length - 1; i >= 0; i--) {
    const r = g.surfaces[i].rect;
    if (c >= r.c0 && c < r.c1 && d >= r.d0 && d < r.d1) return g.surfaces[i].kind;
  }
  return 'groomed';
}

export interface PixelHit {
  readonly kind: Kind;
  readonly c: number;
  readonly d: number;
}

/** What the slope shows at world pixel (wx, wy): snow on top, a rock side, or null for sky. */
export function pixelKind(g: Ground, wx: number, wy: number): PixelHit | null {
  const [x, y] = unproject(ORIGIN, wx, wy, 0);
  const top = groundAt(g, W - y, x);
  if (top) return { kind: top, c: W - y, d: x };
  // The long screen-left edge: the plane y = W (c = 0), hanging down to SIDE_Z.
  const lx = wx / (TILE_W / 2) + W;
  const lz = ((lx + W) * (TILE_H / 2) - wy) / Z_PX;
  if (lx >= 0 && lx <= g.length && lz >= SIDE_Z && lz <= 0) return { kind: 'sideC', c: 0, d: lx };
  // The bottom end: the plane x = length.
  const ey = g.length - wx / (TILE_W / 2);
  const ez = ((g.length + ey) * (TILE_H / 2) - wy) / Z_PX;
  if (ey >= 0 && ey <= W && ez >= SIDE_Z && ez <= 0) return { kind: 'sideD', c: W - ey, d: g.length };
  return null;
}

export const chunkCount = (length: number): number => Math.ceil(length / CHUNK_TILES);

export const chunkRange = (length: number, index: number): [number, number] =>
  [index * CHUNK_TILES, Math.min(length, (index + 1) * CHUNK_TILES)];

/** Which chunk draws world pixel (wx, wy): decided by the d its centre unprojects to at height 0. */
export function ownerChunk(length: number, wx: number, wy: number): number {
  const d = unproject(ORIGIN, wx, wy, 0)[0];
  return Math.max(0, Math.min(chunkCount(length) - 1, Math.floor(d / CHUNK_TILES)));
}

export function chunkBounds(length: number, index: number): PixelRect {
  const [d0, d1] = chunkRange(length, index);
  const pts = [0, W].flatMap((c) => [d0, d1].flatMap((d) => [0, SIDE_Z].map((z) => slopePx(ORIGIN, c, d, z))));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.floor(Math.min(...xs)) - PAD;
  const y = Math.floor(Math.min(...ys)) - PAD;
  return { x, y, width: Math.ceil(Math.max(...xs)) + PAD - x, height: Math.ceil(Math.max(...ys)) + PAD - y };
}

/** Corduroy: faint grooming lines running downhill on groomed snow. */
function shadeAt(kind: Kind, gx: number, gy: number): number {
  if (kind !== 'groomed') return SHADE[kind];
  return SHADE.groomed + ((((gx >> 1) + gy) & 7) === 0 ? -0.18 : 0);
}

interface Offset { readonly dx: number; readonly dy: number; readonly dist: number }

const LIP_OFFSETS: readonly Offset[] = (() => {
  const all: Offset[] = [];
  for (let dy = -FRINGE_R; dy <= FRINGE_R; dy++) {
    for (let dx = -FRINGE_R; dx <= FRINGE_R; dx++) {
      if (dx * dx + dy * dy <= FRINGE_R * FRINGE_R) all.push({ dx, dy, dist: Math.sqrt(dx * dx + dy * dy) });
    }
  }
  return all.sort((p, q) => p.dist - q.dist);
})();

/** Distance (px) to the nearest powder pixel within the lip radius, or 0 if none. */
function nearestPowder(kind: Int8Array, w: number, h: number, x: number, y: number): number {
  for (const { dx, dy, dist } of LIP_OFFSETS) {
    const xx = x + dx;
    const yy = y + dy;
    if (xx >= 0 && xx < w && yy >= 0 && yy < h && kind[yy * w + xx] === POWDER) return dist;
  }
  return 0;
}

// Per-chunk pixel buffer: written once while baking, deliberately mutated.
function put(out: Uint8ClampedArray, i: number, c: RGB): void {
  out[i * 4] = c[0];
  out[i * 4 + 1] = c[1];
  out[i * 4 + 2] = c[2];
  out[i * 4 + 3] = 255;
}

interface Classified {
  readonly kind: Int8Array;
  readonly own: Uint8Array;
}

function classify(g: Ground, index: number, b: PixelRect): Classified {
  const n = b.width * b.height;
  const kind = new Int8Array(n).fill(-1);
  const own = new Uint8Array(n);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const i = y * b.width + x;
      const wx = b.x + x + 0.5;
      const wy = b.y + y + 0.5;
      own[i] = ownerChunk(g.length, wx, wy) === index ? 1 : 0;
      const p = pixelKind(g, wx, wy);
      if (p) kind[i] = KINDS.indexOf(p.kind);
    }
  }
  return { kind, own };
}

function colorize(b: PixelRect, k: Classified): Uint8ClampedArray {
  const out = new Uint8ClampedArray(b.width * b.height * 4);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const i = y * b.width + x;
      if (!k.own[i]) continue;
      const gx = b.x + x; // world pixel: noise and dither line up across chunks
      const gy = b.y + y;
      if (k.kind[i] >= 0) {
        const kind = KINDS[k.kind[i]];
        const ramp = RAMPS[kind];
        const noise = valueNoise(gx, gy, 9, 3) - 0.5;
        put(out, i, ramp[rampLevel(shadeAt(kind, gx, gy) + noise * 0.25, ramp.length, gx, gy)]);
        continue;
      }
      const dist = nearestPowder(k.kind, b.width, b.height, x, y);
      if (dist <= 0) continue;
      const p = 1 - dist / (FRINGE_R + 1);
      if (hash2(gx, gy, 11) < p * 0.8) put(out, i, RAMPS.lip[rampLevel(p, RAMPS.lip.length, gx, gy)]);
    }
  }
  return out;
}

/** Bakes one 16-tile chunk of the slope. */
export function bakeChunk(g: Ground, index: number): ChunkBake {
  const b = chunkBounds(g.length, index);
  return { index, ...b, frames: [colorize(b, classify(g, index, b))] };
}
