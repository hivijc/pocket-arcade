import type { Vec2 } from '../core/geometry';

export const STREET_WIDTH = 14;
export const LAWN_WIDTH = 4;
export const LOT_LENGTH = 10;
/** Across-street layout in tiles of c (see spec §4). */
export const STRIPS = { lawnL: [0, 4], walkL: [4, 5], road: [5, 9], walkR: [9, 10], lawnR: [10, 14] } as const;

export type Side = 'L' | 'R';

/** Inclusive axis-aligned rectangle in street coordinates. */
export interface Rect {
  readonly c0: number;
  readonly s0: number;
  readonly c1: number;
  readonly s1: number;
}

export interface Lot {
  readonly index: number;
  readonly side: Side;
  readonly s: number;
  readonly house: string;
  readonly subscriber: boolean;
  /** Absolute. */
  readonly porch: Rect;
  /** Absolute [c, s]. */
  readonly mailbox: Vec2;
}

export interface Prop {
  readonly kind: string;
  readonly at: Vec2;
}

export type Hazard =
  | { readonly kind: 'car'; readonly at: Vec2 }
  | { readonly kind: 'puddle'; readonly at: Vec2 }
  | { readonly kind: 'sprinkler'; readonly at: Vec2; readonly spray: Rect };

export interface Street {
  readonly name: string;
  readonly length: number;
  readonly lots: readonly Lot[];
  readonly props: readonly Prop[];
  /** Cars, puddles and sprinklers. The dog is separate. */
  readonly hazards: readonly Hazard[];
  readonly dogHome: Vec2;
  readonly bundles: readonly Vec2[];
}

export class StreetError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const NAME = /^[a-z0-9-]+$/;
const MIN_LENGTH = 20;

export const lotOriginC = (side: Side): number => (side === 'L' ? 0 : STREET_WIDTH - LAWN_WIDTH);

export const inRect = (r: Rect, c: number, s: number): boolean => c >= r.c0 && c <= r.c1 && s >= r.s0 && s <= r.s1;

function nums(v: unknown, n: number, field: string): number[] {
  if (!Array.isArray(v) || v.length !== n || !v.every(isNum)) throw new StreetError(`street: ${field} must be ${n} numbers`);
  return v as number[];
}

function point(v: unknown, field: string, length: number): Vec2 {
  const [c, s] = nums(v, 2, field);
  if (c < 0 || c > STREET_WIDTH || s < 0 || s > length) throw new StreetError(`street: ${field} [${c}, ${s}] is outside the street`);
  return [c, s];
}

function rect(v: unknown, field: string): Rect {
  const [c0, s0, c1, s1] = nums(v, 4, field);
  if (c1 <= c0 || s1 <= s0) throw new StreetError(`street: ${field} must have c1 > c0 and s1 > s0`);
  return { c0, s0, c1, s1 };
}

function parseLot(raw: unknown, index: number, length: number): Lot {
  const f = `lots[${index}]`;
  if (!isObj(raw)) throw new StreetError(`street: ${f} must be an object`);
  if (raw.side !== 'L' && raw.side !== 'R') throw new StreetError(`street: ${f}.side must be "L" or "R"`);
  if (!isNum(raw.s) || raw.s < 0 || raw.s + LOT_LENGTH > length) throw new StreetError(`street: ${f}.s must leave a whole lot inside the street`);
  if (typeof raw.house !== 'string' || !NAME.test(raw.house)) throw new StreetError(`street: ${f}.house must be a sprite name`);
  if (typeof raw.subscriber !== 'boolean') throw new StreetError(`street: ${f}.subscriber must be true or false`);
  const oc = lotOriginC(raw.side);
  const lawn: Rect = { c0: oc, s0: raw.s, c1: oc + LAWN_WIDTH, s1: raw.s + LOT_LENGTH };
  const [pc, ps, pw, ph] = nums(raw.porch, 4, `${f}.porch`);
  const porch: Rect = { c0: oc + pc, s0: raw.s + ps, c1: oc + pc + pw, s1: raw.s + ps + ph };
  if (pw <= 0 || ph <= 0 || !inRect(lawn, porch.c0, porch.s0) || !inRect(lawn, porch.c1, porch.s1)) {
    throw new StreetError(`street: ${f}.porch must be a positive rectangle inside the lot`);
  }
  const [mc, ms] = nums(raw.mailbox, 2, `${f}.mailbox`);
  const mailbox: Vec2 = [oc + mc, raw.s + ms];
  if (!inRect(lawn, mailbox[0], mailbox[1])) throw new StreetError(`street: ${f}.mailbox must be inside the lot`);
  return { index, side: raw.side, s: raw.s, house: raw.house, subscriber: raw.subscriber, porch, mailbox };
}

function checkOverlaps(lots: readonly Lot[]): void {
  for (const side of ['L', 'R'] as const) {
    const row = lots.filter((l) => l.side === side).sort((a, b) => a.s - b.s);
    for (let i = 1; i < row.length; i++) {
      if (row[i].s - row[i - 1].s < LOT_LENGTH) throw new StreetError(`street: lots ${row[i - 1].index} and ${row[i].index} overlap`);
    }
  }
}

function parseHazards(raw: unknown, length: number): { hazards: Hazard[]; dogHome: Vec2 } {
  if (!Array.isArray(raw)) throw new StreetError('street: hazards must be an array');
  const hazards: Hazard[] = [];
  const dogs: Vec2[] = [];
  raw.forEach((h, i) => {
    const f = `hazards[${i}]`;
    if (!isObj(h)) throw new StreetError(`street: ${f} must be an object`);
    if (h.kind === 'dog') dogs.push(point(h.home, `${f}.home`, length));
    else if (h.kind === 'car' || h.kind === 'puddle') hazards.push({ kind: h.kind, at: point(h.at, `${f}.at`, length) });
    else if (h.kind === 'sprinkler') hazards.push({ kind: 'sprinkler', at: point(h.at, `${f}.at`, length), spray: rect(h.spray, `${f}.spray`) });
    else throw new StreetError(`street: ${f}.kind must be car, puddle, sprinkler or dog`);
  });
  if (dogs.length !== 1) throw new StreetError(`street: needs exactly one dog (found ${dogs.length})`);
  return { hazards, dogHome: dogs[0] };
}

function parseProps(raw: unknown, length: number): Prop[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new StreetError('street: props must be an array');
  return raw.map((p, i) => {
    if (!isObj(p) || typeof p.kind !== 'string' || !NAME.test(p.kind)) throw new StreetError(`street: props[${i}].kind must be a sprite name`);
    return { kind: p.kind, at: point(p.at, `props[${i}].at`, length) };
  });
}

function parseBundles(raw: unknown, length: number): Vec2[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new StreetError('street: bundles must be an array');
  return raw.map((b, i) => point(b, `bundles[${i}]`, length));
}

/** Validates raw street JSON. Throws a StreetError naming the bad field. */
export function parseStreet(raw: unknown): Street {
  if (!isObj(raw)) throw new StreetError('street: must be an object');
  if (typeof raw.name !== 'string' || raw.name.length === 0) throw new StreetError('street: name must be a non-empty string');
  if (!isNum(raw.length) || raw.length < MIN_LENGTH) throw new StreetError(`street: length must be a number of at least ${MIN_LENGTH}`);
  const length = raw.length;
  if (!Array.isArray(raw.lots)) throw new StreetError('street: lots must be an array');
  const lots = raw.lots.map((l, i) => parseLot(l, i, length));
  checkOverlaps(lots);
  const { hazards, dogHome } = parseHazards(raw.hazards, length);
  return Object.freeze({
    name: raw.name, length, lots, props: parseProps(raw.props, length), hazards, dogHome, bundles: parseBundles(raw.bundles, length),
  });
}
