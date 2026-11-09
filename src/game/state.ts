import type { Hole, Vec2 } from '../world/hole';
import { isMoving, restingBall, step, strike, type Ball, type BallEvent } from '../physics/ball';
import { MAX_SIM_SECONDS } from '../physics/constants';
import { STROKE_CAP, scoreLabel } from './score';

export const INTRO_SECONDS = 1.5;
export const HOLED_SECONDS = 1.5;
export const CHARGE_PERIOD = 2;

export type Phase =
  | { readonly kind: 'title' }
  | { readonly kind: 'intro'; readonly t: number }
  | { readonly kind: 'aiming' }
  | { readonly kind: 'charging'; readonly t: number }
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
  /** Aim angle in radians, in grid space. */
  readonly aim: number;
  /** Ball events from the latest update (for sounds and effects). */
  readonly events: readonly BallEvent[];
}

export type Action =
  | { readonly type: 'start' }
  | { readonly type: 'aim'; readonly angle: number }
  | { readonly type: 'press' }
  | { readonly type: 'release' }
  | { readonly type: 'retry' }
  | { readonly type: 'putt'; readonly angle: number; readonly power: number };

/** Power 0..1 after charging for t seconds: rises to 1, falls back to 0, repeats. */
export function chargePower(t: number): number {
  const half = CHARGE_PERIOD / 2;
  const m = ((t % CHARGE_PERIOD) + CHARGE_PERIOD) % CHARGE_PERIOD;
  return m <= half ? m / half : (CHARGE_PERIOD - m) / half;
}

const atTee = (hole: Hole): Ball => restingBall(hole, hole.tee);
const current = (s: GameState): number => s.strokes[s.holeIndex];
const withStrokes = (s: GameState, n: number): GameState => ({
  ...s,
  strokes: s.strokes.map((v, i) => (i === s.holeIndex ? n : v)),
});

export function initialState(holes: readonly Hole[]): GameState {
  const first = holes[0];
  return { phase: { kind: 'title' }, holeIndex: 0, strokes: [0], ball: atTee(first), lastRest: first.tee, aim: 0, events: [] };
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

export function reduce(s: GameState, a: Action, holes: readonly Hole[]): GameState {
  const p = s.phase;
  switch (a.type) {
    case 'start':
      return newGame(holes);
    case 'aim':
      return { ...s, aim: a.angle };
    case 'press':
      if (p.kind === 'title' || p.kind === 'scorecard') return newGame(holes);
      return p.kind === 'aiming' ? { ...s, phase: { kind: 'charging', t: 0 } } : s;
    case 'release':
      return p.kind === 'charging' ? shoot(s, s.aim, chargePower(p.t), holes) : s;
    case 'putt':
      return p.kind === 'aiming' ? shoot(s, a.angle, a.power, holes) : s;
    case 'retry': {
      if (p.kind !== 'aiming' && p.kind !== 'charging') return s;
      const hole = holes[s.holeIndex];
      return ready({ ...withStrokes(s, current(s) + 1), ball: atTee(hole), lastRest: hole.tee }, holes);
    }
  }
}

function advance(s: GameState, holes: readonly Hole[]): GameState {
  const next = s.holeIndex + 1;
  if (next >= holes.length) return { ...s, phase: { kind: 'scorecard' } };
  const hole = holes[next];
  return { ...s, holeIndex: next, strokes: [...s.strokes, 0], ball: atTee(hole), lastRest: hole.tee, phase: { kind: 'intro', t: 0 } };
}

function roll(s: GameState, t: number, dt: number, holes: readonly Hole[]): GameState {
  const hole = holes[s.holeIndex];
  const r = step(s.ball, hole, dt);
  const moved: GameState = { ...s, ball: r.ball, events: r.events, phase: { kind: 'rolling', t } };
  if (r.events.includes('holed')) return finishHole(moved, holes);
  if (r.events.includes('water')) {
    return ready({ ...withStrokes(moved, current(moved) + 1), ball: restingBall(hole, moved.lastRest) }, holes);
  }
  if (r.events.includes('stopped') || !isMoving(r.ball)) return ready(moved, holes);
  if (t > MAX_SIM_SECONDS) return ready({ ...moved, ball: { ...r.ball, vx: 0, vy: 0, vz: 0, airborne: false } }, holes);
  return moved;
}

/** Advance time by dt seconds. The main loop calls this with the fixed physics step. */
export function update(s: GameState, dt: number, holes: readonly Hole[]): GameState {
  const base = s.events.length > 0 ? { ...s, events: [] } : s;
  const p = base.phase;
  switch (p.kind) {
    case 'intro':
      return { ...base, phase: p.t + dt >= INTRO_SECONDS ? { kind: 'aiming' } : { kind: 'intro', t: p.t + dt } };
    case 'charging':
      return { ...base, phase: { kind: 'charging', t: p.t + dt } };
    case 'holed':
      return p.t + dt >= HOLED_SECONDS ? advance(base, holes) : { ...base, phase: { ...p, t: p.t + dt } };
    case 'rolling':
      return roll(base, p.t + dt, dt, holes);
    default:
      return base;
  }
}
