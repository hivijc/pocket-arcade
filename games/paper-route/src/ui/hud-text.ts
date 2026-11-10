import type { GameEvent, Outcome } from '../game/state';
import { CRASH, PAPERS } from '../sim/constants';

export const helmetsText = (n: number, max: number = CRASH.helmets): string =>
  '●'.repeat(Math.max(0, n)) + '○'.repeat(Math.max(0, max - n));

export const endTitle = (o: Outcome | null): string => (o === 'finished' ? 'Route complete!' : 'Wiped out!');

export const percent = (v: number): string => `${Math.round(v * 100)}%`;

function eventText(e: GameEvent): string | null {
  switch (e.type) {
    case 'deliver': return e.hit === 'mailbox' ? `Mailbox! +${e.points}` : `+${e.points}`;
    case 'wrong': return `Hey! ${e.points}`;
    case 'treat': return `Good dog! +${e.points}`;
    case 'pickup': return `+${PAPERS.bundle} papers`;
    case 'crash': return 'Ouch!';
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

export interface HudCopy {
  readonly keys: string;
  readonly hint: string;
  readonly titleCta: string;
  readonly pauseHelp: string;
  readonly endCta: string;
}

const KEYBOARD_COPY: HudCopy = {
  keys: 'A/D or ←/→ steer · W/S speed · J/Q toss left · K/E toss right',
  hint: 'A/D steer · W/S speed · J/Q toss left · K/E toss right · Esc pause',
  titleCta: 'Press Enter to ride',
  pauseHelp: 'Esc to keep riding · R to restart',
  endCta: 'Press R or Enter to ride again',
};

const TOUCH_COPY: HudCopy = {
  keys: 'Left thumb: stick to steer, push up to speed up · Right thumb: ↖ ↘ to toss',
  hint: '',
  titleCta: 'Tap to ride',
  pauseHelp: 'Tap to keep riding',
  endCta: 'Tap to ride again',
};

/** The words the HUD uses for keyboard play or for a touch screen. */
export const hudCopy = (touch: boolean): HudCopy => (touch ? TOUCH_COPY : KEYBOARD_COPY);
