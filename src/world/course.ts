import { parseHole, type Hole } from './hole';
import type { Manifest } from './manifest';

export interface HoleFile {
  readonly path: string;
  readonly raw: unknown;
}

const unwrap = (mod: unknown): unknown =>
  typeof mod === 'object' && mod !== null && 'default' in mod ? (mod as { default: unknown }).default : mod;

/** `import.meta.glob` modules as hole files, sorted by file name (01.json, 02.json, … 10.json). */
export function sortedHoleFiles(modules: Readonly<Record<string, unknown>>): HoleFile[] {
  return Object.keys(modules)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({ path, raw: unwrap(modules[path]) }));
}

/** A short label for error messages: the path from `holes/` on. */
export function holeLabel(path: string): string {
  const i = path.lastIndexOf('holes/');
  return i >= 0 ? path.slice(i) : path;
}

export function parseCourse(modules: Readonly<Record<string, unknown>>, manifest: Manifest): Hole[] {
  const files = sortedHoleFiles(modules);
  if (files.length === 0) throw new Error('course has no holes');
  return files.map((f) => parseHole(f.raw, manifest, holeLabel(f.path)));
}

export interface LazyList<T> {
  /** The item at `index`, made on first use and cached after. */
  get(index: number): T;
  has(index: number): boolean;
}

export function lazyList<T>(length: number, make: (index: number) => T): LazyList<T> {
  const cache = new Map<number, T>();
  return {
    get(index) {
      if (!Number.isInteger(index) || index < 0 || index >= length) throw new RangeError(`no item ${index} of ${length}`);
      const hit = cache.get(index);
      if (hit !== undefined || cache.has(index)) return hit as T;
      const made = make(index);
      cache.set(index, made);
      return made;
    },
    has: (index) => cache.has(index),
  };
}

export const courseSubtitle = (holeCount: number): string =>
  `${holeCount} ${holeCount === 1 ? 'hole' : 'holes'} of mini-golf`;
