import type { Vec2 } from '../core/geometry';

/** The wind ticks at 8 steps a second on purpose: it should feel hand-animated, not simulated. */
export const WIND_FPS = 8;

export function windStep(time: number): number {
  return ((Math.floor(time * WIND_FPS) % 2) + 2) % 2;
}

/** How far a swaying sprite's top half shifts this step; neighbouring props lean opposite ways. */
export function swayOffset(step: number, at: Vec2): -1 | 0 | 1 {
  if (step === 0) return 0;
  return (Math.floor(at[0] * 7 + at[1] * 13) & 1) === 0 ? 1 : -1;
}
