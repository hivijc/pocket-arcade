import type { Action } from '../game/state';
import type { Controls } from '../sim/board';
import { NO_TOUCH, stepTouch, touchGrab, touchTurn, type TouchSample, type TouchState } from './touch';

type Edge = Exclude<Action, { type: 'tick' }>;

const EDGES: Readonly<Record<string, Edge>> = {
  Space: { type: 'jump' },
  Enter: { type: 'start' },
  KeyR: { type: 'restart' },
  Escape: { type: 'togglePause' },
};
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const HELD = new Set([...LEFT, ...RIGHT, 'Space']);

export const actionFor = (code: string): Edge | null => EDGES[code] ?? null;
export const isGameKey = (code: string): boolean => code in EDGES || HELD.has(code);

const anyHeld = (held: ReadonlySet<string>, codes: readonly string[]) => codes.some((c) => held.has(c));

export function keyControls(held: ReadonlySet<string>): Controls {
  const l = anyHeld(held, LEFT);
  const r = anyHeld(held, RIGHT);
  return { turn: l === r ? 0 : r ? 1 : -1, jump: held.has('Space') };
}

export const mergeControls = (keys: Controls, touch: Controls): Controls =>
  ({ turn: keys.turn !== 0 ? keys.turn : touch.turn, jump: keys.jump || touch.jump });

export interface Input {
  controls(): Controls;
  detach(): void;
}

type KeyLike = Event & { readonly code?: string; readonly repeat?: boolean };

/** Pointer presses on HUD buttons and links are theirs, not steering. */
const onControl = (e: PointerEvent): boolean => e.target instanceof Element && e.target.closest('button, a') !== null;

const sampleOf = (kind: TouchSample['kind'], e: PointerEvent): TouchSample =>
  ({ kind, id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp });

/** Keyboard on `target` (the window) plus pointer drags anywhere on the page. One-shot presses call onAction. */
export function attachInput(target: Window, onAction: (a: Action) => void): Input {
  const held = new Set<string>(); // live key state: mutated on purpose
  let touch: TouchState = NO_TOUCH; // live gesture state: replaced on each pointer event
  const keydown = (e: Event) => {
    const { code = '', repeat = false } = e as KeyLike;
    if (!isGameKey(code)) return;
    e.preventDefault();
    held.add(code);
    const a = actionFor(code);
    if (a && !repeat) onAction(a);
  };
  const keyup = (e: Event) => held.delete((e as KeyLike).code ?? '');
  const feed = (kind: TouchSample['kind']) => (e: PointerEvent) => {
    if (kind === 'down' && onControl(e)) return;
    const r = stepTouch(touch, sampleOf(kind, e));
    touch = r.state;
    if (r.jump) onAction({ type: 'jump' });
  };
  const blur = () => {
    held.clear();
    touch = NO_TOUCH;
  };
  const listeners: [string, EventListener][] = [
    ['keydown', keydown], ['keyup', keyup], ['blur', blur],
    ['pointerdown', feed('down') as EventListener], ['pointermove', feed('move') as EventListener],
    ['pointerup', feed('up') as EventListener], ['pointercancel', feed('cancel') as EventListener],
  ];
  for (const [type, fn] of listeners) target.addEventListener(type, fn);
  return {
    controls: () => mergeControls(keyControls(held), { turn: touchTurn(touch), jump: touchGrab(touch) }),
    detach: () => {
      for (const [type, fn] of listeners) target.removeEventListener(type, fn);
    },
  };
}
