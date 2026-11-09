import { STREET_WIDTH, STRIPS } from '../world/street';
import { hash2, rampLevel, valueNoise } from './dither';
import { ORIGIN, project, TILE_H, TILE_W, unproject, Z_PX } from './iso';
import { parseHex, type RGB } from './palette';

export const CHUNK_TILES = 16;
export const WIND_FRAMES = 2;
/** How far below the street its earth sides hang, tiles. */
const SIDE_Z = -0.5;
const FRINGE_R = 4;
/** A chunk buffer reaches this far past its own geometry, so the fringe and sides see full neighbourhoods. */
const PAD = 2 * FRINGE_R + 1;
const KERB_HALF = 0.07;
const DASH_HALF = 0.06;
const ROAD_MID = (STRIPS.road[0] + STRIPS.road[1]) / 2;

export type Kind = 'lawn' | 'walk' | 'kerb' | 'road' | 'dash' | 'sideL' | 'sideR';
const KINDS: readonly Kind[] = ['lawn', 'walk', 'kerb', 'road', 'dash', 'sideL', 'sideR'];
const LAWN = 0;

const hexes = (...h: string[]): RGB[] => h.map(parseHex);
export const RAMPS: Readonly<Record<Kind | 'fringe', readonly RGB[]>> = {
  lawn: hexes('#3f6b3a', '#4f8a4c', '#6fae5c', '#8fca6c', '#b5e08a'),
  walk: hexes('#8a8a96', '#b8b8c4', '#efe6d2'),
  kerb: hexes('#4a4a5a', '#8a8a96'),
  road: hexes('#2c2c3a', '#4a4a5a', '#8a8a96'),
  dash: hexes('#f2c25b', '#efe6d2'),
  sideL: hexes('#2e2420', '#4a3b2e', '#6b4f3a'),
  sideR: hexes('#14141c', '#2e2420', '#4a3b2e'),
  fringe: hexes('#1f3a2c', '#2f5530', '#3f6b3a', '#5e8c45'),
};
const SHADE: Readonly<Record<Kind, number>> = { lawn: 0.55, walk: 0.5, kerb: 0.4, road: 0.45, dash: 0.6, sideL: 0.5, sideR: 0.5 };

export interface PixelRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ChunkBake extends PixelRect {
  readonly index: number;
  /** RGBA pixels, one buffer per wind frame; transparent where another chunk owns the pixel. */
  readonly frames: readonly Uint8ClampedArray[];
}

/** The ground surface at a street point, or null off the street. */
export function groundAt(length: number, c: number, s: number): Kind | null {
  if (c < 0 || c >= STREET_WIDTH || s < 0 || s >= length) return null;
  if (c < STRIPS.walkL[0] || c >= STRIPS.walkR[1]) return 'lawn';
  if (Math.abs(c - STRIPS.road[0]) < KERB_HALF || Math.abs(c - STRIPS.road[1]) < KERB_HALF) return 'kerb';
  if (c < STRIPS.road[0] || c >= STRIPS.road[1]) return 'walk';
  if (Math.abs(c - ROAD_MID) < DASH_HALF && s % 2 < 1) return 'dash';
  return 'road';
}

export interface PixelHit {
  readonly kind: Kind;
  readonly c: number;
  readonly s: number;
}

/** What the street shows at world pixel (wx, wy): top surface, a front-facing earth side, or null for sky. */
export function pixelKind(length: number, wx: number, wy: number): PixelHit | null {
  const [x, y] = unproject(ORIGIN, wx, wy, 0);
  const top = groundAt(length, x, length - y);
  if (top) return { kind: top, c: x, s: length - y };
  // The long right edge: the plane x = STREET_WIDTH, hanging down to SIDE_Z.
  const ry = STREET_WIDTH - wx / (TILE_W / 2);
  const rz = ((STREET_WIDTH + ry) * (TILE_H / 2) - wy) / Z_PX;
  if (ry >= 0 && ry <= length && rz >= SIDE_Z && rz <= 0) return { kind: 'sideR', c: STREET_WIDTH, s: length - ry };
  // The near end: the plane y = length (s = 0).
  const fx = wx / (TILE_W / 2) + length;
  const fz = ((fx + length) * (TILE_H / 2) - wy) / Z_PX;
  if (fx >= 0 && fx <= STREET_WIDTH && fz >= SIDE_Z && fz <= 0) return { kind: 'sideL', c: fx, s: 0 };
  return null;
}

export const chunkCount = (length: number): number => Math.ceil(length / CHUNK_TILES);

export const chunkRange = (length: number, index: number): [number, number] =>
  [index * CHUNK_TILES, Math.min(length, (index + 1) * CHUNK_TILES)];

/** Which chunk draws world pixel (wx, wy): decided by the s its centre unprojects to at height 0. */
export function ownerChunk(length: number, wx: number, wy: number): number {
  const s = length - unproject(ORIGIN, wx, wy, 0)[1];
  return Math.max(0, Math.min(chunkCount(length) - 1, Math.floor(s / CHUNK_TILES)));
}

export function chunkBounds(length: number, index: number): PixelRect {
  const [s0, s1] = chunkRange(length, index);
  const pts = [0, STREET_WIDTH].flatMap((c) => [s0, s1].flatMap((s) => [0, SIDE_Z].map((z) => project(ORIGIN, c, length - s, z))));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.floor(Math.min(...xs)) - PAD;
  const y = Math.floor(Math.min(...ys)) - PAD;
  return { x, y, width: Math.ceil(Math.max(...xs)) + PAD - x, height: Math.ceil(Math.max(...ys)) + PAD - y };
}

function shadeOf(p: PixelHit): number {
  if (p.kind !== 'lawn') return SHADE[p.kind];
  return SHADE.lawn + ((Math.floor(p.c) + Math.floor(p.s)) % 2 === 0 ? 0.06 : -0.04); // mowing stripes
}

interface Offset {
  readonly dx: number;
  readonly dy: number;
  readonly dist: number;
}

/** Every offset within the fringe radius, nearest first, so a search can stop at its first lawn hit. */
const FRINGE_OFFSETS: readonly Offset[] = (() => {
  const all: Offset[] = [];
  for (let dy = -FRINGE_R; dy <= FRINGE_R; dy++) {
    for (let dx = -FRINGE_R; dx <= FRINGE_R; dx++) {
      if (dx * dx + dy * dy <= FRINGE_R * FRINGE_R) all.push({ dx, dy, dist: Math.sqrt(dx * dx + dy * dy) });
    }
  }
  return all.sort((p, q) => p.dist - q.dist);
})();

/** Distance (px) to the nearest lawn pixel within the fringe radius, or 0 if none. */
function nearestLawn(kind: Int8Array, w: number, h: number, x: number, y: number): number {
  for (const { dx, dy, dist } of FRINGE_OFFSETS) {
    const xx = x + dx;
    const yy = y + dy;
    if (xx >= 0 && xx < w && yy >= 0 && yy < h && kind[yy * w + xx] === LAWN) return dist;
  }
  return 0;
}

/** Fringe distance for each empty pixel the chunk owns; other pixels are never painted, so they are skipped. */
function fringeDistances(kind: Int8Array, own: Uint8Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (own[i] && kind[i] < 0) out[i] = nearestLawn(kind, w, h, x, y);
    }
  }
  return out;
}

function put(out: Uint8ClampedArray, i: number, c: RGB): void {
  out[i * 4] = c[0];
  out[i * 4 + 1] = c[1];
  out[i * 4 + 2] = c[2];
  out[i * 4 + 3] = 255;
}

interface Classified {
  readonly kind: Int8Array;
  readonly shade: Float32Array;
  readonly own: Uint8Array;
  readonly fringe: Float32Array;
}

function classify(length: number, index: number, b: PixelRect): Classified {
  const n = b.width * b.height;
  const kind = new Int8Array(n).fill(-1);
  const shade = new Float32Array(n);
  const own = new Uint8Array(n);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const i = y * b.width + x;
      const wx = b.x + x + 0.5;
      const wy = b.y + y + 0.5;
      own[i] = ownerChunk(length, wx, wy) === index ? 1 : 0;
      const p = pixelKind(length, wx, wy);
      if (p) {
        kind[i] = KINDS.indexOf(p.kind);
        shade[i] = shadeOf(p);
      }
    }
  }
  return { kind, shade, own, fringe: fringeDistances(kind, own, b.width, b.height) };
}

function colorize(b: PixelRect, k: Classified, frame: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(b.width * b.height * 4);
  for (let y = 0; y < b.height; y++) {
    for (let x = 0; x < b.width; x++) {
      const i = y * b.width + x;
      if (!k.own[i]) continue;
      const gx = b.x + x; // world pixel: noise and dither line up across chunks
      const gy = b.y + y;
      if (k.kind[i] >= 0) {
        const ramp = RAMPS[KINDS[k.kind[i]]];
        const noise = valueNoise(gx, gy, 7, 3) - 0.5;
        put(out, i, ramp[rampLevel(k.shade[i] + noise * 0.3, ramp.length, gx, gy)]);
      } else if (k.fringe[i] > 0) {
        const p = 1 - k.fringe[i] / (FRINGE_R + 1);
        const sway = frame === 1 && hash2(gx, gy, 5) < 0.35 ? 1 : 0;
        if (hash2(gx - sway, gy, 11) < p * 0.85) put(out, i, RAMPS.fringe[rampLevel(p, RAMPS.fringe.length, gx, gy)]);
      }
    }
  }
  return out;
}

/** Bakes one 16-tile chunk of the street (both wind frames). */
export function bakeChunk(length: number, index: number): ChunkBake {
  const b = chunkBounds(length, index);
  const k = classify(length, index, b);
  return { index, ...b, frames: Array.from({ length: WIND_FRAMES }, (_, f) => colorize(b, k, f)) };
}
