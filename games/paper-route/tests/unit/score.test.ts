import { describe, expect, it, vi } from 'vitest';
import { accuracy, BEST_KEY, deliveryPoints, finishBonus, loadBest, saveBest, type KeyValueStore } from '../../src/game/score';
import { parseStreet } from '../../src/world/street';
import { rawStreet } from '../helpers/make-street';

const [sub, plain] = parseStreet(rawStreet()).lots;

function memoryStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

describe('points', () => {
  it('pays subscribers by hit kind and charges for non-subscribers', () => {
    expect(deliveryPoints(sub, 'porch')).toBe(250);
    expect(deliveryPoints(sub, 'mailbox')).toBe(500);
    expect(deliveryPoints(plain, 'porch')).toBe(-100);
    expect(deliveryPoints(plain, 'mailbox')).toBe(-100);
  });
  it('adds a perfect bonus only when every subscriber was served, plus 25 per paper left', () => {
    expect(finishBonus(16, 16, 3)).toBe(2075);
    expect(finishBonus(15, 16, 3)).toBe(75);
    expect(finishBonus(0, 0, 0)).toBe(0);
  });
  it('computes accuracy as deliveries per throw', () => {
    expect(accuracy(3, 4)).toBe(0.75);
    expect(accuracy(0, 0)).toBe(0);
  });
});

describe('best score', () => {
  it('loads 0 when missing, garbage, or storage is unavailable', () => {
    expect(loadBest(null)).toBe(0);
    expect(loadBest(memoryStore())).toBe(0);
    expect(loadBest(memoryStore({ [BEST_KEY]: 'abc' }))).toBe(0);
    expect(loadBest({ getItem: () => { throw new Error('denied'); }, setItem: () => {} })).toBe(0);
  });
  it('saves only a higher score and returns the best', () => {
    const store = memoryStore({ [BEST_KEY]: '1200' });
    expect(saveBest(store, 900)).toBe(1200);
    expect(store.data[BEST_KEY]).toBe('1200');
    expect(saveBest(store, 3000)).toBe(3000);
    expect(store.data[BEST_KEY]).toBe('3000');
  });
  it('still reports the new best when saving fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store: KeyValueStore = { getItem: () => null, setItem: () => { throw new Error('full'); } };
    expect(saveBest(store, 500)).toBe(500);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
