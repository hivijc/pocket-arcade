import type { Vec2 } from '../core/geometry';
import type { BallEvent } from '../physics/ball';
import type { Px } from './fences';

/**
 * Small pixel effects ("juice") driven by ball events and time. Everything here is pure: the main loop
 * keeps an `Effects` value, feeds it each physics step, and the renderer asks for pixels to plot.
 * All colours are Backyard palette entries, so they survive the post pass unchanged.
 */
export type EffectKind = 'cup' | 'splash' | 'spark' | 'dust';

/** Seconds each effect lasts. */
export const DURATION: Readonly<Record<EffectKind, number>> = { cup: 0.6, splash: 0.64, spark: 0.15, dust: 0.35 };
/** Frames of ball positions kept for the rolling trail. */
export const TRAIL_LENGTH = 8;

/** Grid position; z null means "on the ground there" (the renderer looks the height up). */
export type EffectAt = readonly [number, number, number | null];

export interface Effect {
  readonly kind: EffectKind;
  readonly at: EffectAt;
  /** Start time (seconds, the main loop's clock). */
  readonly t0: number;
  readonly seed: number;
}

export interface Effects {
  readonly list: readonly Effect[];
  /** Recent ball positions while rolling, newest first. */
  readonly trail: readonly (readonly [number, number, number])[];
  readonly nextSeed: number;
}

export const NO_EFFECTS: Effects = { list: [], trail: [], nextSeed: 1 };

export interface BallPos {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** The parts of a game state the effects read, before and after one physics step. */
export interface StepSnapshot {
  readonly ball: BallPos;
  readonly events: readonly BallEvent[];
}

const C = {
  white: '#fffaf0', cream: '#efe6d2', gold: '#f2c25b', sand: '#d9c08c', dirt: '#b08a62',
  foam: '#9fd8ee', water: '#5aa7d0', trail: '#8fca6c',
} as const;

function effectFor(ev: BallEvent, prev: StepSnapshot, next: StepSnapshot, cup: Vec2): Omit<Effect, 't0' | 'seed'> | null {
  const b = next.ball;
  switch (ev) {
    case 'wall': return { kind: 'spark', at: [b.x, b.y, b.z] };
    case 'land': return { kind: 'dust', at: [b.x, b.y, null] };
    // The state has already reset the ball to its last rest; the splash belongs where it went in.
    case 'water': return { kind: 'splash', at: [prev.ball.x, prev.ball.y, null] };
    case 'holed': return { kind: 'cup', at: [cup[0], cup[1], null] };
    default: return null;
  }
}

/** Adds an effect for each new event this step raised (events accumulate within a frame). */
export function spawnEffects(fx: Effects, prev: StepSnapshot, next: StepSnapshot, cup: Vec2, time: number): Effects {
  const fresh = new Set(next.events.slice(prev.events.length));
  if (fresh.size === 0) return fx;
  const made = [...fresh].flatMap((ev) => effectFor(ev, prev, next, cup) ?? []);
  if (made.length === 0) return fx;
  const added = made.map((e, i) => ({ ...e, t0: time, seed: fx.nextSeed + i }));
  return { ...fx, list: [...fx.list, ...added], nextSeed: fx.nextSeed + added.length };
}

/** Drops effects that have finished by `time`. */
export function prune(fx: Effects, time: number): Effects {
  const live = fx.list.filter((e) => time - e.t0 <= DURATION[e.kind]);
  return live.length === fx.list.length ? fx : { ...fx, list: live };
}

/** Keeps the last few ball positions while rolling; clears them otherwise. */
export function trackTrail(fx: Effects, ball: BallPos, rolling: boolean): Effects {
  if (!rolling) return fx.trail.length === 0 ? fx : { ...fx, trail: [] };
  return { ...fx, trail: [[ball.x, ball.y, ball.z] as const, ...fx.trail].slice(0, TRAIL_LENGTH) };
}

/** Deterministic 0..1 noise for particle i of an effect. */
function rand(seed: number, i: number): number {
  const s = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

const px = (ox: number, oy: number, dx: number, dy: number, color: string): Px =>
  ({ x: Math.round(ox + dx), y: Math.round(oy + dy), color });

/** An iso ellipse (half as tall as wide) of radius r, as unique whole-pixel offsets. */
function ring(r: number): Vec2[] {
  const n = Math.max(6, Math.round(r * 5));
  const seen = new Map<string, Vec2>();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p: Vec2 = [Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * 0.5)];
    seen.set(`${p[0]},${p[1]}`, p);
  }
  return [...seen.values()];
}

const SPLASH_RINGS = 3, SPLASH_GAP = 0.12, SPLASH_LIFE = 0.4, SPLASH_GROW = 6;

const DROPLET_SECONDS = 0.28;
const DROPLETS: readonly Vec2[] = [[-2, 4], [0, 6], [2, 4]];

/** Expanding rings (white, then foam, so they read on light and dark water) and a few droplets thrown up. */
function splash(age: number, sx: number, sy: number): Px[] {
  const rings = Array.from({ length: SPLASH_RINGS }, (_, k) => age - k * SPLASH_GAP).flatMap((a) => {
    if (a < 0 || a > SPLASH_LIFE) return [];
    const u = a / SPLASH_LIFE;
    const color = u < 0.45 ? C.white : C.foam;
    return ring(1 + u * SPLASH_GROW).map(([dx, dy]) => px(sx, sy, dx, dy, color));
  });
  if (age > DROPLET_SECONDS) return rings;
  const lift = Math.sin((Math.PI * age) / DROPLET_SECONDS);
  const drops = DROPLETS.map(([dx, h]) => px(sx, sy, dx * (0.5 + age / DROPLET_SECONDS), -h * lift, C.white));
  return [...rings, ...drops];
}

function cupBurst(age: number, seed: number, sx: number, sy: number): Px[] {
  const u = age / DURATION.cup;
  const r = 1 + u * 4;
  const ringPx = u < 0.7
    ? ring(r).filter((_, i) => u < 0.4 || i % 2 === 0).map(([dx, dy]) => px(sx, sy, dx, dy, u < 0.4 ? C.white : C.cream))
    : [];
  const puffs = Array.from({ length: 4 }, (_, i) => {
    const a = (i / 4) * Math.PI * 2 + rand(seed, i);
    return px(sx, sy, Math.cos(a) * (1 + u * 2), -1 - u * 6 + Math.sin(a), C.gold);
  }).filter((_, i) => u < 0.8 || i % 2 === 0);
  return [...ringPx, ...puffs];
}

function spark(age: number, seed: number, sx: number, sy: number): Px[] {
  const reach = age < DURATION.spark / 2 ? 1 : 2;
  const a = rand(seed, 0) * Math.PI * 2;
  const tips = [a, a + Math.PI * (0.6 + rand(seed, 1) * 0.8)].map((t) =>
    px(sx, sy, Math.round(Math.cos(t) * reach), Math.round(Math.sin(t) * reach), C.gold));
  return age < DURATION.spark / 2 ? [px(sx, sy, 0, -1, C.white), ...tips] : tips;
}

const DUST_MOTES = 5;

function dust(age: number, seed: number, sx: number, sy: number): Px[] {
  const u = age / DURATION.dust;
  const alive = Math.ceil(DUST_MOTES * (1 - u * 0.8));
  return Array.from({ length: alive }, (_, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const spread = 1 + u * (2 + rand(seed, i) * 2);
    const hop = -Math.sin(Math.PI * u) * (1 + rand(seed, i + 9) * 2);
    return px(sx, sy, side * spread, hop, u < 0.5 ? C.sand : C.dirt);
  });
}

/** The pixels effect `e` shows at `time`, around its on-screen origin (sx, sy). */
export function effectPixels(e: Effect, time: number, sx: number, sy: number): Px[] {
  const age = time - e.t0;
  if (age < 0 || age > DURATION[e.kind]) return [];
  switch (e.kind) {
    case 'splash': return splash(age, sx, sy);
    case 'cup': return cupBurst(age, e.seed, sx, sy);
    case 'spark': return spark(age, e.seed, sx, sy);
    case 'dust': return dust(age, e.seed, sx, sy);
  }
}

const WIGGLE_SECONDS = 0.4;

/** The flag's horizontal pixel offset (-1, 0 or 1): a brief wiggle after the ball drops in. */
export function flagWiggle(fx: Effects, time: number): number {
  const cup = [...fx.list].reverse().find((e) => e.kind === 'cup');
  if (!cup) return 0;
  const age = time - cup.t0;
  if (age < 0 || age > WIGGLE_SECONDS) return 0;
  return Math.round(Math.sin(age * 40) * (1 - age / WIGGLE_SECONDS) * 1.4) || 0;
}

/** A faint dotted trail: every other recent on-screen ball position, skipping the ball's own pixel. */
export function trailPixels(points: readonly Vec2[], ball: Vec2): Px[] {
  const bx = Math.round(ball[0]), by = Math.round(ball[1]);
  return points.flatMap((p, i) => {
    const x = Math.round(p[0]), y = Math.round(p[1]);
    return i >= 2 && i % 2 === 0 && (x !== bx || y !== by) ? [{ x, y, color: C.trail }] : [];
  });
}
