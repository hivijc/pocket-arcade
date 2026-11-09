import type { BallEvent } from '../physics/ball';
import type { GameState } from '../game/state';

export type Sound = 'wall' | 'land' | 'plink' | 'splash';

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

export const puttVolume = (power: number): number => 0.15 + 0.55 * clamp01(power);
export const puttPitch = (power: number): number => 1 + 0.6 * clamp01(power);
/** Rolling hiss volume for a ball speed in tiles/s (full at 6). */
export const rollVolume = (speed: number): number => clamp01(speed / 6) * 0.25;

const SOUND_OF: Partial<Record<BallEvent, Sound>> = { wall: 'wall', land: 'land', holed: 'plink', water: 'splash' };

/** The sounds a frame's ball events trigger, each at most once, in first-seen order. */
export function soundsFor(events: readonly BallEvent[]): Sound[] {
  return [...new Set(events.flatMap((e) => (SOUND_OF[e] ? [SOUND_OF[e] as Sound] : [])))];
}

/** Audio runs only while the game is unpaused and the page is visible. */
export const shouldPlayAudio = (paused: boolean, hidden: boolean): boolean => !paused && !hidden;

/** What the audio context should do when playability flips, or null when it didn't. */
export function audioTransition(wasPlaying: boolean, nowPlaying: boolean): 'suspend' | 'resume' | null {
  if (wasPlaying === nowPlaying) return null;
  return nowPlaying ? 'resume' : 'suspend';
}

type RollView = Pick<GameState, 'phase' | 'paused'> & { readonly ball: Pick<GameState['ball'], 'vx' | 'vy' | 'airborne'> };

/** Ball speed that drives the rolling hiss: zero unless a grounded ball rolls in an unpaused game. */
export const rollSpeedOf = (s: RollView): number =>
  s.phase.kind === 'rolling' && !s.paused && !s.ball.airborne ? Math.hypot(s.ball.vx, s.ball.vy) : 0;
