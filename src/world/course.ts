import type { TerrainStyle } from '../render/terrain-bake';
import { parseHole, type Hole } from './hole';
import type { Manifest } from './manifest';

/**
 * A course: a name, a palette, terrain ramps, a prop manifest and an ordered list of holes.
 * Each course lives in `src/world/courses/<id>/` (its definition, and its holes unless it is
 * Backyard, whose holes stay in `src/world/holes/`) and, apart from Backyard's original files,
 * `assets/courses/<id>/` (palette, manifest, sprites).
 */
export type CourseId = 'backyard' | 'boardwalk';
export const COURSE_IDS: readonly CourseId[] = ['backyard', 'boardwalk'];
export const DEFAULT_COURSE: CourseId = 'backyard';

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

export interface CourseDef {
  readonly id: CourseId;
  readonly name: string;
  /** A few words for the title card, after the hole count. */
  readonly tagline: string;
  /** Raw palette JSON ({ colors: [...] }). */
  readonly palette: unknown;
  /** Raw prop manifest JSON. */
  readonly manifest: unknown;
  /** The course's hole files in play order (from `sortedHoleFiles`). */
  readonly holes: readonly HoleFile[];
  /** Folder under assets/ that holds this course's prop sprites. */
  readonly spriteDir: string;
  readonly terrain: TerrainStyle;
  /** The canvas backdrop behind the island, #rrggbb (snapped to the palette by the post pass). */
  readonly background: string;
}

/** Display names, available before a course's data has loaded (for the picker). */
export const COURSE_NAMES: Readonly<Record<CourseId, string>> = { backyard: 'Backyard', boardwalk: 'Boardwalk' };

export const isCourseId = (v: unknown): v is CourseId => COURSE_IDS.includes(v as CourseId);

/** `?course=boardwalk` picks a course; anything else is the default. */
export function courseFromSearch(search: string): CourseId {
  const asked = new URLSearchParams(search).get('course');
  return isCourseId(asked) ? asked : DEFAULT_COURSE;
}

/** Parses a course's holes with its own manifest. */
export function courseHoles(course: CourseDef, manifest: Manifest): Hole[] {
  if (course.holes.length === 0) throw new Error(`${course.id}: course has no holes`);
  return course.holes.map((f) => parseHole(f.raw, manifest, `${course.id}/${holeLabel(f.path)}`));
}

const LOADERS: Readonly<Record<CourseId, () => Promise<{ readonly course: CourseDef }>>> = {
  backyard: () => import('./courses/backyard'),
  boardwalk: () => import('./courses/boardwalk'),
};

/** Loads a course's definition (each course is its own chunk). */
export async function loadCourseDef(id: CourseId): Promise<CourseDef> {
  return (await LOADERS[id]()).course;
}
