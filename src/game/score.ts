export const STROKE_CAP = 6;
/** Backyard's best-total key (kept from the single-course game so old bests survive). */
export const BEST_KEY = 'backyard-minigolf:best';

/** The storage key for a course's best total. */
export function bestKey(course: string): string {
  return course === 'backyard' ? BEST_KEY : `minigolf:best:${course}`;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function scoreLabel(strokes: number, par: number): string {
  if (strokes === 1) return 'Hole in one!';
  const diff = strokes - par;
  if (diff <= -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  if (diff === 2) return 'Double bogey';
  return `+${diff}`;
}

export function totalStrokes(strokes: readonly number[]): number {
  return strokes.reduce((sum, s) => sum + s, 0);
}

export function loadBest(store: KeyValueStore | null, key: string = BEST_KEY): number | null {
  if (!store) return null;
  try {
    const n = Number.parseInt(store.getItem(key) ?? '', 10);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveBest(store: KeyValueStore | null, total: number, key: string = BEST_KEY): number {
  const previous = loadBest(store, key);
  const best = previous === null ? total : Math.min(previous, total);
  if (store && best !== previous) {
    try {
      store.setItem(key, String(best));
    } catch {
      // Storage blocked (private mode): the best just isn't kept.
    }
  }
  return best;
}
