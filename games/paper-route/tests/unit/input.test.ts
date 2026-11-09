import { describe, expect, it, vi } from 'vitest';
import { attachKeyboard, controlsFrom, edgeFor, isGameKey } from '../../src/core/input';

const key = (type: string, code: string, repeat = false) => Object.assign(new Event(type, { cancelable: true }), { code, repeat });

describe('key mapping', () => {
  it('maps toss, start, restart and pause keys', () => {
    expect(edgeFor('KeyJ')).toEqual({ type: 'toss', side: 'L' });
    expect(edgeFor('KeyQ')).toEqual({ type: 'toss', side: 'L' });
    expect(edgeFor('KeyK')).toEqual({ type: 'toss', side: 'R' });
    expect(edgeFor('KeyE')).toEqual({ type: 'toss', side: 'R' });
    expect(edgeFor('Enter')).toEqual({ type: 'start' });
    expect(edgeFor('Space')).toEqual({ type: 'start' });
    expect(edgeFor('KeyR')).toEqual({ type: 'restart' });
    expect(edgeFor('Escape')).toEqual({ type: 'togglePause' });
    expect(edgeFor('KeyZ')).toBeNull();
  });
  it('turns held keys into steer and pedal axes', () => {
    expect(controlsFrom(new Set())).toEqual({ steer: 0, pedal: 0 });
    expect(controlsFrom(new Set(['KeyA']))).toEqual({ steer: -1, pedal: 0 });
    expect(controlsFrom(new Set(['ArrowRight', 'ArrowUp']))).toEqual({ steer: 1, pedal: 1 });
    expect(controlsFrom(new Set(['KeyA', 'KeyD', 'KeyS']))).toEqual({ steer: 0, pedal: -1 });
  });
  it('knows which keys belong to the game', () => {
    expect(isGameKey('KeyW')).toBe(true);
    expect(isGameKey('KeyJ')).toBe(true);
    expect(isGameKey('Tab')).toBe(false);
  });
});

describe('attachKeyboard', () => {
  it('tracks held keys, fires edges once per press, clears on blur, and detaches', () => {
    const target = new EventTarget();
    const onEdge = vi.fn();
    const kb = attachKeyboard(target, onEdge);
    target.dispatchEvent(key('keydown', 'KeyD'));
    expect(kb.controls().steer).toBe(1);
    target.dispatchEvent(key('keyup', 'KeyD'));
    expect(kb.controls().steer).toBe(0);
    target.dispatchEvent(key('keydown', 'KeyJ'));
    target.dispatchEvent(key('keydown', 'KeyJ', true));
    expect(onEdge).toHaveBeenCalledTimes(1);
    expect(onEdge).toHaveBeenCalledWith({ type: 'toss', side: 'L' });
    target.dispatchEvent(key('keydown', 'KeyW'));
    target.dispatchEvent(new Event('blur'));
    expect(kb.controls().pedal).toBe(0);
    kb.detach();
    target.dispatchEvent(key('keydown', 'KeyK'));
    expect(onEdge).toHaveBeenCalledTimes(1);
  });
  it('prevents the browser default for game keys only', () => {
    const target = new EventTarget();
    attachKeyboard(target, () => {});
    const space = key('keydown', 'Space');
    const tab = key('keydown', 'Tab');
    target.dispatchEvent(space);
    target.dispatchEvent(tab);
    expect(space.defaultPrevented).toBe(true);
    expect(tab.defaultPrevented).toBe(false);
  });
});
