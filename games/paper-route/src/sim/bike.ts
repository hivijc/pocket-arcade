import { ACCEL, CRASH, DRIFT, RIDE_C, SLOW_SPEED, SPEED, START } from './constants';

export type Axis = -1 | 0 | 1;

export interface Controls {
  /** −1 drift left (c down), +1 drift right. */
  readonly steer: Axis;
  /** −1 brake, +1 pedal faster. */
  readonly pedal: Axis;
}

export const NO_CONTROLS: Controls = { steer: 0, pedal: 0 };

export interface Bike {
  readonly c: number;
  readonly s: number;
  readonly speed: number;
  /** The steering actually applied this step (drives the rider's facing). */
  readonly lean: Axis;
  /** Seconds left held to SLOW_SPEED (puddle, sprinkler). */
  readonly slow: number;
  /** Seconds left of crash wobble: no steering, no throws. */
  readonly wobble: number;
  /** Seconds left that a crash can't happen. */
  readonly invuln: number;
}

export const newBike = (): Bike => ({ c: START.c, s: START.s, speed: SPEED.cruise, lean: 0, slow: 0, wobble: 0, invuln: 0 });

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const approach = (v: number, target: number, step: number) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
const tickDown = (v: number, dt: number) => Math.max(0, v - dt);

export function targetSpeed(b: Bike, pedal: Axis): number {
  if (b.wobble > 0) return CRASH.wobbleSpeed;
  const wanted = pedal > 0 ? SPEED.max : pedal < 0 ? SPEED.min : SPEED.cruise;
  return b.slow > 0 ? Math.min(wanted, SLOW_SPEED) : wanted;
}

export function stepBike(b: Bike, ctl: Controls, dt: number): Bike {
  const speed = approach(b.speed, targetSpeed(b, ctl.pedal), ACCEL * dt);
  const lean: Axis = b.wobble > 0 ? 0 : ctl.steer;
  return {
    c: clamp(b.c + lean * DRIFT * dt, RIDE_C[0], RIDE_C[1]),
    s: b.s + speed * dt,
    speed,
    lean,
    slow: tickDown(b.slow, dt),
    wobble: tickDown(b.wobble, dt),
    invuln: tickDown(b.invuln, dt),
  };
}

export const slowDown = (b: Bike, seconds: number): Bike => ({ ...b, slow: Math.max(b.slow, seconds) });
export const canCrash = (b: Bike): boolean => b.invuln <= 0;
export const crash = (b: Bike): Bike => ({ ...b, wobble: CRASH.wobble, invuln: CRASH.wobble + CRASH.invuln });
