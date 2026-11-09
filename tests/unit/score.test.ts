import { describe, expect, it } from 'vitest';
import { BEST_KEY, STROKE_CAP, bestKey, isCelebration, loadBest, saveBest, scoreLabel, totalStrokes, type KeyValueStore } from '../../src/game/score';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}
const brokenStore: KeyValueStore = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('denied'); },
};

describe('scoreLabel', () => {
  it.each([
    [1, 3, 'Hole in one!'],
    [1, 2, 'Hole in one!'],
    [1, 4, 'Hole in one!'],
    [2, 4, 'Eagle'],
    [2, 3, 'Birdie'],
    [3, 3, 'Par'],
    [4, 3, 'Bogey'],
    [5, 3, 'Double bogey'],
    [6, 2, '+4'],
  ])('%i strokes on par %i is %s', (strokes, par, label) => {
    expect(scoreLabel(strokes, par)).toBe(label);
  });
});

describe('totals', () => {
  it('sums strokes', () => {
    expect(totalStrokes([2, 3, 4])).toBe(9);
  });
  it('caps a hole at 6', () => {
    expect(STROKE_CAP).toBe(6);
  });
});

describe('best total', () => {
  it('returns null when nothing is stored', () => {
    expect(loadBest(memoryStore())).toBeNull();
  });
  it('reads a stored best', () => {
    expect(loadBest(memoryStore({ [BEST_KEY]: '9' }))).toBe(9);
  });
  it('ignores junk', () => {
    expect(loadBest(memoryStore({ [BEST_KEY]: 'abc' }))).toBeNull();
  });
  it('saves a new best and keeps a better old one', () => {
    const store = memoryStore({ [BEST_KEY]: '9' });
    expect(saveBest(store, 11)).toBe(9);
    expect(store.data[BEST_KEY]).toBe('9');
    expect(saveBest(store, 7)).toBe(7);
    expect(store.data[BEST_KEY]).toBe('7');
  });
  it('works without storage', () => {
    expect(loadBest(null)).toBeNull();
    expect(saveBest(null, 8)).toBe(8);
  });
  it('survives storage that throws', () => {
    expect(loadBest(brokenStore)).toBeNull();
    expect(saveBest(brokenStore, 8)).toBe(8);
  });
});

describe('isCelebration', () => {
  it('is true for birdie or better, including a hole in one', () => {
    expect(isCelebration(2, 3)).toBe(true);
    expect(isCelebration(1, 3)).toBe(true);
    expect(isCelebration(1, 2)).toBe(true);
    expect(isCelebration(2, 5)).toBe(true);
  });
  it('is false for par or worse', () => {
    expect(isCelebration(3, 3)).toBe(false);
    expect(isCelebration(5, 3)).toBe(false);
  });
});
