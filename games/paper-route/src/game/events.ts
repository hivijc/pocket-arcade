import type { Delivery } from './score';

export type GameEvent =
  | { readonly type: 'toss' }
  | { readonly type: 'dry' }
  | { readonly type: 'deliver'; readonly hit: Delivery; readonly lot: number; readonly points: number }
  | { readonly type: 'wrong'; readonly lot: number; readonly points: number }
  | { readonly type: 'thunk' }
  | { readonly type: 'land' }
  | { readonly type: 'treat'; readonly points: number }
  | { readonly type: 'pickup' }
  | { readonly type: 'splash' }
  | { readonly type: 'spray' }
  | { readonly type: 'bark' }
  | { readonly type: 'crash' }
  | { readonly type: 'finish'; readonly bonus: number }
  | { readonly type: 'wiped' };

/** Appends events to any state that carries an event list. */
export const emit = <T extends { readonly events: readonly GameEvent[] }>(s: T, ...events: GameEvent[]): T => ({
  ...s,
  events: [...s.events, ...events],
});
