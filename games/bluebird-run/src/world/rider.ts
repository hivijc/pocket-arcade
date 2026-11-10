import type { Board } from '../sim/board';

/** PixelLab's direction names (also the ingest's folder names). */
export const DIRS = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'] as const;
export type Dir = (typeof DIRS)[number];
export const ANIMS = ['ride', 'air', 'grab', 'tumble'] as const;
export type Anim = (typeof ANIMS)[number];

export interface AnimRows {
  readonly frames: number;
  /** Sheet row for each facing direction. */
  readonly rows: Readonly<Record<Dir, number>>;
}

export interface RiderLayout {
  /** File name inside assets/sprites/. */
  readonly src: string;
  readonly cell: readonly [number, number];
  readonly anchor: readonly [number, number];
  readonly fps: number;
  /** ride is required; missing animations fall back to it. */
  readonly anims: Readonly<Partial<Record<Anim, AnimRows>>> & { readonly ride: AnimRows };
}

export class RiderError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isNatural = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function pair(v: unknown, field: string, ok: (n: unknown) => boolean): readonly [number, number] {
  if (Array.isArray(v) && v.length === 2 && v.every(ok)) return [v[0] as number, v[1] as number];
  throw new RiderError(`rider: ${field} must be a pair of valid numbers`);
}

function parseAnim(raw: unknown, name: string): AnimRows {
  if (!isObj(raw) || !isPosInt(raw.frames)) throw new RiderError(`rider: anims.${name} needs frames`);
  const rows = isObj(raw.rows) ? raw.rows : {};
  return {
    frames: raw.frames,
    rows: Object.fromEntries(DIRS.map((d) => {
      if (!isNatural(rows[d])) throw new RiderError(`rider: anims.${name}.rows.${d} must be a row number`);
      return [d, rows[d] as number];
    })) as Record<Dir, number>,
  };
}

export function parseRider(raw: unknown): RiderLayout {
  if (!isObj(raw)) throw new RiderError('rider: must be an object');
  if (typeof raw.src !== 'string' || !/^[a-z0-9-]+\.png$/.test(raw.src)) throw new RiderError('rider: src must be a .png file name');
  if (!isPosInt(raw.fps)) throw new RiderError('rider: fps must be a positive whole number');
  const anims = isObj(raw.anims) ? raw.anims : {};
  if (anims.ride === undefined) throw new RiderError('rider: anims.ride is required');
  const parsed = Object.fromEntries(ANIMS.flatMap((a) => (anims[a] === undefined ? [] : [[a, parseAnim(anims[a], a)]])));
  return {
    src: raw.src,
    cell: pair(raw.cell, 'cell', isPosInt),
    anchor: pair(raw.anchor, 'anchor', isNatural),
    fps: raw.fps,
    anims: parsed as RiderLayout['anims'],
  };
}

export const rowsFor = (l: RiderLayout, anim: Anim): AnimRows => l.anims[anim] ?? l.anims.ride;

/** Directions in screen-angle order: 0° = east, clockwise (screen y points down). */
const SCREEN_ORDER: readonly Dir[] = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

/** The sprite direction for a facing (degrees from downhill): screen angle = 45° − facing (spec §5). */
export function dirFor(facingDeg: number): Dir {
  const i = Math.round((45 - facingDeg) / 45);
  return SCREEN_ORDER[((i % 8) + 8) % 8];
}

export function animFor(b: Board): Anim {
  if (b.tumble > 0) return 'tumble';
  if (b.air) return b.air.grabbing ? 'grab' : 'air';
  return 'ride';
}
