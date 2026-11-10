import { ollie } from '../sim/air';
import { newBoard, travel, turnHeading, type Board, type Controls } from '../sim/board';
import { RUN } from '../sim/constants';
import { NO_GATES, type GateProgress } from '../sim/gates';
import type { Trick } from '../sim/tricks';
import type { Slope } from '../world/slope';
import { emit, type GameEvent } from './events';
import { tick } from './tick';

export type { GameEvent } from './events';

export type Phase = 'title' | 'countdown' | 'riding' | 'runout' | 'over';

export interface GameState {
  readonly phase: Phase;
  readonly paused: boolean;
  /** Seconds left in the countdown or the finish run-out. */
  readonly clock: number;
  /** The run clock: seconds since "go", frozen at the finish line. */
  readonly time: number;
  readonly board: Board;
  readonly gates: GateProgress;
  /** Indices of snowflakes collected. */
  readonly flakes: readonly number[];
  /** Per other rider: the run time it woke, or null. */
  readonly riders: readonly (number | null)[];
  /** Indices of snowmen burst (no longer hazards). */
  readonly burst: readonly number[];
  readonly score: number;
  readonly tricks: number;
  readonly bestTrick: Trick | null;
  readonly crashes: number;
  readonly finishTime: number | null;
  readonly bonus: number;
  /** Events since the last clearEvents (read by audio, particles and HUD each frame). */
  readonly events: readonly GameEvent[];
}

export type Action =
  | { readonly type: 'start' }
  | { readonly type: 'restart' }
  | { readonly type: 'togglePause' }
  | { readonly type: 'jump' }
  | { readonly type: 'tick'; readonly dt: number; readonly controls: Controls };

export function newRun(slope: Slope): GameState {
  return {
    phase: 'countdown', paused: false, clock: RUN.countdown, time: 0, board: newBoard(RUN.startC, RUN.startD),
    gates: NO_GATES, flakes: [], riders: slope.riders.map(() => null), burst: [], score: 0, tricks: 0, bestTrick: null,
    crashes: 0, finishTime: null, bonus: 0, events: [{ type: 'beep', n: RUN.countdown }],
  };
}

export const initialState = (slope: Slope): GameState => ({ ...newRun(slope), phase: 'title', events: [] });
export const clearEvents = (s: GameState): GameState => (s.events.length === 0 ? s : { ...s, events: [] });

const PAUSABLE: readonly Phase[] = ['countdown', 'riding', 'runout'];

function stepCountdown(s: GameState, dt: number): GameState {
  const clock = s.clock - dt;
  if (clock <= 0) return emit({ ...s, phase: 'riding', clock: 0 }, { type: 'go' });
  const next = { ...s, clock };
  return Math.ceil(clock) < Math.ceil(s.clock) ? emit(next, { type: 'beep', n: Math.ceil(clock) }) : next;
}

/** After the line: straighten, brake to a stop, then the end card. */
function stepRunout(s: GameState, dt: number): GameState {
  const b = s.board;
  const slowed = { ...b, heading: turnHeading(b.heading, 0, dt), speed: Math.max(0, b.speed - RUN.runoutBrake * dt) };
  const board = { ...slowed, ...travel(slowed, dt) };
  const clock = s.clock - dt;
  return clock <= 0 ? { ...s, board, clock: 0, phase: 'over' } : { ...s, board, clock };
}

function jump(s: GameState, slope: Slope): GameState {
  if (s.phase === 'title' || s.phase === 'over') return newRun(slope);
  if (s.phase !== 'riding' || s.paused) return s;
  if (s.board.air === null && s.board.z > 0) return s; // rising up a kicker: let it launch
  const board = ollie(s.board);
  return board === s.board ? s : emit({ ...s, board }, { type: 'ollie' });
}

export function reduce(s: GameState, a: Action, slope: Slope): GameState {
  switch (a.type) {
    case 'start': return s.phase === 'title' || s.phase === 'over' ? newRun(slope) : s;
    case 'restart': return s.phase === 'title' ? s : newRun(slope);
    case 'togglePause': return PAUSABLE.includes(s.phase) ? { ...s, paused: !s.paused } : s;
    case 'jump': return jump(s, slope);
    case 'tick':
      if (s.paused) return s;
      if (s.phase === 'countdown') return stepCountdown(s, a.dt);
      if (s.phase === 'riding') return tick(s, slope, a.controls, a.dt);
      if (s.phase === 'runout') return stepRunout(s, a.dt);
      return s;
  }
}
