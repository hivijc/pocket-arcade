// Pure edits on the hole file format (heights in quarter steps), for the hole editor.
// Every edit returns a new object; an edit outside the grid returns the input unchanged.
import type { Vec2 } from '../core/geometry';

export type Letter = 'G' | 'R' | 'S' | 'W' | 'X';
export interface PropJson { readonly sprite: string; readonly at: Vec2 }

export interface HoleJson {
  readonly name: string;
  readonly par: number;
  readonly size: readonly [number, number];
  /** [depth + 1][width + 1] corner heights in quarter-tile steps. */
  readonly height: readonly (readonly number[])[];
  readonly surface: readonly string[];
  readonly walls?: readonly (readonly [Vec2, Vec2])[];
  readonly tee: Vec2;
  readonly cup: Vec2;
  readonly props: readonly PropJson[];
}

const MAX_QUARTERS = 16;
const tenth = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clampPoint = (p: Vec2, w: number, d: number): Vec2 => [clamp(p[0], 0, w), clamp(p[1], 0, d)];

export function blankHole(width: number, depth: number): HoleJson {
  const mid = Math.floor(depth / 2) + 0.5;
  return {
    name: 'New Hole', par: 3, size: [width, depth],
    height: Array.from({ length: depth + 1 }, () => Array.from({ length: width + 1 }, () => 0)),
    surface: Array.from({ length: depth }, () => 'G'.repeat(width)),
    tee: [1.5, mid], cup: [width - 1.5, mid], props: [],
  };
}

/** A copy of a parsed hole file, checked only for the shape the editor needs (parseHole does the rest). */
export function toHoleJson(raw: unknown): HoleJson {
  if (typeof raw !== 'object' || raw === null) throw new Error('hole must be an object');
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.size) || r.size.length !== 2) throw new Error('hole needs a size [width, depth]');
  if (!Array.isArray(r.height) || !Array.isArray(r.surface)) throw new Error('hole needs height and surface');
  const copy = JSON.parse(JSON.stringify(raw)) as HoleJson;
  return { ...copy, props: copy.props ?? [] };
}

const inGrid = (h: HoleJson, x: number, y: number) => x >= 0 && y >= 0 && x < h.size[0] && y < h.size[1];

export function paintSurface(h: HoleJson, x: number, y: number, letter: Letter): HoleJson {
  if (!inGrid(h, x, y) || h.surface[y][x] === letter) return h;
  const row = h.surface[y];
  return { ...h, surface: h.surface.map((r, i) => (i === y ? row.slice(0, x) + letter + row.slice(x + 1) : r)) };
}

export function bumpCorner(h: HoleJson, x: number, y: number, delta: number): HoleJson {
  if (x < 0 || y < 0 || x > h.size[0] || y > h.size[1]) return h;
  const next = clamp(h.height[y][x] + delta, 0, MAX_QUARTERS);
  if (next === h.height[y][x]) return h;
  return { ...h, height: h.height.map((row, j) => (j === y ? row.map((v, i) => (i === x ? next : v)) : row)) };
}

export function nearestCorner(h: HoleJson, p: Vec2): [number, number] {
  return [clamp(Math.round(p[0]), 0, h.size[0]), clamp(Math.round(p[1]), 0, h.size[1])];
}

export const setTee = (h: HoleJson, p: Vec2): HoleJson => ({ ...h, tee: [tenth(p[0]), tenth(p[1])] });
export const setCup = (h: HoleJson, p: Vec2): HoleJson => ({ ...h, cup: [tenth(p[0]), tenth(p[1])] });

export const addProp = (h: HoleJson, sprite: string, p: Vec2): HoleJson =>
  ({ ...h, props: [...h.props, { sprite, at: [tenth(p[0]), tenth(p[1])] }] });

export function removePropNear(h: HoleJson, p: Vec2, reach: number): HoleJson {
  const dist = (q: PropJson) => Math.hypot(q.at[0] - p[0], q.at[1] - p[1]);
  const best = h.props.reduce<PropJson | null>((b, q) => (dist(q) <= reach && (!b || dist(q) < dist(b)) ? q : b), null);
  return best ? { ...h, props: h.props.filter((q) => q !== best) } : h;
}

export function resizeHole(h: HoleJson, width: number, depth: number): HoleJson {
  const surface = Array.from({ length: depth }, (_, y) =>
    Array.from({ length: width }, (_, x) => h.surface[y]?.[x] ?? 'G').join(''));
  const height = Array.from({ length: depth + 1 }, (_, y) =>
    Array.from({ length: width + 1 }, (_, x) => h.height[y]?.[x] ?? 0));
  const inside = (p: Vec2): Vec2 => [clamp(p[0], 0.5, width - 0.5), clamp(p[1], 0.5, depth - 0.5)];
  return {
    ...h, size: [width, depth], surface, height, tee: inside(h.tee), cup: inside(h.cup),
    props: h.props.map((q) => ({ ...q, at: clampPoint(q.at, width, depth) })),
  };
}

const list = (v: readonly unknown[]) => `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
const point = (p: Vec2) => `[${p[0]}, ${p[1]}]`;

/** The hole as JSON in the layout of the hand-made files: one grid row, wall or prop per line. */
export function formatHole(h: HoleJson): string {
  const block = (lines: readonly string[]) => lines.length === 0 ? '[]' : `[\n${lines.map((l) => `    ${l}`).join(',\n')}\n  ]`;
  const walls = h.walls && h.walls.length > 0
    ? [`  "walls": ${block(h.walls.map(([a, b]) => `[${point(a)}, ${point(b)}]`))},`] : [];
  return [
    '{',
    `  "name": ${JSON.stringify(h.name)},`,
    `  "par": ${h.par},`,
    `  "size": ${list(h.size)},`,
    `  "height": ${block(h.height.map(list))},`,
    `  "surface": ${block(h.surface.map((r) => JSON.stringify(r)))},`,
    ...walls,
    `  "tee": ${point(h.tee)},`,
    `  "cup": ${point(h.cup)},`,
    `  "props": ${block(h.props.map((q) => `{ "sprite": ${JSON.stringify(q.sprite)}, "at": ${point(q.at)} }`))}`,
    '}',
    '',
  ].join('\n');
}
