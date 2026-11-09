export const DIRS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'] as const;
export type Dir = (typeof DIRS)[number];
export const GOLFER_ANIMS = ['idle', 'backswing', 'stroke', 'celebrate'] as const;
export type GolferAnim = (typeof GOLFER_ANIMS)[number];

export interface AnimLayout {
  readonly frames: number;
  readonly fps: number;
  /** Sheet row for each facing direction. */
  readonly rows: Readonly<Record<Dir, number>>;
}

export interface GolferLayout {
  /** File name inside assets/sprites/. */
  readonly src: string;
  readonly cell: readonly [number, number];
  readonly anchor: readonly [number, number];
  readonly anims: Readonly<Record<GolferAnim, AnimLayout>>;
}

export class GolferError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isNatural = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

const allRows = (n: number): Record<Dir, number> => Object.fromEntries(DIRS.map((d) => [d, n])) as Record<Dir, number>;

/** One-frame layout used when no golfer art has been ingested yet. */
export const PLACEHOLDER_ANIMS: GolferLayout['anims'] = {
  idle: { frames: 1, fps: 1, rows: allRows(0) },
  backswing: { frames: 1, fps: 1, rows: allRows(0) },
  stroke: { frames: 1, fps: 1, rows: allRows(0) },
  celebrate: { frames: 1, fps: 1, rows: allRows(0) },
};

function pair(v: unknown, field: string, ok: (n: unknown) => boolean): readonly [number, number] {
  if (Array.isArray(v) && v.length === 2 && v.every(ok)) return [v[0] as number, v[1] as number];
  throw new GolferError(`golfer: ${field} must be a pair of valid numbers`);
}

function parseAnim(name: GolferAnim, raw: unknown): AnimLayout {
  if (!isObj(raw) || !isPosInt(raw.frames) || !isPosInt(raw.fps) || !isObj(raw.rows)) {
    throw new GolferError(`golfer: anims.${name} needs frames, fps and rows`);
  }
  const rows = raw.rows;
  const parsed = Object.fromEntries(DIRS.map((d) => {
    if (!isNatural(rows[d])) throw new GolferError(`golfer: anims.${name}.rows.${d} must be a row number`);
    return [d, rows[d] as number];
  })) as Record<Dir, number>;
  return { frames: raw.frames, fps: raw.fps, rows: parsed };
}

export function parseGolfer(raw: unknown): GolferLayout {
  if (!isObj(raw)) throw new GolferError('golfer: must be an object');
  if (typeof raw.src !== 'string' || !/^[a-z0-9-]+\.png$/.test(raw.src)) throw new GolferError('golfer: src must be a .png file name');
  const anims = isObj(raw.anims) ? raw.anims : {};
  return {
    src: raw.src,
    cell: pair(raw.cell, 'cell', isPosInt),
    anchor: pair(raw.anchor, 'anchor', isNatural),
    anims: Object.fromEntries(GOLFER_ANIMS.map((a) => {
      if (!(a in anims)) throw new GolferError(`golfer: anims.${a} is missing`);
      return [a, parseAnim(a, anims[a])];
    })) as Record<GolferAnim, AnimLayout>,
  };
}
