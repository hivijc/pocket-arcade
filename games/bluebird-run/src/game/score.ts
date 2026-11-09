import { RUN } from '../sim/constants';

export const timeBonus = (time: number, par: number): number => Math.round(Math.max(0, par - time) * RUN.bonusPerSecond);

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const BEST_KEY = 'bluebird-run.best';
export const MUTE_KEY = 'bluebird-run.muted';

function read(store: KeyValueStore | null, key: string): string | null {
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function write(store: KeyValueStore | null, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch (err) {
    console.warn(`Could not save ${key}:`, err);
  }
}

export function loadBest(store: KeyValueStore | null): number {
  const n = Number(read(store, BEST_KEY));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Stores `score` if it beats the saved best; returns the best either way. */
export function saveBest(store: KeyValueStore | null, score: number): number {
  const prev = loadBest(store);
  if (score <= prev) return prev;
  write(store, BEST_KEY, String(score));
  return score;
}

export const loadMuted = (store: KeyValueStore | null): boolean => read(store, MUTE_KEY) === '1';
export const saveMuted = (store: KeyValueStore | null, muted: boolean): void => write(store, MUTE_KEY, muted ? '1' : '0');
