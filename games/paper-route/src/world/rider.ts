export const DIRS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'] as const;
export type Dir = (typeof DIRS)[number];

export interface RiderLayout {
  /** File name inside assets/sprites/. */
  readonly src: string;
  readonly cell: readonly [number, number];
  readonly anchor: readonly [number, number];
  readonly frames: number;
  readonly fps: number;
  /** Sheet row for each facing direction. */
  readonly rows: Readonly<Record<Dir, number>>;
}

export class RiderError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isNatural = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function pair(v: unknown, field: string, ok: (n: unknown) => boolean): readonly [number, number] {
  if (Array.isArray(v) && v.length === 2 && v.every(ok)) return [v[0] as number, v[1] as number];
  throw new RiderError(`rider: ${field} must be a pair of valid numbers`);
}

export function parseRider(raw: unknown): RiderLayout {
  if (!isObj(raw)) throw new RiderError('rider: must be an object');
  if (typeof raw.src !== 'string' || !/^[a-z0-9-]+\.png$/.test(raw.src)) throw new RiderError('rider: src must be a .png file name');
  if (!isPosInt(raw.frames) || !isPosInt(raw.fps)) throw new RiderError('rider: frames and fps must be positive whole numbers');
  const rows = isObj(raw.rows) ? raw.rows : {};
  return {
    src: raw.src,
    cell: pair(raw.cell, 'cell', isPosInt),
    anchor: pair(raw.anchor, 'anchor', isNatural),
    frames: raw.frames,
    fps: raw.fps,
    rows: Object.fromEntries(DIRS.map((d) => {
      if (!isNatural(rows[d])) throw new RiderError(`rider: rows.${d} must be a row number`);
      return [d, rows[d] as number];
    })) as Record<Dir, number>,
  };
}

/** Riding straight faces up-right (north-east); steering leans toward north (left) or east (right). */
export function riderDir(lean: -1 | 0 | 1): Dir {
  if (lean < 0) return 'north';
  if (lean > 0) return 'east';
  return 'north-east';
}
