import { describe, expect, it } from 'vitest';
import { between, crossGates, gatePoints, NO_GATES } from '../../src/sim/gates';
import type { Gate } from '../../src/world/slope';

const gates: Gate[] = [
  { d: 10, c: [6, 10], color: 'blue' },
  { d: 20, c: [3, 7], color: 'red' },
  { d: 30, c: [8, 12], color: 'blue' },
];

describe('gates', () => {
  it('counts poles as inside, with a little slack', () => {
    expect(between(gates[0], 6)).toBe(true);
    expect(between(gates[0], 10.3)).toBe(true);
    expect(between(gates[0], 10.4)).toBe(false);
  });
  it('scores 100 plus 50 for each earlier gate in the streak', () => {
    expect(gatePoints(0)).toBe(100);
    expect(gatePoints(2)).toBe(200);
  });
  it('does nothing before the next gate', () => {
    expect(crossGates(gates, NO_GATES, 9.9, 8)).toEqual({ progress: NO_GATES, results: [] });
  });
  it('passes gates in order and grows the streak', () => {
    const a = crossGates(gates, NO_GATES, 10, 8);
    expect(a.results).toEqual([{ kind: 'pass', index: 0, points: 100, streak: 1 }]);
    const b = crossGates(gates, a.progress, 20, 5);
    expect(b.results).toEqual([{ kind: 'pass', index: 1, points: 150, streak: 2 }]);
    expect(b.progress).toEqual({ next: 2, streak: 2, passed: 2 });
  });
  it('resets the streak on a miss without other cost', () => {
    const a = crossGates(gates, { next: 1, streak: 1, passed: 1 }, 20, 12);
    expect(a.results).toEqual([{ kind: 'miss', index: 1 }]);
    expect(a.progress).toEqual({ next: 2, streak: 0, passed: 1 });
    expect(crossGates(gates, a.progress, 30, 9).results).toEqual([{ kind: 'pass', index: 2, points: 100, streak: 1 }]);
  });
  it('resolves several gates crossed in one step', () => {
    expect(crossGates(gates, NO_GATES, 30, 9).results.map((r) => r.kind)).toEqual(['pass', 'miss', 'pass']);
  });
});
