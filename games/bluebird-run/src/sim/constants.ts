/** Every tunable number in Bluebird Run (spec §5). Starting values; tune here only. */

export const STEP = 1 / 60;

export const SLOPE = { width: 16, powder: 2, minC: 0.4, maxC: 15.6 } as const;

export const BOARD = {
  radius: 0.3,
  /** Degrees per second while a turn input is held. */
  turnRate: 150,
  /** Degrees per second back toward straight downhill with no input. */
  straighten: 40,
  maxHeading: 75,
  /** Downhill pull, tiles/s², scaled by cos(heading). */
  pull: 5,
  /** Linear drag per second; pull / drag = 8 tiles/s top speed. */
  drag: 0.625,
  powderDrag: 3,
  carveFrom: 45,
  carveSpan: 30,
  /** Extra braking, tiles/s², at a full carve (carveFrom + carveSpan). */
  carveBrake: 4,
  minSpeed: 1,
  sprayFrom: 45,
  spraySpeed: 3,
} as const;

export const AIR = {
  ollieTime: 0.45,
  ollieHeight: 0.5,
  /** Seconds on the ground after a landing before another ollie. */
  regrab: 0.15,
  rampBase: 0.5,
  rampPerSpeed: 0.1,
  rampPeakK: 0.25,
  rampLen: 3,
  rampHalfWidth: 1,
  lipHeight: 0.5,
  /** Degrees per second of spin at full turn input. */
  spinRate: 540,
} as const;

export const TRICK = { window: 35, per180: 150, grab: 200, grabMin: 0.3, styleMin: 360, style: 1.5 } as const;

export const GATE = { base: 100, streak: 50, poleSlack: 0.3, minGap: 2, maxGap: 6 } as const;

export const FLAKE = { points: 25, radius: 0.4 } as const;

export const CRASH = { tumble: 1.2, invuln: 1.5, slide: 3 } as const;

export const RIDERS = { wake: 30, radius: 0.3 } as const;

export const HAZARD_R = { pine: 0.35, 'rock-s': 0.3, 'rock-l': 0.5, snowman: 0.35 } as const;

/** Height (tiles) the rider must be above to pass over each obstacle. */
export const CLEAR_Z = { pine: 2, 'rock-s': 0.3, 'rock-l': 0.6, snowman: 1, rider: 1.2 } as const;

export const RUN = {
  countdown: 3,
  runout: 1.5,
  runoutBrake: 4,
  bonusPerSecond: 40,
  startC: 8,
  startD: 4,
  /** No listed hazard may sit at d below this. */
  safeStart: 8,
} as const;
