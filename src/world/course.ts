import type { TerrainStyle } from '../render/terrain-bake';

/**
 * A course: a name, a palette, terrain ramps, a prop manifest and an ordered list of holes.
 * Each course lives in `src/world/courses/<id>/` (its definition and holes) and, apart from
 * Backyard's original files, `assets/courses/<id>/` (palette, manifest, sprites).
 */
export type CourseId = 'backyard' | 'boardwalk';
export const COURSE_IDS: readonly CourseId[] = ['backyard', 'boardwalk'];
export const DEFAULT_COURSE: CourseId = 'backyard';

export interface HoleFile {
  /** Where the hole came from, for error messages. */
  readonly file: string;
  readonly raw: unknown;
}

export interface CourseDef {
  readonly id: CourseId;
  readonly name: string;
  /** One line for the title card. */
  readonly tagline: string;
  /** Raw palette JSON ({ colors: [...] }). */
  readonly palette: unknown;
  /** Raw prop manifest JSON. */
  readonly manifest: unknown;
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

/** Hole files from an import.meta.glob map, ordered by file name (01.json, 02.json, ...). */
export function holeFiles(glob: Readonly<Record<string, unknown>>): HoleFile[] {
  // 'holes/01.json': the file and its folder, which is also the sort key.
  const short = (path: string) => path.slice(path.lastIndexOf('/', path.lastIndexOf('/') - 1) + 1);
  return Object.keys(glob)
    .map((path) => ({ file: short(path), raw: glob[path] }))
    .sort((a, b) => a.file.localeCompare(b.file));
}

const LOADERS: Readonly<Record<CourseId, () => Promise<{ readonly course: CourseDef }>>> = {
  backyard: () => import('./courses/backyard'),
  boardwalk: () => import('./courses/boardwalk'),
};

/** Loads a course's definition (each course is its own chunk). */
export async function loadCourseDef(id: CourseId): Promise<CourseDef> {
  return (await LOADERS[id]()).course;
}
