import type { Axis, Controls } from '../sim/bike';

/** Floating thumb stick, in CSS pixels: travel under `dead` is ignored; the knob stops at `max`. */
export const STICK = { dead: 14, max: 44 } as const;

const axis = (v: number): Axis => (v <= -STICK.dead ? -1 : v >= STICK.dead ? 1 : 0);

/**
 * Thumb travel from where it touched down → bike controls. Sideways steers; up pedals faster and down
 * brakes (screen y grows downward, so it is flipped).
 */
export function stickControls(dx: number, dy: number): Controls {
  return { steer: axis(dx), pedal: axis(-dy) };
}

/** Where to draw the knob: under the thumb, held inside the ring. */
export function knobOffset(dx: number, dy: number): [number, number] {
  const d = Math.hypot(dx, dy);
  if (d <= STICK.max) return [dx, dy];
  return [(dx * STICK.max) / d, (dy * STICK.max) / d];
}

/** Keyboard and touch together: each axis follows whichever source is pressing, the keyboard first. */
export function mergeControls(keys: Controls, touch: Controls): Controls {
  return { steer: keys.steer || touch.steer, pedal: keys.pedal || touch.pedal };
}

/**
 * How much to scale the bufW×bufH canvas to fit a vw×vh viewport. Whole-pixel steps keep the art crisp; on touch
 * screens below 2× that would waste up to half the screen, so there it fills the limiting side (the canvas uses
 * image-rendering: pixelated). Same rule as mini-golf.
 */
export function canvasScale(vw: number, vh: number, bufW: number, bufH: number, touch: boolean): number {
  const fit = Math.min(vw / bufW, vh / bufH);
  if (touch && fit < 2) return fit;
  return Math.max(1, Math.floor(fit));
}

/** Events a browser accepts as the user gesture that lets audio start (on touch: the lift, not the press). */
export function isUserActivation(type: string, pointerType = ''): boolean {
  if (type === 'keydown' || type === 'touchend' || type === 'mousedown') return true;
  if (type === 'pointerdown') return pointerType === 'mouse';
  if (type === 'pointerup') return pointerType !== 'mouse' && pointerType !== '';
  return false;
}
