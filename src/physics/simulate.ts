import type { Hole } from '../world/hole';
import { isMoving, step, strike, type Ball, type BallEvent } from './ball';
import { MAX_SIM_SECONDS, STEP } from './constants';

export type Outcome = 'holed' | 'stopped' | 'water' | 'timeout';

export interface ShotResult {
  readonly ball: Ball;
  readonly outcome: Outcome;
  readonly events: readonly BallEvent[];
  readonly steps: number;
}

const ENDINGS: readonly BallEvent[] = ['holed', 'water', 'stopped'];

export function simulateShot(hole: Hole, from: Ball, angle: number, power: number, maxSeconds = MAX_SIM_SECONDS): ShotResult {
  const maxSteps = Math.ceil(maxSeconds / STEP);
  let ball = strike(from, hole, angle, power);
  const events: BallEvent[] = [];
  for (let i = 1; i <= maxSteps; i++) {
    const r = step(ball, hole);
    ball = r.ball;
    events.push(...r.events);
    const end = r.events.find((e) => ENDINGS.includes(e));
    if (end) return { ball, outcome: end as Outcome, events, steps: i };
    if (!isMoving(ball)) return { ball, outcome: 'stopped', events, steps: i };
  }
  return { ball, outcome: 'timeout', events, steps: maxSteps };
}
