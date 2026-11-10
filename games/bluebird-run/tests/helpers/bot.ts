import type { Vec2 } from '../../src/core/geometry';
import { initialState, reduce, type GameState } from '../../src/game/state';
import type { Controls } from '../../src/sim/board';
import { STEP } from '../../src/sim/constants';
import { riderPos } from '../../src/sim/hazards';
import type { Slope } from '../../src/world/slope';

export type Bot = (s: GameState, slope: Slope) => Controls;

const LANES = Array.from({ length: 21 }, (_, i) => 3 + i * 0.5); // c 3 … 13
const LOOK = 10; // tiles ahead

function obstacles(s: GameState, slope: Slope): Vec2[] {
  const { d } = s.board;
  const near = (p: Vec2) => p[1] > d - 0.5 && p[1] < d + LOOK;
  const fixed = slope.hazards.filter((h, i) => !s.burst.includes(i) && near(h.at)).map((h) => h.at);
  const moving = slope.riders.flatMap((r, i) => {
    const p = riderPos(r, s.riders[i] ?? null, s.time);
    return p && near([p.c, p.d]) ? [[p.c, p.d] as Vec2] : [];
  });
  return [...fixed, ...moving];
}

const laneCost = (lane: number, c: number, d: number, obs: readonly Vec2[]): number =>
  obs.reduce((n, o) => n + (Math.abs(o[0] - lane) < 1.3 ? 10 / (1 + Math.max(0, o[1] - d)) : 0), Math.abs(lane - c) * 0.15);

/** Picks the clearest lane within the look-ahead and steers toward it: a careful, average player. */
export const carefulBot: Bot = (s, slope) => {
  const b = s.board;
  // A careful rider holds still in the air: any turn input spins the board and risks a wipeout.
  if (b.air) return { turn: 0, jump: false };
  const obs = obstacles(s, slope);
  const lane = LANES.reduce((best, l) => (laneCost(l, b.c, b.d, obs) < laneCost(best, b.c, b.d, obs) ? l : best), LANES[0]);
  const want = Math.max(-55, Math.min(55, (lane - b.c) * 14));
  const diff = want - b.heading;
  return { turn: Math.abs(diff) < 4 ? 0 : Math.sign(diff), jump: false };
};

export const straightBot: Bot = () => ({ turn: 0, jump: false });

export interface Crash {
  readonly what: string;
  readonly c: number;
  readonly d: number;
}

/** Plays a whole run headlessly at 60 Hz; returns the final state and every crash with where it happened. */
export function playRun(slope: Slope, bot: Bot, maxSeconds = 180): { final: GameState; crashes: Crash[] } {
  let s = reduce(initialState(slope), { type: 'start' }, slope);
  const crashes: Crash[] = []; // local accumulator
  for (let i = 0; i < maxSeconds / STEP && s.phase !== 'over'; i++) {
    s = reduce({ ...s, events: [] }, { type: 'tick', dt: STEP, controls: bot(s, slope) }, slope);
    for (const e of s.events) {
      if (e.type === 'crash') crashes.push({ what: e.what, c: s.board.c, d: s.board.d });
      if (e.type === 'wipeout') crashes.push({ what: 'wipeout', c: s.board.c, d: s.board.d });
    }
  }
  return { final: s, crashes };
}
