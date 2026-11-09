import type { Vec2 } from '../core/geometry';
import { newBike, type Bike, type Controls } from '../sim/bike';
import { CRASH, PAPERS, TOSS } from '../sim/constants';
import { newDog, type Dog } from '../sim/hazards';
import { throwPaper, type Paper } from '../sim/paper';
import type { Side, Street } from '../world/street';
import type { Delivery } from './score';
import { tick } from './tick';

export type Phase = 'title' | 'riding' | 'over';
export type Outcome = 'finished' | 'wiped';

export type GameEvent =
  | { readonly type: 'toss' }
  | { readonly type: 'dry' }
  | { readonly type: 'deliver'; readonly hit: Delivery; readonly lot: number; readonly points: number }
  | { readonly type: 'wrong'; readonly lot: number; readonly points: number }
  | { readonly type: 'thunk' }
  | { readonly type: 'land' }
  | { readonly type: 'treat'; readonly points: number }
  | { readonly type: 'pickup' }
  | { readonly type: 'splash' }
  | { readonly type: 'spray' }
  | { readonly type: 'bark' }
  | { readonly type: 'crash' }
  | { readonly type: 'finish'; readonly bonus: number }
  | { readonly type: 'wiped' };

export interface GameState {
  readonly phase: Phase;
  readonly paused: boolean;
  readonly outcome: Outcome | null;
  /** Seconds of riding this run (drives sprinklers). */
  readonly time: number;
  readonly bike: Bike;
  readonly helmets: number;
  readonly papers: number;
  readonly cooldown: number;
  readonly flying: readonly Paper[];
  /** Papers lying where they landed (porch or lawn). */
  readonly landed: readonly Vec2[];
  /** Lots already hit once (served or complained). */
  readonly hitLots: readonly number[];
  /** Subscriber deliveries. */
  readonly delivered: number;
  readonly throws: number;
  readonly dog: Dog;
  readonly bundlesTaken: readonly number[];
  readonly inPuddle: boolean;
  readonly inSpray: boolean;
  readonly score: number;
  /** Events since the last clearEvents (read by audio and HUD each frame). */
  readonly events: readonly GameEvent[];
}

export type Action =
  | { readonly type: 'start' }
  | { readonly type: 'restart' }
  | { readonly type: 'togglePause' }
  | { readonly type: 'toss'; readonly side: Side }
  | { readonly type: 'tick'; readonly dt: number; readonly controls: Controls };

export function newRun(street: Street, phase: Phase = 'riding'): GameState {
  return {
    phase, paused: false, outcome: null, time: 0, bike: newBike(), helmets: CRASH.helmets, papers: PAPERS.start,
    cooldown: 0, flying: [], landed: [], hitLots: [], delivered: 0, throws: 0, dog: newDog(street.dogHome),
    bundlesTaken: [], inPuddle: false, inSpray: false, score: 0, events: [],
  };
}

export const initialState = (street: Street): GameState => newRun(street, 'title');
export const isActive = (s: GameState): boolean => s.phase === 'riding' && !s.paused;
export const clearEvents = (s: GameState): GameState => (s.events.length === 0 ? s : { ...s, events: [] });
export const emit = (s: GameState, ...events: GameEvent[]): GameState => ({ ...s, events: [...s.events, ...events] });

function toss(s: GameState, side: Side): GameState {
  if (!isActive(s) || s.bike.wobble > 0 || s.cooldown > 0) return s;
  if (s.papers <= 0) return emit({ ...s, cooldown: TOSS.cooldown }, { type: 'dry' });
  return emit({
    ...s, papers: s.papers - 1, throws: s.throws + 1, cooldown: TOSS.cooldown, flying: [...s.flying, throwPaper(s.bike, side)],
  }, { type: 'toss' });
}

export function reduce(s: GameState, a: Action, street: Street): GameState {
  switch (a.type) {
    case 'start': return s.phase === 'riding' ? s : newRun(street);
    case 'restart': return s.phase === 'title' ? s : newRun(street);
    case 'togglePause': return s.phase === 'riding' ? { ...s, paused: !s.paused } : s;
    case 'toss': return toss(s, a.side);
    case 'tick': return isActive(s) ? tick(s, street, a.dt, a.controls) : s;
  }
}
