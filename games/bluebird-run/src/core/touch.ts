/** Pure thumb-drag gesture interpreter (spec §5 Touch). Pointer wiring lives in input.ts. */

export const TOUCH = { fullTurnPx: 48, tapMs: 180, tapPx: 8, deadPx: 4 } as const;

export interface Finger {
  readonly id: number;
  readonly x0: number;
  readonly y0: number;
  readonly t0: number;
  readonly x: number;
  readonly y: number;
  /** Furthest distance from the anchor so far, px. */
  readonly maxMove: number;
}

export interface TouchState {
  /** The steering finger: its first contact is the anchor. */
  readonly primary: Finger | null;
  /** Ids of any other fingers down. */
  readonly others: readonly number[];
}

export interface TouchSample {
  readonly kind: 'down' | 'move' | 'up' | 'cancel';
  readonly id: number;
  readonly x: number;
  readonly y: number;
  /** Milliseconds. */
  readonly t: number;
}

export const NO_TOUCH: TouchState = { primary: null, others: [] };

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

function moved(f: Finger, x: number, y: number): Finger {
  return { ...f, x, y, maxMove: Math.max(f.maxMove, Math.hypot(x - f.x0, y - f.y0)) };
}

/** Feeds one sample; `jump` is true when it completes a tap or lands a second finger. */
export function stepTouch(s: TouchState, e: TouchSample): { state: TouchState; jump: boolean } {
  const p = s.primary;
  switch (e.kind) {
    case 'down':
      if (!p) return { state: { ...s, primary: { id: e.id, x0: e.x, y0: e.y, t0: e.t, x: e.x, y: e.y, maxMove: 0 } }, jump: false };
      return { state: { ...s, others: [...s.others, e.id] }, jump: true };
    case 'move':
      return { state: p && p.id === e.id ? { ...s, primary: moved(p, e.x, e.y) } : s, jump: false };
    case 'up':
    case 'cancel': {
      if (!p || p.id !== e.id) return { state: { ...s, others: s.others.filter((id) => id !== e.id) }, jump: false };
      const last = moved(p, e.x, e.y);
      const tap = e.kind === 'up' && e.t - p.t0 < TOUCH.tapMs && last.maxMove < TOUCH.tapPx;
      return { state: { ...s, primary: null }, jump: tap };
    }
  }
}

export function touchTurn(s: TouchState): number {
  if (!s.primary) return 0;
  const dx = s.primary.x - s.primary.x0;
  return Math.abs(dx) < TOUCH.deadPx ? 0 : clamp(dx / TOUCH.fullTurnPx, -1, 1);
}

/** Any finger down: in the air this is a grab. */
export const touchHeld = (s: TouchState): boolean => s.primary !== null || s.others.length > 0;
