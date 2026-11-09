import type { Vec2 } from '../core/geometry';
import { hash2 } from '../core/hash';
import { AIR, GATE, HAZARD_R, RUN, SLOPE } from '../sim/constants';

export const HAZARD_KINDS = ['pine', 'rock-s', 'rock-l', 'snowman'] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];
export const RIDER_LOOKS = ['skier-red', 'skier-green', 'boarder-purple'] as const;
export type RiderLook = (typeof RIDER_LOOKS)[number];
const SURFACE_KINDS = ['packed', 'shade'] as const;
export type SurfaceKind = (typeof SURFACE_KINDS)[number];
const GATE_COLORS = ['blue', 'red'] as const;
export type GateColor = (typeof GATE_COLORS)[number];

export interface Rect { readonly c0: number; readonly d0: number; readonly c1: number; readonly d1: number }
export interface Surface { readonly kind: SurfaceKind; readonly rect: Rect }
export interface Gate { readonly d: number; readonly c: readonly [number, number]; readonly color: GateColor }
export interface Ramp { readonly d: number; readonly c: number }
export interface Hazard { readonly kind: HazardKind; readonly at: Vec2 }
export interface OtherRider { readonly look: RiderLook; readonly speed: number; readonly path: readonly Vec2[] }

export interface Slope {
  readonly name: string;
  readonly length: number;
  readonly finish: number;
  readonly par: number;
  readonly surfaces: readonly Surface[];
  readonly gates: readonly Gate[];
  readonly ramps: readonly Ramp[];
  readonly hazards: readonly Hazard[];
  readonly riders: readonly OtherRider[];
  readonly flakes: readonly Vec2[];
}

export class SlopeError extends Error {}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function fail(msg: string): never {
  throw new SlopeError(`slope: ${msg}`);
}

function point(v: unknown, field: string, length: number): Vec2 {
  if (!Array.isArray(v) || v.length !== 2 || !v.every(isNum)) fail(`${field} must be [c, d]`);
  const [c, d] = v as number[];
  if (c < 0 || c > SLOPE.width || d < 0 || d > length) fail(`${field} [${c}, ${d}] is off the slope`);
  return [c, d];
}

function list(raw: Obj, key: string): unknown[] {
  const v = raw[key] ?? [];
  if (!Array.isArray(v)) fail(`${key} must be an array`);
  return v as unknown[];
}

function oneOf<T extends string>(v: unknown, options: readonly T[], field: string): T {
  if (typeof v !== 'string' || !options.includes(v as T)) fail(`${field} must be one of ${options.join(', ')}`);
  return v as T;
}

function obj(v: unknown, field: string): Obj {
  if (!isObj(v)) fail(`${field} must be an object`);
  return v as Obj;
}

function parseRect(v: unknown, field: string, length: number): Rect {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(isNum)) fail(`${field} must be [c0, d0, w, h]`);
  const [c0, d0, w, h] = v as number[];
  if (w <= 0 || h <= 0) fail(`${field} needs a positive size`);
  point([c0, d0], field, length);
  point([c0 + w, d0 + h], field, length);
  return { c0, d0, c1: c0 + w, d1: d0 + h };
}

function parseSurface(v: unknown, i: number, length: number): Surface {
  const f = `surfaces[${i}]`;
  const o = obj(v, f);
  return { kind: oneOf(o.kind, SURFACE_KINDS, `${f}.kind`), rect: parseRect(o.rect, `${f}.rect`, length) };
}

function parseGate(v: unknown, i: number, length: number): Gate {
  const f = `gates[${i}]`;
  const o = obj(v, f);
  if (!isNum(o.d)) fail(`${f} needs d`);
  if (!Array.isArray(o.c) || o.c.length !== 2 || !o.c.every(isNum)) fail(`${f}.c must be the two flag positions`);
  const [a, b] = o.c as number[];
  point([a, o.d as number], f, length);
  point([b, o.d as number], f, length);
  const gap = Math.abs(b - a);
  if (gap < GATE.minGap || gap > GATE.maxGap) fail(`${f} flags must be ${GATE.minGap}–${GATE.maxGap} tiles apart`);
  return { d: o.d as number, c: [Math.min(a, b), Math.max(a, b)], color: oneOf(o.color, GATE_COLORS, `${f}.color`) };
}

function parseRamp(v: unknown, i: number, length: number): Ramp {
  const f = `ramps[${i}]`;
  const o = obj(v, f);
  const [c, d] = point([o.c, o.d], f, length);
  if (d + AIR.rampLen > length) fail(`${f} runs off the end of the slope`);
  return { c, d };
}

function parseHazard(v: unknown, i: number, length: number): Hazard {
  const f = `hazards[${i}]`;
  const o = obj(v, f);
  return { kind: oneOf(o.kind, HAZARD_KINDS, `${f}.kind`), at: point(o.at, `${f}.at`, length) };
}

function parseRider(v: unknown, i: number, length: number): OtherRider {
  const f = `riders[${i}]`;
  const o = obj(v, f);
  if (!isNum(o.speed) || (o.speed as number) <= 0) fail(`${f} needs a positive speed`);
  const look = oneOf(o.look, RIDER_LOOKS, `${f}.look`);
  const raw = Array.isArray(o.path) ? o.path : [];
  if (raw.length < 2) fail(`${f}.path needs at least 2 points`);
  const path = raw.map((p, j) => point(p, `${f}.path[${j}]`, length));
  path.slice(1).forEach((p, j) => {
    if (p[1] <= path[j][1]) fail(`${f}.path must run downhill (increasing d)`);
  });
  return { look, speed: o.speed as number, path };
}

function checkGateOrder(gates: readonly Gate[]): void {
  gates.slice(1).forEach((g, i) => {
    if (g.d <= gates[i].d) fail(`gates[${i + 1}] must come after gates[${i}] (increasing d)`);
  });
}

const onRamp = (r: Ramp, [c, d]: Vec2, pad: number): boolean =>
  Math.abs(c - r.c) <= AIR.rampHalfWidth + pad && d >= r.d - pad && d <= r.d + AIR.rampLen + pad;
const inGate = (g: Gate, [c, d]: Vec2): boolean => Math.abs(d - g.d) < 0.6 && c > g.c[0] && c < g.c[1];

function checkHazards(s: Slope): void {
  s.hazards.forEach((h, i) => {
    const f = `hazards[${i}] (${h.kind})`;
    if (h.at[1] < RUN.safeStart) fail(`${f} is within the start area (d < ${RUN.safeStart})`);
    const r = s.ramps.findIndex((ramp) => onRamp(ramp, h.at, HAZARD_R[h.kind]));
    if (r >= 0) fail(`${f} sits on ramps[${r}]`);
    const g = s.gates.findIndex((gate) => inGate(gate, h.at));
    if (g >= 0) fail(`${f} sits inside gates[${g}]`);
  });
}

const BORDER = { from: 6, step: 1.6, density: 0.7 } as const;

/** Seeded pines along both powder edges (0.5–1.5 and 14.5–15.5 across), so the edges never need listing by hand. */
export function borderPines(length: number): Hazard[] {
  const rows = Math.ceil((length - BORDER.from) / BORDER.step);
  return Array.from({ length: rows }, (_, i) => i).flatMap((i) =>
    [0, 1].flatMap((side): Hazard[] => {
      if (hash2(i, side, 41) > BORDER.density) return [];
      const c = side === 0 ? 0.5 + hash2(i, side, 42) : SLOPE.width - 1.5 + hash2(i, side, 42);
      const d = BORDER.from + i * BORDER.step + hash2(i, side, 43) * 0.8;
      return d < length ? [{ kind: 'pine', at: [c, d] }] : [];
    }),
  );
}

export interface ParseOptions {
  /** Add the seeded border pines (default true). */
  readonly borders?: boolean;
}

export function parseSlope(raw: unknown, opts: ParseOptions = {}): Slope {
  const o = obj(raw, 'the slope');
  if (typeof o.name !== 'string' || o.name === '') fail('name must be a non-empty string');
  if (!Number.isInteger(o.length) || (o.length as number) < 50) fail('length must be a whole number of at least 50');
  const length = o.length as number;
  if (!isNum(o.finish) || (o.finish as number) < 20 || (o.finish as number) >= length) fail('finish must be between 20 and length');
  if (!isNum(o.par) || (o.par as number) <= 0) fail('par must be positive');
  const gates = list(o, 'gates').map((v, i) => parseGate(v, i, length));
  checkGateOrder(gates);
  const slope: Slope = {
    name: o.name as string,
    length,
    finish: o.finish as number,
    par: o.par as number,
    surfaces: list(o, 'surfaces').map((v, i) => parseSurface(v, i, length)),
    gates,
    ramps: list(o, 'ramps').map((v, i) => parseRamp(v, i, length)),
    hazards: list(o, 'hazards').map((v, i) => parseHazard(v, i, length)),
    riders: list(o, 'riders').map((v, i) => parseRider(v, i, length)),
    flakes: list(o, 'flakes').map((v, i) => point(v, `flakes[${i}]`, length)),
  };
  checkHazards(slope);
  return opts.borders === false ? slope : { ...slope, hazards: [...slope.hazards, ...borderPines(length)] };
}
