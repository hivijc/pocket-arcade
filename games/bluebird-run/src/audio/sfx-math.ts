import type { GameEvent, GameState } from '../game/state';
import { BOARD } from '../sim/constants';

export type Sound = 'beep' | 'go' | 'pop' | 'thud' | 'sparkle' | 'crunch' | 'chime' | 'tick' | 'sting';

export interface Cue {
  readonly sound: Sound;
  /** Hz, for pitched sounds (the gate chime). */
  readonly pitch?: number;
}

/** 660 Hz, up a semitone per gate in the streak, capped at an octave. */
export const chimePitch = (streak: number): number => 660 * 2 ** (Math.min(Math.max(streak, 1) - 1, 12) / 12);

function cuesOf(e: GameEvent): Cue[] {
  switch (e.type) {
    case 'beep': return [{ sound: 'beep' }];
    case 'go': return [{ sound: 'go' }];
    case 'ollie': case 'launch': return [{ sound: 'pop' }];
    case 'land': return e.trick ? [{ sound: 'thud' }, { sound: 'sparkle' }] : [{ sound: 'thud' }];
    case 'wipeout': case 'crash': return [{ sound: 'crunch' }];
    case 'gate': return [{ sound: 'chime', pitch: chimePitch(e.streak) }];
    case 'flake': return [{ sound: 'tick' }];
    case 'finish': return [{ sound: 'sting' }];
    default: return []; // miss and burst are silent (the crash already sounds)
  }
}

/** The sounds a frame's events trigger, each sound at most once, in first-seen order. */
export function cuesFor(events: readonly GameEvent[]): Cue[] {
  const seen = new Set<Sound>(); // local de-duplication
  return events.flatMap(cuesOf).filter((c) => (seen.has(c.sound) ? false : (seen.add(c.sound), true)));
}

export interface Swish {
  /** 0..0.35 gain. */
  readonly level: number;
  /** Band-pass centre, Hz. */
  readonly cutoff: number;
}

const QUIET: Swish = { level: 0, cutoff: 500 };

/** The continuous carve swish for the current state: louder with speed and lean, brighter with lean. */
export function swishFor(s: GameState): Swish {
  const b = s.board;
  if (s.paused || (s.phase !== 'riding' && s.phase !== 'runout') || b.air || b.tumble > 0) return QUIET;
  const lean = Math.min(1, Math.abs(b.heading) / BOARD.maxHeading);
  const speed = Math.min(1, b.speed / (BOARD.pull / BOARD.drag));
  return { level: 0.35 * speed * (0.2 + 0.8 * lean), cutoff: 500 + 2500 * lean };
}
