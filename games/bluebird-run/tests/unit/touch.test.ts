import { describe, expect, it } from 'vitest';
import { NO_TOUCH, stepTouch, touchHeld, touchTurn, type TouchSample, type TouchState } from '../../src/core/touch';

const run = (samples: TouchSample[]) =>
  samples.reduce<{ state: TouchState; jumps: number }>((acc, e) => {
    const r = stepTouch(acc.state, e);
    return { state: r.state, jumps: acc.jumps + (r.jump ? 1 : 0) };
  }, { state: NO_TOUCH, jumps: 0 });

describe('touch steering', () => {
  it('maps drag offset from the anchor to turn, full at ±48 px', () => {
    const { state } = run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'move', id: 1, x: 124, y: 310, t: 50 }]);
    expect(touchTurn(state)).toBeCloseTo(0.5);
    expect(touchTurn(run([{ kind: 'down', id: 1, x: 100, y: 0, t: 0 }, { kind: 'move', id: 1, x: 20, y: 0, t: 50 }]).state)).toBe(-1);
    expect(touchTurn(NO_TOUCH)).toBe(0);
  });
  it('holds while any finger is down and releases to 0', () => {
    const down = run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }]);
    expect(touchHeld(down.state)).toBe(true);
    const up = run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'move', id: 1, x: 140, y: 300, t: 100 }, { kind: 'up', id: 1, x: 140, y: 300, t: 400 }]);
    expect(touchHeld(up.state)).toBe(false);
    expect(touchTurn(up.state)).toBe(0);
  });
});

describe('touch jumps', () => {
  it('jumps on a quick, still tap', () => {
    expect(run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'up', id: 1, x: 103, y: 302, t: 120 }]).jumps).toBe(1);
  });
  it('does not jump on a slow press or a drag', () => {
    expect(run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'up', id: 1, x: 100, y: 300, t: 400 }]).jumps).toBe(0);
    expect(run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'move', id: 1, x: 120, y: 300, t: 60 }, { kind: 'up', id: 1, x: 100, y: 300, t: 120 }]).jumps).toBe(0);
    expect(run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'cancel', id: 1, x: 100, y: 300, t: 50 }]).jumps).toBe(0);
  });
  it('jumps when a second finger lands while steering, and keeps steering', () => {
    const r = run([
      { kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'move', id: 1, x: 148, y: 300, t: 100 },
      { kind: 'down', id: 2, x: 300, y: 300, t: 200 }, { kind: 'up', id: 2, x: 300, y: 300, t: 260 },
    ]);
    expect(r.jumps).toBe(1);
    expect(touchTurn(r.state)).toBe(1);
  });
  it('ignores moves from fingers it is not tracking', () => {
    const r = run([{ kind: 'down', id: 1, x: 100, y: 300, t: 0 }, { kind: 'move', id: 9, x: 200, y: 300, t: 10 }]);
    expect(touchTurn(r.state)).toBe(0);
  });
});
