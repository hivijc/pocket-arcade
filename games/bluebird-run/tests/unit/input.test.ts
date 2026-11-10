import { describe, expect, it } from 'vitest';
import { actionFor, attachInput, isGameKey, keyControls, mergeControls } from '../../src/core/input';
import type { Action } from '../../src/game/state';

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

describe('attachInput', () => {
  const setup = () => {
    const target = new EventTarget();
    const actions: Action[] = [];
    const input = attachInput(target as unknown as Window, (a) => actions.push(a));
    const fire = (type: string, props: Record<string, unknown> = {}): Event => {
      const { timeStamp, target: tgt, ...plain } = props; // these two are getter-only on Event
      const e = Object.assign(new Event(type, { cancelable: true }), plain);
      if (timeStamp !== undefined) Object.defineProperty(e, 'timeStamp', { value: timeStamp });
      if (tgt !== undefined) Object.defineProperty(e, 'target', { value: tgt });
      target.dispatchEvent(e);
      return e;
    };
    const key = (type: 'keydown' | 'keyup', code: string, extra: Record<string, unknown> = {}) => fire(type, { code, repeat: false, ...extra });
    const pointer = (type: string, extra: Record<string, unknown> = {}) =>
      fire(type, { pointerId: 1, pointerType: 'touch', button: 0, clientX: 100, clientY: 300, timeStamp: 0, ...extra });
    return { actions, input, fire, key, pointer };
  };
  const button = { closest: (sel: string) => (sel.includes('button') ? {} : null) };

  it('fires a one-shot action once per press and feeds held keys to controls()', () => {
    const { actions, input, key } = setup();
    const down = key('keydown', 'Space');
    expect(down.defaultPrevented).toBe(true);
    key('keydown', 'ArrowRight');
    expect(actions).toEqual([{ type: 'jump' }]);
    expect(input.controls()).toEqual({ turn: 1, jump: true });
    key('keyup', 'Space');
    key('keyup', 'ArrowRight');
    expect(input.controls()).toEqual({ turn: 0, jump: false });
  });
  it('does not re-fire on key repeat', () => {
    const { actions, key } = setup();
    key('keydown', 'Space');
    key('keydown', 'Space', { repeat: true });
    key('keydown', 'Space', { repeat: true });
    expect(actions).toHaveLength(1);
  });
  it.each(['metaKey', 'ctrlKey', 'altKey'])('ignores a %s-modified key: no action, no hold, no preventDefault', (mod) => {
    const { actions, input, key } = setup();
    const e = key('keydown', 'KeyR', { [mod]: true });
    key('keydown', 'ArrowLeft', { [mod]: true });
    expect(e.defaultPrevented).toBe(false);
    expect(actions).toEqual([]);
    expect(input.controls().turn).toBe(0);
  });
  it('ignores keys pressed while a button has focus', () => {
    const { actions, key } = setup();
    const e = key('keydown', 'Space', { target: button });
    expect(e.defaultPrevented).toBe(false);
    expect(actions).toEqual([]);
  });
  it('fires jump on a pointer tap', () => {
    const { actions, pointer } = setup();
    pointer('pointerdown');
    pointer('pointerup', { timeStamp: 100 });
    expect(actions).toEqual([{ type: 'jump' }]);
  });
  it('ignores a pointerdown that lands on a control', () => {
    const { actions, pointer, input } = setup();
    pointer('pointerdown', { target: button });
    pointer('pointerup', { timeStamp: 100, target: button });
    expect(actions).toEqual([]);
    expect(input.controls().jump).toBe(false);
  });
  it('ignores a non-primary mouse button', () => {
    const { actions, pointer } = setup();
    pointer('pointerdown', { pointerType: 'mouse', button: 2 });
    pointer('pointerup', { pointerType: 'mouse', button: 2, timeStamp: 100 });
    expect(actions).toEqual([]);
  });
  it('steers from a drag and grabs while the finger holds still', () => {
    const { input, pointer } = setup();
    pointer('pointerdown');
    expect(input.controls().jump).toBe(true);
    pointer('pointermove', { clientX: 130 });
    expect(input.controls()).toEqual({ turn: 30 / 48, jump: false });
  });
  it('clears held keys and touch on blur', () => {
    const { input, key, pointer, fire } = setup();
    key('keydown', 'ArrowLeft');
    pointer('pointerdown');
    fire('blur');
    expect(input.controls()).toEqual({ turn: 0, jump: false });
  });
  it('stops listening after detach', () => {
    const { actions, input, key } = setup();
    input.detach();
    key('keydown', 'Space');
    expect(actions).toEqual([]);
    expect(input.controls().jump).toBe(false);
  });
});
