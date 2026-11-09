import { POINTS } from '../sim/constants';
import type { Lot } from '../world/street';

export type Delivery = 'porch' | 'mailbox';

export const deliveryPoints = (lot: Lot, hit: Delivery): number => (lot.subscriber ? POINTS[hit] : POINTS.wrong);

export function finishBonus(delivered: number, subscribers: number, papersLeft: number): number {
  const perfect = subscribers > 0 && delivered >= subscribers ? POINTS.perfect : 0;
  return perfect + papersLeft * POINTS.paperLeft;
}

export const accuracy = (delivered: number, throws: number): number => (throws === 0 ? 0 : delivered / throws);

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const BEST_KEY = 'paper-route.best';

export function loadBest(store: KeyValueStore | null): number {
  if (!store) return 0;
  try {
    const n = Number(store.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Stores `score` if it beats the saved best; returns the best either way. */
export function saveBest(store: KeyValueStore | null, score: number): number {
  const prev = loadBest(store);
  if (score <= prev) return prev;
  try {
    store?.setItem(BEST_KEY, String(score));
  } catch (err) {
    console.warn('Could not save the best score:', err);
  }
  return score;
}
