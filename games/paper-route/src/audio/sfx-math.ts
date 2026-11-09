import type { GameEvent } from '../game/state';

export type Sound = 'toss' | 'thwack' | 'ding' | 'bark' | 'splash' | 'crash' | 'pickup' | 'dry' | 'land' | 'fanfare';

function soundOf(e: GameEvent): Sound {
  switch (e.type) {
    case 'deliver': return e.hit === 'mailbox' ? 'ding' : 'thwack';
    case 'wrong': case 'bark': return 'bark';
    case 'thunk': return 'thwack';
    case 'treat': case 'pickup': return 'pickup';
    case 'splash': case 'spray': return 'splash';
    case 'crash': case 'wiped': return 'crash';
    case 'finish': return 'fanfare';
    default: return e.type; // toss, dry, land share their sound's name
  }
}

/** The sounds a frame's events trigger, each at most once, in first-seen order. */
export const soundsFor = (events: readonly GameEvent[]): Sound[] => [...new Set(events.map(soundOf))];
