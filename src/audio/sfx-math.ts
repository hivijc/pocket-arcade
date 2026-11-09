import type { BallEvent } from '../physics/ball';
import type { PhaseId } from '../render/time-of-day';

export type Sound = 'wall' | 'land' | 'plink' | 'splash';
export type Ambience = 'birds' | 'crickets';

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export const puttVolume = (power: number): number => 0.15 + 0.55 * clamp01(power);
export const puttPitch = (power: number): number => 1 + 0.6 * clamp01(power);
/** Rolling hiss volume for a ball speed in tiles/s (full at 6). */
export const rollVolume = (speed: number): number => clamp01(speed / 6) * 0.25;
export const ambienceFor = (phase: PhaseId): Ambience => (phase === 'dusk' || phase === 'night' ? 'crickets' : 'birds');

const SOUND_OF: Partial<Record<BallEvent, Sound>> = { wall: 'wall', land: 'land', holed: 'plink', water: 'splash' };

/** The sounds a frame's ball events trigger, each at most once, in first-seen order. */
export function soundsFor(events: readonly BallEvent[]): Sound[] {
  return [...new Set(events.flatMap((e) => (SOUND_OF[e] ? [SOUND_OF[e] as Sound] : [])))];
}
