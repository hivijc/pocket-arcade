import { distance } from '../core/geometry';
import { inRect, type Lot, type Side } from '../world/street';
import type { Bike } from './bike';
import { MAILBOX, TOSS } from './constants';

/** A paper in flight, described by its launch so its position is exact at any time. */
export interface Paper {
  readonly c0: number;
  readonly s0: number;
  /** Tiles/s across (negative = left). */
  readonly dc: number;
  /** Tiles/s along: the bike's speed when thrown. */
  readonly ds: number;
  /** Seconds since the throw, capped at TOSS.flight. */
  readonly t: number;
}

export interface PaperPos {
  readonly c: number;
  readonly s: number;
  readonly z: number;
}

const EPS = 1e-9;

export function throwPaper(bike: Bike, side: Side): Paper {
  const dir = side === 'L' ? -1 : 1;
  return { c0: bike.c, s0: bike.s, dc: (dir * TOSS.reach) / TOSS.flight, ds: bike.speed, t: 0 };
}

export function stepPaper(p: Paper, dt: number): Paper {
  const t = p.t + dt;
  return { ...p, t: t >= TOSS.flight - EPS ? TOSS.flight : t };
}

export const heightAt = (t: number): number => Math.max(0, TOSS.h0 + TOSS.vz * t - (TOSS.gravity * t * t) / 2);

export const hasLanded = (p: Paper): boolean => p.t >= TOSS.flight;

export function paperPos(p: Paper): PaperPos {
  return { c: p.c0 + p.dc * p.t, s: p.s0 + p.ds * p.t, z: hasLanded(p) ? 0 : heightAt(p.t) };
}

/** The lot whose mailbox the paper is passing through, if it is low enough. */
export function mailboxHit(lots: readonly Lot[], pos: PaperPos): Lot | undefined {
  if (pos.z >= MAILBOX.top) return undefined;
  return lots.find((l) => distance(l.mailbox, [pos.c, pos.s]) <= MAILBOX.r);
}

export const porchHit = (lots: readonly Lot[], pos: PaperPos): Lot | undefined => lots.find((l) => inRect(l.porch, pos.c, pos.s));
