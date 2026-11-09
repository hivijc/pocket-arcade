import { describe, expect, it, vi } from 'vitest';
import { emit } from '../../src/game/events';
import { BEST_KEY, loadBest, loadMuted, MUTE_KEY, saveBest, saveMuted, timeBonus, type KeyValueStore } from '../../src/game/score';

const memory = (init: Record<string, string> = {}): KeyValueStore => {
  const data = new Map(Object.entries(init)); // a test fake store: mutated on purpose
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('timeBonus', () => {
  it('pays 40 per second under par, never negative', () => {
    expect(timeBonus(60, 75)).toBe(600);
    expect(timeBonus(74.26, 75)).toBe(30);
    expect(timeBonus(80, 75)).toBe(0);
  });
});

describe('best score', () => {
  it('loads 0 when missing, junk or unavailable', () => {
    expect(loadBest(null)).toBe(0);
    expect(loadBest(memory({ [BEST_KEY]: 'abc' }))).toBe(0);
    expect(loadBest(memory({ [BEST_KEY]: '1234' }))).toBe(1234);
  });
  it('only saves a better score', () => {
    const store = memory({ [BEST_KEY]: '500' });
    expect(saveBest(store, 300)).toBe(500);
    expect(saveBest(store, 900)).toBe(900);
    expect(loadBest(store)).toBe(900);
  });
  it('survives a store that throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bad: KeyValueStore = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    expect(loadBest(bad)).toBe(0);
    expect(saveBest(bad, 10)).toBe(10);
    expect(loadMuted(bad)).toBe(false);
    saveMuted(bad, true);
    warn.mockRestore();
  });
});

describe('mute flag', () => {
  it('round-trips', () => {
    const store = memory();
    expect(loadMuted(store)).toBe(false);
    saveMuted(store, true);
    expect(store.getItem(MUTE_KEY)).toBe('1');
    expect(loadMuted(store)).toBe(true);
  });
});

describe('emit', () => {
  it('appends events without touching the original', () => {
    const s = { events: [{ type: 'go' as const }] };
    const t = emit(s, { type: 'flake' });
    expect(t.events).toEqual([{ type: 'go' }, { type: 'flake' }]);
    expect(s.events).toHaveLength(1);
  });
});
