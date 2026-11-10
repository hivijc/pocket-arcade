import { describe, expect, it } from 'vitest';
import { actionFor, isGameKey, keyControls, mergeControls } from '../../src/core/input';

describe('keyboard', () => {
  it('maps one-shot keys to actions', () => {
    expect(actionFor('Space')).toEqual({ type: 'jump' });
    expect(actionFor('Enter')).toEqual({ type: 'start' });
    expect(actionFor('KeyR')).toEqual({ type: 'restart' });
    expect(actionFor('Escape')).toEqual({ type: 'togglePause' });
    expect(actionFor('KeyZ')).toBeNull();
    expect(isGameKey('ArrowLeft')).toBe(true);
    expect(isGameKey('KeyZ')).toBe(false);
  });
  it('turns held keys into controls', () => {
    expect(keyControls(new Set(['ArrowRight']))).toEqual({ turn: 1, jump: false });
    expect(keyControls(new Set(['KeyA', 'Space']))).toEqual({ turn: -1, jump: true });
    expect(keyControls(new Set(['KeyA', 'KeyD']))).toEqual({ turn: 0, jump: false });
  });
  it('merges keyboard and touch, keyboard turn first', () => {
    expect(mergeControls({ turn: 0, jump: false }, { turn: 0.4, jump: true })).toEqual({ turn: 0.4, jump: true });
    expect(mergeControls({ turn: -1, jump: false }, { turn: 0.4, jump: false })).toEqual({ turn: -1, jump: false });
  });
});
