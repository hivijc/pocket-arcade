import { BOARD, CRASH, SLOPE } from './constants';

/** Per-step input, the same shape for keyboard and touch. turn is −1…1 (proportional on touch). */
export interface Controls {
  readonly turn: number;
  readonly jump: boolean;
}

export const NO_CONTROLS: Controls = { turn: 0, jump: false };

export interface Air {
  readonly kind: 'ollie' | 'ramp';
  /** Seconds since take-off. */
  readonly t: number;
  readonly duration: number;
  /** Arc height above the straight line from base to 0, tiles. */
  readonly peak: number;
  /** Height at take-off (the ramp lip), easing to 0 at landing. */
  readonly base: number;
  /** Accumulated spin, degrees (sign = direction). */
  readonly spin: number;
  /** Seconds of grab held. */
  readonly grab: number;
  /** Grab held on the latest step (drives the pose). */
  readonly grabbing: boolean;
  /** Jump has been released at least once since take-off, so a press now counts as a grab. */
  readonly grabArmed: boolean;
}

export interface Board {
  readonly c: number;
  readonly d: number;
  /** Degrees from straight downhill; > 0 heads toward larger c (screen-right). */
  readonly heading: number;
  /** Tiles per second along the heading. */
  readonly speed: number;
  /** Height above the snow, tiles. */
  readonly z: number;
  readonly air: Air | null;
  /** Seconds of crash tumble left. */
  readonly tumble: number;
  /** Seconds of blinking invulnerability left. */
  readonly invuln: number;
  /** Seconds before another ollie is allowed. */
  readonly regrab: number;
}

export const newBoard = (c: number, d: number): Board => ({ c, d, heading: 0, speed: 0, z: 0, air: null, tumble: 0, invuln: 0, regrab: 0 });

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const toRad = (deg: number): number => (deg * Math.PI) / 180;

export const inPowder = (c: number): boolean => c < SLOPE.powder || c > SLOPE.width - SLOPE.powder;

export function turnHeading(h: number, turn: number, dt: number): number {
  const input = clamp(turn, -1, 1);
  if (input !== 0) return clamp(h + input * BOARD.turnRate * dt, -BOARD.maxHeading, BOARD.maxHeading);
  const step = BOARD.straighten * dt;
  return Math.abs(h) <= step ? 0 : h - Math.sign(h) * step;
}

/** Extra braking (tiles/s²) once the carve passes carveFrom degrees. */
export function carveBrake(h: number): number {
  const over = Math.abs(h) - BOARD.carveFrom;
  return over > 0 ? (BOARD.carveBrake * over) / BOARD.carveSpan : 0;
}

export function stepSpeed(v: number, h: number, c: number, dt: number): number {
  const drag = BOARD.drag * (inPowder(c) ? BOARD.powderDrag : 1);
  const a = BOARD.pull * Math.cos(toRad(h)) - drag * v - carveBrake(h);
  return Math.max(BOARD.minSpeed, v + a * dt);
}

/** Where the board ends up after dt along its heading and speed (c clamped to the slope). */
export function travel(b: Board, dt: number): { readonly c: number; readonly d: number } {
  const r = toRad(b.heading);
  return { c: clamp(b.c + b.speed * Math.sin(r) * dt, SLOPE.minC, SLOPE.maxC), d: b.d + b.speed * Math.cos(r) * dt };
}

const tickTimers = (b: Board, dt: number) => ({ invuln: Math.max(0, b.invuln - dt), regrab: Math.max(0, b.regrab - dt) });

export function stepGround(b: Board, controls: Controls, dt: number): Board {
  const heading = turnHeading(b.heading, controls.turn, dt);
  const speed = stepSpeed(b.speed, heading, b.c, dt);
  const next = { ...b, heading, speed, ...tickTimers(b, dt) };
  return { ...next, ...travel(next, dt) };
}

export const canCrash = (b: Board): boolean => b.tumble <= 0 && b.invuln <= 0;

export const crash = (b: Board): Board => ({ ...b, tumble: CRASH.tumble, air: null, z: 0, regrab: 0 });

export function stepTumble(b: Board, dt: number): Board {
  if (b.tumble <= 0) return b;
  const tumble = Math.max(0, b.tumble - dt);
  const moved = { ...b, ...travel(b, dt), speed: b.speed * Math.exp(-CRASH.slide * dt), tumble };
  return tumble > 0 ? moved : { ...moved, heading: 0, speed: 0, invuln: CRASH.invuln };
}

/** Which way the rider's body points, degrees: heading plus any spin in the air. */
export const facing = (b: Board): number => b.heading + (b.air?.spin ?? 0);
