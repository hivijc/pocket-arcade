import type { Vec2 } from '../core/geometry';
import type { RGB } from './palette';

export type PhaseId = 'morning' | 'day' | 'dusk' | 'night';
export const PHASE_IDS: readonly PhaseId[] = ['morning', 'day', 'dusk', 'night'];

export interface Grade {
  readonly mul: RGB;
  readonly add: RGB;
}

export interface PhaseLook {
  readonly id: PhaseId;
  readonly grade: Grade;
  /** Screen direction shadows fall, in pixels per pixel of object height (x right, y down). */
  readonly shadow: Vec2;
  /** Whether lamps cast light pools. */
  readonly lamps: boolean;
}

export const PHASES: Readonly<Record<PhaseId, PhaseLook>> = {
  morning: { id: 'morning', grade: { mul: [1, 0.95, 0.9], add: [14, 8, 4] }, shadow: [-0.5, 0.25], lamps: false },
  day: { id: 'day', grade: { mul: [1, 1, 1], add: [0, 0, 0] }, shadow: [0.35, 0.2], lamps: false },
  dusk: { id: 'dusk', grade: { mul: [1, 0.8, 0.72], add: [16, 0, 12] }, shadow: [0.7, 0.25], lamps: true },
  night: { id: 'night', grade: { mul: [0.62, 0.68, 0.88], add: [12, 14, 32] }, shadow: [0.2, 0.15], lamps: true },
};

export function phaseAt(hour: number): PhaseId {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

/** `?phase=night` (etc.) overrides the clock, for checking every look. */
export function phaseFor(search: string, hour: number): PhaseId {
  const asked = new URLSearchParams(search).get('phase');
  return PHASE_IDS.includes(asked as PhaseId) ? (asked as PhaseId) : phaseAt(hour);
}

export function gradeColor(c: RGB, g: Grade): RGB {
  const ch = (i: 0 | 1 | 2) => Math.max(0, Math.min(255, Math.round(c[i] * g.mul[i] + g.add[i])));
  return [ch(0), ch(1), ch(2)];
}
