import type { Ramp } from '../world/slope';
import { travel, type Air, type Board, type Controls } from './board';
import { AIR } from './constants';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const canOllie = (b: Board): boolean => b.air === null && b.tumble <= 0 && b.regrab <= 0;

const takeOff = (b: Board, arc: Pick<Air, 'kind' | 'duration' | 'peak' | 'base'>): Board =>
  ({ ...b, air: { ...arc, t: 0, spin: 0, grab: 0, grabbing: false } });

/** A small hop from the ground (Space / tap). Unchanged when not allowed. */
export const ollie = (b: Board): Board =>
  canOllie(b) ? takeOff(b, { kind: 'ollie', duration: AIR.ollieTime, peak: AIR.ollieHeight, base: 0 }) : b;

export const rampAirtime = (speed: number): number => AIR.rampBase + AIR.rampPerSpeed * speed;

/** Leaves a kicker's lip: faster means longer and higher. */
export function launch(b: Board): Board {
  const duration = rampAirtime(b.speed);
  return takeOff({ ...b, z: AIR.lipHeight }, { kind: 'ramp', duration, peak: AIR.rampPeakK * duration * b.speed, base: AIR.lipHeight });
}

/** Height on the arc: eases from base to 0 with a parabolic bump of `peak`. */
export function airHeight(a: Air): number {
  const u = clamp01(a.t / a.duration);
  return a.base * (1 - u) + 4 * a.peak * u * (1 - u);
}

/** One step in the air: the board keeps its take-off heading and speed; turn spins, jump grabs. */
export function stepAir(b: Board, controls: Controls, dt: number): Board {
  if (!b.air) return b;
  const a = b.air;
  const air: Air = {
    ...a,
    t: a.t + dt,
    spin: a.spin + Math.max(-1, Math.min(1, controls.turn)) * AIR.spinRate * dt,
    grab: controls.jump ? a.grab + dt : a.grab,
    grabbing: controls.jump,
  };
  return { ...b, ...travel(b, dt), air, z: airHeight(air), invuln: Math.max(0, b.invuln - dt) };
}

export const hasLanded = (b: Board): boolean => b.air !== null && b.air.t >= b.air.duration;

export const touchDown = (b: Board): Board => ({ ...b, air: null, z: 0, regrab: AIR.regrab });

export const onRamp = (r: Ramp, c: number, d: number): boolean =>
  Math.abs(c - r.c) <= AIR.rampHalfWidth && d >= r.d && d < r.d + AIR.rampLen;

/** Snow height under a point: rises along a ramp to its lip, 0 elsewhere. */
export function groundZ(ramps: readonly Ramp[], c: number, d: number): number {
  const r = ramps.find((ramp) => onRamp(ramp, c, d));
  return r ? AIR.lipHeight * clamp01((d - r.d) / AIR.rampLen) : 0;
}

/** True on the step a grounded board passes a ramp's lip within its width. */
export const crossedLip = (r: Ramp, prevD: number, b: Board): boolean =>
  b.air === null && Math.abs(b.c - r.c) <= AIR.rampHalfWidth && prevD < r.d + AIR.rampLen && b.d >= r.d + AIR.rampLen;
