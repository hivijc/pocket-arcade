import { closestPointOnSegment, distance, type Vec2 } from '../core/geometry';
import { BALL_R } from '../physics/constants';
import type { Manifest } from './manifest';

export type { Vec2 } from '../core/geometry';
/** Green, Rough, Sand, Water, planks (a boardwalk: plays like green), and X for no tile. */
export type Surface = 'G' | 'R' | 'S' | 'W' | 'P' | 'X';

export interface Segment { readonly a: Vec2; readonly b: Vec2 }
export interface Circle { readonly c: Vec2; readonly r: number }
export interface PropPlacement { readonly sprite: string; readonly at: Vec2 }

export interface Hole {
  readonly name: string;
  readonly par: number;
  readonly width: number;
  readonly depth: number;
  /** [depth + 1][width + 1] corner heights, in tiles. */
  readonly heights: readonly (readonly number[])[];
  /** [depth] rows of `width` surface letters. */
  readonly surface: readonly string[];
  readonly walls: readonly Segment[];
  readonly circles: readonly Circle[];
  readonly tee: Vec2;
  readonly cup: Vec2;
  readonly props: readonly PropPlacement[];
}

export class HoleError extends Error {}

export const QUARTER = 0.25;
const SURFACES = new Set(['G', 'R', 'S', 'W', 'P', 'X']);

type Fail = (msg: string) => never;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function point(v: unknown, field: string, fail: Fail): Vec2 {
  if (Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1])) return [v[0], v[1]];
  return fail(`${field} must be [x, y]`);
}

function parseSurface(v: unknown, width: number, depth: number, fail: Fail): string[] {
  if (!Array.isArray(v) || v.length !== depth) return fail(`surface must have ${depth} rows`);
  return v.map((row, y) => {
    if (typeof row !== 'string' || row.length !== width) return fail(`surface row ${y} must be a string of ${width} letters`);
    const unknown = [...row].find((c) => !SURFACES.has(c));
    if (unknown !== undefined) return fail(`surface row ${y} has unknown letter "${unknown}"`);
    return row;
  });
}

function parseHeights(v: unknown, width: number, depth: number, fail: Fail): number[][] {
  if (!Array.isArray(v) || v.length !== depth + 1) return fail(`height must have ${depth + 1} rows of corners`);
  return v.map((row, y) => {
    if (!Array.isArray(row) || row.length !== width + 1 || !row.every(isNum)) {
      return fail(`height row ${y} must have ${width + 1} numbers`);
    }
    return row.map((q: number) => q * QUARTER);
  });
}

function parseWalls(v: unknown, fail: Fail): Segment[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return fail('walls must be an array');
  return v.map((w, i) => {
    const field = `walls[${i}] must be [[x, y], [x, y]]`;
    if (!Array.isArray(w) || w.length !== 2) return fail(field);
    return { a: point(w[0], field, fail), b: point(w[1], field, fail) };
  });
}

function parseProps(v: unknown, manifest: Manifest, width: number, depth: number, fail: Fail): PropPlacement[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return fail('props must be an array');
  return v.map((p, i) => {
    if (!isObj(p) || typeof p.sprite !== 'string') return fail(`props[${i}].sprite must be a string`);
    if (!manifest[p.sprite]) return fail(`props[${i}] uses unknown sprite "${p.sprite}"`);
    const at = point(p.at, `props[${i}].at`, fail);
    if (at[0] < 0 || at[1] < 0 || at[0] > width || at[1] > depth) return fail(`props[${i}].at is outside the grid`);
    return { sprite: p.sprite, at };
  });
}

/** A wall on every edge where a play tile meets an X tile or the outside of the grid. */
export function edgeWalls(surface: readonly string[], width: number, depth: number): Segment[] {
  const solid = (x: number, y: number) => x < 0 || y < 0 || x >= width || y >= depth || surface[y][x] === 'X';
  return surface.flatMap((row, y) =>
    [...row].flatMap((cell, x): Segment[] => {
      if (cell === 'X') return [];
      return [
        solid(x, y - 1) ? [{ a: [x, y], b: [x + 1, y] } as Segment] : [],
        solid(x, y + 1) ? [{ a: [x, y + 1], b: [x + 1, y + 1] } as Segment] : [],
        solid(x - 1, y) ? [{ a: [x, y], b: [x, y + 1] } as Segment] : [],
        solid(x + 1, y) ? [{ a: [x + 1, y], b: [x + 1, y + 1] } as Segment] : [],
      ].flat();
    }),
  );
}

function boxSegments(at: Vec2, w: number, d: number): Segment[] {
  const x0 = at[0] - w / 2, x1 = at[0] + w / 2, y0 = at[1] - d / 2, y1 = at[1] + d / 2;
  return [
    { a: [x0, y0], b: [x1, y0] },
    { a: [x1, y0], b: [x1, y1] },
    { a: [x1, y1], b: [x0, y1] },
    { a: [x0, y1], b: [x0, y0] },
  ];
}

export function parseHole(raw: unknown, manifest: Manifest, file: string): Hole {
  const fail: Fail = (msg) => { throw new HoleError(`${file}: ${msg}`); };
  if (!isObj(raw)) return fail('must be an object');

  const name = typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : fail('name must be a non-empty string');
  const par = typeof raw.par === 'number' && Number.isInteger(raw.par) && raw.par >= 1 && raw.par <= 5
    ? raw.par : fail('par must be an integer from 1 to 5');
  const size = Array.isArray(raw.size) && raw.size.length === 2 && raw.size.every((n) => Number.isInteger(n) && n > 0)
    ? (raw.size as [number, number]) : fail('size must be [width, depth] positive integers');
  const [width, depth] = size;

  const surface = parseSurface(raw.surface, width, depth, fail);
  const heights = parseHeights(raw.height, width, depth, fail);
  const tee = point(raw.tee, 'tee', fail);
  const cup = point(raw.cup, 'cup', fail);
  const props = parseProps(raw.props, manifest, width, depth, fail);

  const circles: Circle[] = props.flatMap((p) => {
    const fp = manifest[p.sprite].footprint;
    return fp?.kind === 'circle' ? [{ c: p.at, r: fp.r }] : [];
  });
  const walls: Segment[] = [
    ...parseWalls(raw.walls, fail),
    ...edgeWalls(surface, width, depth),
    ...props.flatMap((p) => {
      const fp = manifest[p.sprite].footprint;
      return fp?.kind === 'box' ? boxSegments(p.at, fp.w, fp.d) : [];
    }),
  ];

  const surfaceAt = (p: Vec2) => surface[Math.floor(p[1])]?.[Math.floor(p[0])];
  const blocked = (p: Vec2) =>
    walls.some((w) => distance(p, closestPointOnSegment(p, w.a, w.b)) <= BALL_R) ||
    circles.some((c) => distance(p, c.c) <= c.r + BALL_R);
  for (const [label, p] of [['tee', tee], ['cup', cup]] as const) {
    if (surfaceAt(p) !== 'G') fail(`${label} must be on a green (G) tile`);
    if (blocked(p)) fail(`${label} is inside a wall or prop`);
  }

  return { name, par, width, depth, heights, surface, walls, circles, tee, cup, props };
}
