/** Every tunable number for the slice (spec §5). Distances in tiles, times in seconds. */

/** Fixed simulation step. */
export const STEP = 1 / 60;

export const SPEED = { min: 2, cruise: 3, max: 4.5 } as const;
/** Tiles/s² toward the target speed. */
export const ACCEL = 3;
/** Sideways drift speed. */
export const DRIFT = 4;
/** The bike stays on the sidewalks and road. */
export const RIDE_C: readonly [number, number] = [4.3, 9.7];
export const START = { c: 7, s: 2 } as const;
export const BIKE_R = 0.3;

export const PAPERS = { start: 10, max: 15, bundle: 5 } as const;
export const BUNDLE_R = 0.5;

/** Flight lands `reach` tiles to the side after `flight` s; h(t) = h0 + vz·t − gravity·t²/2 hits 0 at t = flight. */
export const TOSS = { cooldown: 0.35, reach: 3.5, flight: 0.6, h0: 0.9, vz: 3.737, gravity: 17.46 } as const;
export const MAILBOX = { r: 0.35, top: 1 } as const;

export const PUDDLE = { r: 0.6, slowTime: 1 } as const;
export const SLOW_SPEED = 2;
export const SPRINKLER = { on: 1.5, off: 1.5, slowTime: 0.5 } as const;
/** Parked cars lie along the street: half-size across (c) and along (s). */
export const CAR_HALF: readonly [number, number] = [0.6, 1.1];
export const DOG = { trigger: 6, speed: 3.8, chaseTime: 4, homeSpeed: 2, r: 0.35, treatR: 0.6 } as const;
export const CRASH = { helmets: 3, wobble: 1.2, invuln: 1.5, wobbleSpeed: 1.5 } as const;

export const POINTS = { porch: 250, mailbox: 500, wrong: -100, dog: 50, perfect: 2000, paperLeft: 25 } as const;
/** The run finishes this far before the end of the street. */
export const FINISH_MARGIN = 4;
