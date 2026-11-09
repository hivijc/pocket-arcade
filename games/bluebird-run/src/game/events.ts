import type { Vec2 } from '../core/geometry';
import type { Trick } from '../sim/tricks';

export type GameEvent =
  | { readonly type: 'beep'; readonly n: number }
  | { readonly type: 'go' }
  | { readonly type: 'ollie' }
  | { readonly type: 'launch' }
  | { readonly type: 'land'; readonly trick: Trick | null }
  | { readonly type: 'wipeout' }
  | { readonly type: 'crash'; readonly what: string }
  | { readonly type: 'burst'; readonly at: Vec2 }
  | { readonly type: 'gate'; readonly points: number; readonly streak: number }
  | { readonly type: 'miss' }
  | { readonly type: 'flake' }
  | { readonly type: 'finish'; readonly time: number; readonly bonus: number };

/** Appends events to any state that carries an event list. */
export const emit = <T extends { readonly events: readonly GameEvent[] }>(s: T, ...events: GameEvent[]): T => ({
  ...s,
  events: [...s.events, ...events],
});
