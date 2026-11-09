import type { Axis, Controls } from '../sim/bike';

/** One-shot key actions. Each is also a game Action. */
export type Edge =
  | { readonly type: 'toss'; readonly side: 'L' | 'R' }
  | { readonly type: 'start' }
  | { readonly type: 'restart' }
  | { readonly type: 'togglePause' };

const EDGES: Readonly<Record<string, Edge>> = {
  KeyJ: { type: 'toss', side: 'L' },
  KeyQ: { type: 'toss', side: 'L' },
  KeyK: { type: 'toss', side: 'R' },
  KeyE: { type: 'toss', side: 'R' },
  Enter: { type: 'start' },
  Space: { type: 'start' },
  KeyR: { type: 'restart' },
  Escape: { type: 'togglePause' },
};
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const HELD = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN]);

export const edgeFor = (code: string): Edge | null => EDGES[code] ?? null;
export const isGameKey = (code: string): boolean => code in EDGES || HELD.has(code);

const anyHeld = (held: ReadonlySet<string>, codes: readonly string[]) => codes.some((c) => held.has(c));
const axis = (neg: boolean, pos: boolean): Axis => (neg === pos ? 0 : pos ? 1 : -1);

export function controlsFrom(held: ReadonlySet<string>): Controls {
  return { steer: axis(anyHeld(held, LEFT), anyHeld(held, RIGHT)), pedal: axis(anyHeld(held, DOWN), anyHeld(held, UP)) };
}

export interface Keyboard {
  controls(): Controls;
  detach(): void;
}

type KeyLike = Event & { readonly code?: string; readonly repeat?: boolean };

/** Listens on `target` (the window in the game). Held keys feed controls(); presses fire onEdge once. */
export function attachKeyboard(target: EventTarget, onEdge: (e: Edge) => void): Keyboard {
  const held = new Set<string>(); // live key state: mutated on purpose
  const down = (e: Event) => {
    const { code = '', repeat = false } = e as KeyLike;
    if (!isGameKey(code)) return;
    e.preventDefault();
    held.add(code);
    const edge = edgeFor(code);
    if (edge && !repeat) onEdge(edge);
  };
  const up = (e: Event) => held.delete((e as KeyLike).code ?? '');
  const blur = () => held.clear();
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', blur);
  return {
    controls: () => controlsFrom(held),
    detach() {
      target.removeEventListener('keydown', down);
      target.removeEventListener('keyup', up);
      target.removeEventListener('blur', blur);
    },
  };
}
