import type { Gate } from '../world/slope';
import { GATE } from './constants';

export interface GateProgress {
  /** Index of the next gate to resolve. */
  readonly next: number;
  /** Unbroken passes so far. */
  readonly streak: number;
  readonly passed: number;
}

export const NO_GATES: GateProgress = { next: 0, streak: 0, passed: 0 };

export type GateResult =
  | { readonly kind: 'pass'; readonly index: number; readonly points: number; readonly streak: number }
  | { readonly kind: 'miss'; readonly index: number };

export const gatePoints = (streakBefore: number): number => GATE.base + GATE.streak * streakBefore;

export const between = (g: Gate, c: number): boolean => c >= g.c[0] - GATE.poleSlack && c <= g.c[1] + GATE.poleSlack;

/** Resolves every gate whose line the rider has reached (gates are sorted by d). */
export function crossGates(gates: readonly Gate[], progress: GateProgress, d: number, c: number): { progress: GateProgress; results: GateResult[] } {
  if (progress.next >= gates.length || gates[progress.next].d > d) return { progress, results: [] };
  const index = progress.next;
  const result: GateResult = between(gates[index], c)
    ? { kind: 'pass', index, points: gatePoints(progress.streak), streak: progress.streak + 1 }
    : { kind: 'miss', index };
  const next: GateProgress = result.kind === 'pass'
    ? { next: index + 1, streak: result.streak, passed: progress.passed + 1 }
    : { next: index + 1, streak: 0, passed: progress.passed };
  const rest = crossGates(gates, next, d, c);
  return { progress: rest.progress, results: [result, ...rest.results] };
}
