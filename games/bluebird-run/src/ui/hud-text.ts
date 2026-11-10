import type { GameEvent, GameState } from '../game/state';
import type { Slope } from '../world/slope';

/** m:ss.t, rounding down to the tenth so the clock never shows time not yet ridden. */
export function clockText(t: number): string {
  const tenths = Math.floor(Math.max(0, t) * 10 + 1e-6);
  const m = Math.floor(tenths / 600);
  const s = (tenths % 600) / 10;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

export const countdownText = (clock: number): string => (clock > 0 ? String(Math.ceil(clock)) : 'Go!');

export const streakText = (streak: number): string => (streak >= 2 ? `×${streak}` : '');

function eventText(e: GameEvent): string | null {
  switch (e.type) {
    case 'land': return e.trick ? `${e.trick.name}! +${e.trick.points}` : null;
    case 'wipeout': return 'Wipeout!';
    case 'crash': return 'Ouch!';
    case 'gate': return e.streak >= 3 ? `Gate streak ×${e.streak}` : null;
    case 'finish': return `Finish! +${e.bonus}`;
    default: return null;
  }
}

/** The text to flash for the latest notable event this frame, if any. */
export function popupText(events: readonly GameEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const text = eventText(events[i]);
    if (text) return text;
  }
  return null;
}

export function endRows(s: GameState, slope: Slope, best: number): [string, string][] {
  return [
    ['Score', String(s.score)],
    ['Time', clockText(s.finishTime ?? s.time)],
    ['Gates', `${s.gates.passed}/${slope.gates.length}`],
    ['Best trick', s.bestTrick ? `${s.bestTrick.name} +${s.bestTrick.points}` : '—'],
    ['Snowflakes', `${s.flakes.length}/${slope.flakes.length}`],
    ['Best', String(best)],
  ];
}
