/** The wind ticks at 8 steps a second on purpose: it should feel hand-animated, not simulated. */
export const WIND_FPS = 8;

export function windStep(time: number): number {
  return ((Math.floor(time * WIND_FPS) % 2) + 2) % 2;
}
