import type { Hole, Vec2 } from '../world/hole';
import { isMoving, restingBall, step, strike, type Ball, type BallEvent } from '../physics/ball';
import { MAX_SIM_SECONDS, STEP } from '../physics/constants';
import { STROKE_CAP, scoreLabel } from './score';

export const INTRO_SECONDS = 1.5;
export const HOLED_SECONDS = 1.5;
export const CHARGE_PERIOD = 2;
/** Most physics steps one update may run (a 0.1 s frame at 120 Hz). */
const MAX_ROLL_SUBSTEPS = 12;

export type Phase =
  | { readonly kind: 'title' }
  | { readonly kind: 'intro'; readonly t: number }
  | { readonly kind: 'aiming' }
  | { readonly kind: 'charging'; readonly t: number }
  /** Touch slingshot in progress: the aim is `GameState.aim` and power comes from the drag length. */
  | { readonly kind: 'dragging'; readonly power: number }
  | { readonly kind: 'rolling'; readonly t: number }
  | { readonly kind: 'holed'; readonly t: number; readonly label: string }
  | { readonly kind: 'scorecard' };

export interface GameState {
  readonly phase: Phase;
  readonly holeIndex: number;
  /** Strokes per hole played so far; the current hole is `strokes[holeIndex]`. */
  readonly strokes: readonly number[];
  readonly ball: Ball;
  /** Where the ball was last struck from (water resets here). */
  readonly lastRest: Vec2;
  /** Aim angle in radians, in grid space (used when there is no cursor point). */
  readonly aim: number;
  /** The grid point under the cursor; the aim is re-derived from the ball's current position. */
  readonly aimPoint: Vec2 | null;
  /** Ball events since the last clearEvents (for sounds and effects); the main loop clears them once per frame. */
  readonly events: readonly BallEvent[];
  /** True while the pause menu is open: time stands still and only pause/resume/start are handled. */
  readonly paused: boolean;
}

export type Action =
  | { readonly type: 'start' }
  | { readonly type: 'aim'; readonly angle: number }
  | { readonly type: 'aimAt'; readonly point: Vec2 }
  | { readonly type: 'press' }
  | { readonly type: 'release' }
  | { readonly type: 'retry' }
  | { readonly type: 'togglePause' }
  | { readonly type: 'resume' }
  /** Drop an in-progress charge (e.g. the window lost focus before the release arrived). */
  | { readonly type: 'cancel' }
  | { readonly type: 'putt'; readonly angle: number; readonly power: number }
  /** Touch slingshot preview: aim and power from the current drag; `release` then putts with them. */
  | { readonly type: 'drag'; readonly angle: number; readonly power: number };

/** Power 0..1 after charging for t seconds: rises to 1, falls back to 0, repeats. */
export function chargePower(t: number): number {
  const half = CHARGE_PERIOD / 2;
  const m = ((t % CHARGE_PERIOD) + CHARGE_PERIOD) % CHARGE_PERIOD;
  return m <= half ? m / half : (CHARGE_PERIOD - m) / half;
}

/** The aim angle: from the ball toward the cursor point when there is one, else the stored angle. */
export function aimAngle(s: GameState): number {
  if (!s.aimPoint) return s.aim;
  const dx = s.aimPoint[0] - s.ball.x, dy = s.aimPoint[1] - s.ball.y;
  return dx === 0 && dy === 0 ? s.aim : Math.atan2(dy, dx);
}

const atTee = (hole: Hole): Ball => restingBall(hole, hole.tee);
const current = (s: GameState): number => s.strokes[s.holeIndex];
const withStrokes = (s: GameState, n: number): GameState => ({
  ...s,
  strokes: s.strokes.map((v, i) => (i === s.holeIndex ? n : v)),
});

export function initialState(holes: readonly Hole[]): GameState {
  const first = holes[0];
  return { phase: { kind: 'title' }, holeIndex: 0, strokes: [0], ball: atTee(first), lastRest: first.tee, aim: 0, aimPoint: null, events: [], paused: false };
}

function newGame(holes: readonly Hole[]): GameState {
  return { ...initialState(holes), phase: { kind: 'intro', t: 0 } };
}

function finishHole(s: GameState, holes: readonly Hole[]): GameState {
  const strokes = Math.min(current(s), STROKE_CAP);
  return { ...withStrokes(s, strokes), phase: { kind: 'holed', t: 0, label: scoreLabel(strokes, holes[s.holeIndex].par) } };
}

/** Back to aiming, unless the stroke cap has been reached. */
function ready(s: GameState, holes: readonly Hole[]): GameState {
  return current(s) >= STROKE_CAP ? finishHole(s, holes) : { ...s, phase: { kind: 'aiming' } };
}

function shoot(s: GameState, angle: number, power: number, holes: readonly Hole[]): GameState {
  return {
    ...withStrokes(s, current(s) + 1),
    ball: strike(s.ball, holes[s.holeIndex], angle, power),
    lastRest: [s.ball.x, s.ball.y],
    aim: angle,
    phase: { kind: 'rolling', t: 0 },
  };
}

/** Charging or dragging falls back to aiming; any other phase is kept. */
function uncharge(s: GameState): GameState {
  const k = s.phase.kind;
  return k === 'charging' || k === 'dragging' ? { ...s, phase: { kind: 'aiming' } } : s;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function drag(s: GameState, angle: number, power: number): GameState {
  const k = s.phase.kind;
  if (k !== 'aiming' && k !== 'dragging') return s;
  return { ...s, aim: angle, aimPoint: null, phase: { kind: 'dragging', power: clamp01(power) } };
}

function release(s: GameState, holes: readonly Hole[]): GameState {
  const p = s.phase;
  if (p.kind === 'charging') return shoot(s, aimAngle(s), chargePower(p.t), holes);
  if (p.kind === 'dragging') return shoot(s, s.aim, p.power, holes);
  return s;
}

function togglePause(s: GameState): GameState {
  const k = s.phase.kind;
  if (k === 'title' || k === 'scorecard') return s;
  return s.paused ? { ...s, paused: false } : { ...uncharge(s), paused: true };
}

export function reduce(s: GameState, a: Action, holes: readonly Hole[]): GameState {
  if (a.type === 'start') return newGame(holes);
  if (a.type === 'togglePause') return togglePause(s);
  if (a.type === 'resume') return s.paused ? { ...s, paused: false } : s;
  return s.paused ? s : play(s, a, holes);
}

type PlayAction = Exclude<Action, { readonly type: 'start' | 'togglePause' | 'resume' }>;

function play(s: GameState, a: PlayAction, holes: readonly Hole[]): GameState {
  const p = s.phase;
  switch (a.type) {
    case 'cancel':
      return uncharge(s);
    case 'aim':
      return { ...s, aim: a.angle, aimPoint: null };
    case 'aimAt':
      return p.kind === 'dragging' ? s : { ...s, aimPoint: a.point };
    case 'drag':
      return drag(s, a.angle, a.power);
    case 'press':
      if (p.kind === 'title' || p.kind === 'scorecard') return newGame(holes);
      return p.kind === 'aiming' ? { ...s, phase: { kind: 'charging', t: 0 } } : s;
    case 'release':
      return release(s, holes);
    case 'putt':
      return p.kind === 'aiming' ? shoot(s, a.angle, a.power, holes) : s;
    case 'retry': {
      if (p.kind !== 'aiming' && p.kind !== 'charging' && p.kind !== 'dragging') return s;
      const hole = holes[s.holeIndex];
      return ready({ ...withStrokes(s, current(s) + 1), ball: atTee(hole), lastRest: hole.tee }, holes);
    }
  }
}

function advance(s: GameState, holes: readonly Hole[]): GameState {
  const next = s.holeIndex + 1;
  if (next >= holes.length) return { ...s, phase: { kind: 'scorecard' } };
  const hole = holes[next];
  return { ...s, holeIndex: next, strokes: [...s.strokes, 0], ball: atTee(hole), lastRest: hole.tee, aimPoint: null, phase: { kind: 'intro', t: 0 } };
}

/** One fixed physics step of a rolling ball, at rolling time t. */
function rollStep(s: GameState, t: number, holes: readonly Hole[]): GameState {
  const hole = holes[s.holeIndex];
  const r = step(s.ball, hole, STEP);
  const events = r.events.length > 0 ? [...s.events, ...r.events] : s.events;
  const moved: GameState = { ...s, ball: r.ball, events, phase: { kind: 'rolling', t } };
  if (r.events.includes('holed')) return finishHole(moved, holes);
  if (r.events.includes('water')) {
    return ready({ ...withStrokes(moved, current(moved) + 1), ball: restingBall(hole, moved.lastRest) }, holes);
  }
  if (r.events.includes('stopped') || !isMoving(r.ball)) return ready(moved, holes);
  if (t > MAX_SIM_SECONDS) return ready({ ...moved, ball: restingBall(hole, [r.ball.x, r.ball.y]) }, holes);
  return moved;
}

/** Advances a rolling ball by dt in whole fixed steps (at least one), stopping early once the shot ends. */
function roll(s: GameState, t0: number, dt: number, holes: readonly Hole[]): GameState {
  const n = Math.max(1, Math.min(MAX_ROLL_SUBSTEPS, Math.round(dt / STEP)));
  let cur = s;
  for (let i = 1; i <= n && cur.phase.kind === 'rolling'; i++) cur = rollStep(cur, t0 + (dt * i) / n, holes);
  return cur;
}

/** Drops the accumulated ball events (returns the same state when there are none). */
export function clearEvents(s: GameState): GameState {
  return s.events.length > 0 ? { ...s, events: [] } : s;
}

/** Advance time by dt seconds. The main loop calls this with the fixed physics step; physics always steps at STEP. */
export function update(s: GameState, dt: number, holes: readonly Hole[]): GameState {
  if (s.paused || !(dt > 0)) return s; // dt 0, negative or NaN: time hasn't moved
  const p = s.phase;
  switch (p.kind) {
    case 'intro':
      return { ...s, phase: p.t + dt >= INTRO_SECONDS ? { kind: 'aiming' } : { kind: 'intro', t: p.t + dt } };
    case 'charging':
      return { ...s, phase: { kind: 'charging', t: p.t + dt } };
    case 'holed':
      return p.t + dt >= HOLED_SECONDS ? advance(s, holes) : { ...s, phase: { ...p, t: p.t + dt } };
    case 'rolling':
      return roll(s, p.t, dt, holes);
    default:
      return s;
  }
}
